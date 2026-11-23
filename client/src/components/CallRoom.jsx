import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from './Icon.jsx';
import { avatarColor } from '../lib/format.js';

// Public STUN server lets two devices discover how to reach each other.
// (Very strict networks may also need a TURN relay server.)
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

const emitAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res || { ok: false, error: 'No response' })));

function Video({ stream, muted, mirrored }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={mirrored ? 'mirrored' : ''} />;
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function Tile({ name, color, stream, audio, video, muted, mirrored, label }) {
  const showVideo = stream && video;
  return (
    <div className="call-tile">
      {showVideo ? (
        <Video stream={stream} muted={muted} mirrored={mirrored} />
      ) : (
        <>
          {/* Keep audio playing even when the camera is off. */}
          {stream && !muted && <Video stream={stream} muted={false} />}
          <div className="call-avatar" style={{ background: color, color: '#f4ede0' }}>{initialsOf(name)}</div>
        </>
      )}
      <div className="call-name">
        {!audio && <Icon name="micOff" size={13} />}
        {name}{label ? ` ${label}` : ''}
      </div>
    </div>
  );
}

// Full-screen built-in video meeting for one project (WebRTC mesh).
// Every participant connects directly to every other one; the server only
// relays the connection set-up messages over Socket.io.
export default function CallRoom({ projectId, projectName, isManager, onClose }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState('');
  const [local, setLocal] = useState({ stream: null, audio: true, video: true, hasAudio: false, hasVideo: false });
  const [peers, setPeers] = useState([]); // [{ socketId, user, stream, audio, video }]
  const pcs = useRef(new Map()); // socketId -> RTCPeerConnection
  const pendingIce = useRef(new Map()); // socketId -> candidates waiting for remote description
  const localStream = useRef(null);
  const teardownRef = useRef(() => {});
  const sessionRef = useRef(0); // bumps every time the call effect (re)starts
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const upsertPeer = useCallback((socketId, patch) => {
    setPeers((list) => {
      const found = list.find((p) => p.socketId === socketId);
      if (found) return list.map((p) => (p.socketId === socketId ? { ...p, ...patch } : p));
      return [...list, { socketId, user: null, stream: null, audio: true, video: true, ...patch }];
    });
  }, []);

  const removePeer = useCallback((socketId) => {
    pcs.current.get(socketId)?.close();
    pcs.current.delete(socketId);
    pendingIce.current.delete(socketId);
    setPeers((list) => list.filter((p) => p.socketId !== socketId));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setError('Not connected to the server');
      return undefined;
    }
    // Each run of this effect is one "session" in the call. `cancelled` stops a
    // run that is still starting up if the component closes (or re-mounts).
    let cancelled = false;
    let stopped = false;
    const session = ++sessionRef.current;
    const teardown = () => {
      if (stopped) return;
      stopped = true;
      cancelled = true;
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      pendingIce.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      // Defer so a quick re-mount (React dev mode) can claim the session first.
      setTimeout(() => {
        if (sessionRef.current === session) socket.emit('call:leave', {}, () => {});
      }, 0);
    };
    teardownRef.current = teardown;

    const createPeer = (socketId) => {
      if (pcs.current.has(socketId)) return pcs.current.get(socketId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcs.current.set(socketId, pc);
      const stream = localStream.current;
      if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Still receive audio/video if we have no camera or mic ourselves.
      if (!stream?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
      if (!stream?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('call:signal', { to: socketId, data: { type: 'candidate', candidate: e.candidate } });
      };
      pc.ontrack = (e) => {
        const remote = e.streams[0] || new MediaStream([e.track]);
        upsertPeer(socketId, { stream: remote });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') upsertPeer(socketId, { failed: true });
        if (pc.connectionState === 'connected') upsertPeer(socketId, { failed: false });
      };
      return pc;
    };

    const flushIce = async (socketId) => {
      const pc = pcs.current.get(socketId);
      const queued = pendingIce.current.get(socketId) || [];
      pendingIce.current.delete(socketId);
      for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
    };

    const onSignal = async ({ from, data }) => {
      try {
        if (data.type === 'offer') {
          const pc = createPeer(from);
          await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
          await flushIce(from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', { to: from, data: { type: 'answer', sdp: answer.sdp } });
          // Tell the newcomer our mic/camera state.
          const s = localStream.current;
          socket.emit('call:media', {
            audio: !!s?.getAudioTracks().some((t) => t.enabled),
            video: !!s?.getVideoTracks().some((t) => t.enabled),
          });
        } else if (data.type === 'answer') {
          const pc = pcs.current.get(from);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
            await flushIce(from);
          }
        } else if (data.type === 'candidate') {
          const pc = pcs.current.get(from);
          if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
          else pendingIce.current.set(from, [...(pendingIce.current.get(from) || []), data.candidate]);
        }
      } catch (err) {
        console.warn('WebRTC signal error', err);
      }
    };
    const onPeerJoined = ({ projectId: pid, socketId, user: u }) => {
      if (pid === projectId) upsertPeer(socketId, { user: u });
    };
    const onPeerLeft = ({ socketId }) => removePeer(socketId);
    const onPeerMedia = ({ socketId, audio, video }) => upsertPeer(socketId, { audio, video });
    const onEnded = ({ projectId: pid, reason }) => {
      if (pid !== projectId) return;
      setStatus(reason === 'empty' ? 'Everyone left the meeting.' : 'The meeting was ended by the host.');
      teardown();
      setTimeout(() => onCloseRef.current(), 1500);
    };

    socket.on('call:signal', onSignal);
    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:peer-left', onPeerLeft);
    socket.on('call:peer-media', onPeerMedia);
    socket.on('call:ended', onEnded);

    (async () => {
      // 1. Camera + mic (fall back to mic only, then to joining without media).
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 360 } });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setError('Camera not available. You joined with audio only.');
        } catch {
          setError('Camera and microphone are blocked. You can still see and hear others.');
        }
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      localStream.current = stream;
      setLocal({
        stream,
        audio: !!stream?.getAudioTracks().length,
        video: !!stream?.getVideoTracks().length,
        hasAudio: !!stream?.getAudioTracks().length,
        hasVideo: !!stream?.getVideoTracks().length,
      });

      // 2. Join the call and connect to everyone already in it.
      const res = await emitAck(socket, 'call:join', { projectId });
      if (cancelled) {
        // Closed while joining. Leave, unless a newer session (React re-mount) took over.
        if (res.ok && sessionRef.current === session) socket.emit('call:leave', {}, () => {});
        return;
      }
      if (!res.ok) {
        setStatus(res.error || 'Could not join the meeting');
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      setStatus('');
      socket.emit('call:media', { audio: !!stream?.getAudioTracks().length, video: !!stream?.getVideoTracks().length });
      for (const p of res.peers) {
        if (cancelled) return;
        upsertPeer(p.socketId, { user: p.user });
        const pc = createPeer(p.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', { to: p.socketId, data: { type: 'offer', sdp: offer.sdp } });
      }
    })();

    return () => {
      socket.off('call:signal', onSignal);
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:peer-left', onPeerLeft);
      socket.off('call:peer-media', onPeerMedia);
      socket.off('call:ended', onEnded);
      teardown();
    };
  }, [projectId, upsertPeer, removePeer]);

  const toggle = (kind) => {
    const stream = localStream.current;
    const tracks = kind === 'audio' ? stream?.getAudioTracks() : stream?.getVideoTracks();
    if (!tracks?.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = enabled; });
    const next = { ...local, [kind]: enabled };
    setLocal(next);
    getSocket()?.emit('call:media', { audio: next.audio, video: next.video });
  };

  const leave = () => {
    teardownRef.current();
    onClose();
  };

  const endForAll = async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    const res = await emitAck(getSocket(), 'call:end', { projectId });
    if (!res.ok) setError(res.error);
  };

  const count = peers.length + 1;
  return (
    <div className="call-overlay" role="dialog" aria-label={`${projectName} meeting`}>
      <header className="call-top">
        <span className="call-live">LIVE</span>
        <div className="grow">
          <b>{projectName}</b>
          <span className="call-sub">{count} in meeting</span>
        </div>
      </header>

      {status && <div className="call-status">{status}</div>}
      {error && <div className="call-warning">{error}</div>}

      <div className={`call-grid n${Math.min(count, 6)}`}>
        <Tile
          name={user.name}
          label="(you)"
          color={avatarColor(user)}
          stream={local.stream}
          audio={local.audio}
          video={local.video}
          muted
          mirrored
        />
        {peers.map((p) => (
          <Tile
            key={p.socketId}
            name={p.user?.name || 'Joining…'}
            label={p.failed ? '· connection problem' : ''}
            color={avatarColor(p.user)}
            stream={p.stream}
            audio={p.audio}
            video={p.video}
          />
        ))}
      </div>

      <footer className="call-controls">
        <button className={`call-btn ${local.audio ? '' : 'off'}`} onClick={() => toggle('audio')} disabled={!local.hasAudio}
          title={local.audio ? 'Mute microphone' : 'Unmute microphone'}>
          <Icon name={local.audio ? 'mic' : 'micOff'} size={20} />
        </button>
        <button className={`call-btn ${local.video ? '' : 'off'}`} onClick={() => toggle('video')} disabled={!local.hasVideo}
          title={local.video ? 'Turn camera off' : 'Turn camera on'}>
          <Icon name={local.video ? 'video' : 'videoOff'} size={20} />
        </button>
        <button className="call-btn leave" onClick={leave} title="Leave meeting">
          <Icon name="phoneOff" size={20} /><span>Leave</span>
        </button>
        {isManager && (
          <button className="call-btn end" onClick={endForAll} title="End meeting for everyone">End for all</button>
        )}
      </footer>
    </div>
  );
}
