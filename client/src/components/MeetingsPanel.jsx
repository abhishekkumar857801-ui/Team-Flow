import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api.js';
import { getSocket, useSocketEvents } from '../lib/socket.js';
import { Avatar, Modal } from './ui.jsx';
import Icon from './Icon.jsx';

const pad = (n) => String(n).padStart(2, '0');
// Value for <input type="datetime-local"> in the user's local time.
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const linkLabel = (url) => {
  if (/meet\.google\.com/i.test(url)) return 'Join on Google Meet';
  if (/zoom\.us/i.test(url)) return 'Join on Zoom';
  if (/teams\.microsoft|teams\.live/i.test(url)) return 'Join on Teams';
  return 'Open meeting link';
};

function nextHalfHour() {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

// Schedule meetings for a project and start/join its built-in live video call.
export default function MeetingsPanel({ project, teamId, isManager, onJoinCall, onClose }) {
  const [data, setData] = useState(null); // { upcoming, past, call }
  const [error, setError] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({ title: '', startsAt: toLocalInput(nextHalfHour()), durationMinutes: 30, link: '', agenda: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(
    () => api.get(`/projects/${project._id}/meetings`).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e))),
    [project._id]
  );
  useEffect(() => { load(); }, [load]);

  const mine = (p) => p?.projectId === project._id;
  useSocketEvents(
    {
      'meeting:changed': (p) => mine(p) && load(),
      'call:started': (p) => mine(p) && load(),
      'call:updated': (p) => mine(p) && setData((d) => d && { ...d, call: p.call }),
      'call:ended': (p) => mine(p) && setData((d) => d && { ...d, call: null }),
    },
    teamId
  );

  const startNow = async () => {
    setStarting(true);
    setError('');
    getSocket()?.emit('call:start', { projectId: project._id }, (res) => {
      setStarting(false);
      if (res?.ok) onJoinCall(project);
      else setError(res?.error || 'Could not start the meeting');
    });
  };

  const [saving, setSaving] = useState(false);
  const schedule = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/projects/${project._id}/meetings`, {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
      });
      setScheduling(false);
      setForm({ title: '', startsAt: toLocalInput(nextHalfHour()), durationMinutes: 30, link: '', agenda: '' });
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cancelMeeting = async (m) => {
    if (!window.confirm(`Cancel "${m.title}"?`)) return;
    try {
      await api.delete(`/projects/${project._id}/meetings/${m._id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const call = data?.call;
  const now = Date.now();

  return (
    <Modal title={`Meetings · ${project.name}`} onClose={onClose}>
      <div className="stack">
        {error && <div className="error-box">{error}</div>}

        {call ? (
          <div className="live-banner">
            <span className="live-dot-red" />
            <div className="grow">
              <b>Live meeting in progress</b>
              <div className="small">
                Started by {call.startedBy?.name} at {fmtTime(call.startedAt)} · {call.participants.length} in the call
              </div>
            </div>
            <button className="btn primary" onClick={() => onJoinCall(project)}><Icon name="video" size={16} />Join now</button>
          </div>
        ) : isManager ? (
          <button className="btn primary" onClick={startNow} disabled={starting} style={{ padding: '12px 16px' }}>
            <Icon name="video" size={18} />{starting ? 'Starting…' : 'Start a video meeting now'}
          </button>
        ) : (
          <div className="info-note">No meeting in progress.</div>
        )}

        <div className="row between">
          <div className="section-label">Upcoming</div>
          {isManager && !scheduling && (
            <button className="btn sm" onClick={() => setScheduling(true)}><Icon name="calendar" size={14} />Schedule a meeting</button>
          )}
        </div>

        {scheduling && (
          <form className="stack card" onSubmit={schedule} style={{ padding: 14, gap: 10 }}>
            <label className="field">Title
              <input autoFocus required minLength={2} maxLength={120} placeholder="e.g. Sprint review" value={form.title} onChange={set('title')} />
            </label>
            <div className="grid-2">
              <label className="field">Date & time
                <input type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} />
              </label>
              <label className="field">Duration
                <select value={form.durationMinutes} onChange={set('durationMinutes')}>
                  {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ' 30' : ''}`}</option>)}
                </select>
              </label>
            </div>
            <label className="field">Meeting link (optional)
              <input type="url" placeholder="https://meet.google.com/… (leave empty to use TeamFlow video)" value={form.link} onChange={set('link')} />
            </label>
            <label className="field">Agenda (optional)
              <textarea maxLength={2000} value={form.agenda} onChange={set('agenda')} placeholder="What will you discuss?" style={{ minHeight: 64 }} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setScheduling(false)}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule & notify team'}</button>
            </div>
          </form>
        )}

        {!data && !error && <span className="muted small">Loading…</span>}
        {data && data.upcoming.length === 0 && !scheduling && <span className="muted small">No meetings scheduled.</span>}
        <div className="meeting-list">
          {data?.upcoming.map((m) => {
            const start = new Date(m.startsAt);
            const end = new Date(start.getTime() + m.durationMinutes * 60_000);
            const isNow = now >= start.getTime() - 10 * 60_000 && now <= end.getTime();
            return (
              <div key={m._id} className={`meeting-item ${isNow ? 'now' : ''}`}>
                <div className="meeting-date">
                  <b>{start.getDate()}</b>
                  <span>{start.toLocaleDateString([], { month: 'short' })}</span>
                </div>
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <b>{m.title}</b>
                    {isNow && <span className="badge danger">now</span>}
                  </div>
                  <div className="muted small">
                    {start.toLocaleDateString([], { weekday: 'short' })} · {fmtTime(start)} – {fmtTime(end)} · by {m.createdBy?.name}
                  </div>
                  {m.agenda && <p className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{m.agenda}</p>}
                  <div className="row wrap" style={{ marginTop: 8 }}>
                    {m.link ? (
                      <a className="btn sm primary" href={m.link} target="_blank" rel="noreferrer"><Icon name="video" size={14} />{linkLabel(m.link)}</a>
                    ) : call ? (
                      <button className="btn sm primary" onClick={() => onJoinCall(project)}><Icon name="video" size={14} />Join TeamFlow call</button>
                    ) : isManager ? (
                      <button className="btn sm primary" onClick={startNow} disabled={starting}><Icon name="video" size={14} />Start TeamFlow call</button>
                    ) : (
                      <span className="badge muted">TeamFlow video · opens when the host starts it</span>
                    )}
                    {isManager && <button className="btn sm danger" onClick={() => cancelMeeting(m)}>Cancel</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {data?.past.length > 0 && (
          <details>
            <summary className="section-label" style={{ cursor: 'pointer' }}>Past meetings ({data.past.length})</summary>
            <div className="meeting-list" style={{ marginTop: 8 }}>
              {data.past.map((m) => (
                <div key={m._id} className="meeting-item">
                  <Avatar user={m.createdBy} />
                  <div className="grow">
                    <b>{m.title}</b>
                    <div className="muted small">{new Date(m.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </Modal>
  );
}
