// End-to-end check of roles and single-use invite codes against a throwaway
// in-memory database. Run with: node scripts/check-permissions.js
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as connectSocket } from 'socket.io-client';

process.env.PORT = process.env.PORT || '4100';
const { start } = await import('../index.js');

const mongod = await MongoMemoryServer.create();
await start(mongod.getUri('teamflow-check'));
const BASE = `http://localhost:${process.env.PORT}/api`;

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures += 1;
};

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}
const register = async (name) =>
  (await call('POST', '/auth/register', null, { name, email: `${name.toLowerCase()}@check.dev`, password: 'secret123' })).data.token;

try {
  const owner = await register('Owner');
  const rahul = await register('Rahul');
  const priya = await register('Priya');
  const amit = await register('Amit');

  const team = (await call('POST', '/teams', owner, { name: 'Bindas' })).data.team;
  check('team response hides the old shared joinCode', !('joinCode' in team));
  check('invite prefix comes from team name', team.invitePrefix === 'BIN', team.invitePrefix);

  // ---- Invites
  const inv1 = (await call('POST', `/teams/${team._id}/invites`, owner, { label: 'Rahul' })).data.invite;
  const inv2 = (await call('POST', `/teams/${team._id}/invites`, owner, {})).data.invite;
  check('invite codes start with BIN', inv1.code.startsWith('BIN') && inv2.code.startsWith('BIN'), `${inv1.code}, ${inv2.code}`);
  check('each invite code is different', inv1.code !== inv2.code);
  check('codes are 6 characters', inv1.code.length === 6);

  let r = await call('POST', '/teams/join', rahul, { joinCode: inv1.code.toLowerCase() });
  check('Rahul joins with code (lowercase accepted)', r.status === 200, r.status);
  r = await call('POST', '/teams/join', priya, { joinCode: inv1.code });
  check('same code cannot be used twice', r.status === 400, `${r.status} ${r.data?.error?.message || r.data?.message || ''}`);
  r = await call('POST', '/teams/join', rahul, { joinCode: inv2.code });
  check('already-member is refused without using the code', r.status === 400, r.status);
  r = await call('POST', '/teams/join', priya, { joinCode: inv2.code });
  check('Priya joins with the second code', r.status === 200, r.status);
  r = await call('POST', '/teams/join', amit, { joinCode: 'BINZZZ' });
  check('unknown code is rejected', r.status === 404, r.status);
  r = await call('POST', `/teams/${team._id}/invites`, rahul, {});
  check('member cannot create invite codes', r.status === 403, r.status);

  const list = (await call('GET', `/teams/${team._id}/invites`, owner)).data.invites;
  check('invite list shows who used each code', list.filter((i) => i.usedBy).length === 2);
  const inv3 = (await call('POST', `/teams/${team._id}/invites`, owner, {})).data.invite;
  r = await call('DELETE', `/teams/${team._id}/invites/${inv3._id}`, owner);
  check('unused code can be revoked', r.status === 204, r.status);
  r = await call('POST', '/teams/join', amit, { joinCode: inv3.code });
  check('revoked code no longer works', r.status === 404, r.status);
  r = await call('DELETE', `/teams/${team._id}/invites/${inv1._id}`, owner);
  check('used code cannot be revoked', r.status === 400, r.status);

  // Make Priya a manager
  const me = async (t) => (await call('GET', '/auth/me', t)).data.user;
  const rahulId = (await me(rahul))._id;
  const priyaId = (await me(priya))._id;
  await call('PATCH', `/teams/${team._id}/members/${priyaId}`, owner, { role: 'manager' });

  // ---- Projects
  r = await call('POST', `/teams/${team._id}/projects`, rahul, { name: 'Sneaky', deadline: new Date(Date.now() + 864e5 * 10) });
  check('member cannot create a project', r.status === 403, r.status);
  r = await call('POST', `/teams/${team._id}/projects`, priya, { name: 'Website', deadline: new Date(Date.now() + 864e5 * 10) });
  check('manager can create a project', r.status === 201, r.status);
  const project = r.data.project;

  // ---- Tasks
  r = await call('POST', `/teams/${team._id}/tasks`, rahul, { title: 'My own task', project: project._id });
  check('member cannot create a task', r.status === 403, r.status);
  r = await call('POST', `/teams/${team._id}/tasks`, rahul, { title: 'Task for Priya', project: project._id, assignee: priyaId });
  check('member cannot create/assign a task to others', r.status === 403, r.status);
  r = await call('POST', `/teams/${team._id}/tasks`, priya, { title: 'Design homepage', project: project._id, assignee: rahulId, estimateHours: 4 });
  check('manager can create and assign a task', r.status === 201, r.status);
  const task = r.data.task;
  r = await call('POST', `/teams/${team._id}/tasks`, owner, { title: 'Owner task', project: project._id });
  check('owner can create a task', r.status === 201, r.status);
  check('tasks get permanent serial numbers 1, 2 in order', task.number === 1 && r.data.task.number === 2, `${task.number}, ${r.data.task.number}`);
  const burst = await Promise.all([1, 2, 3, 4, 5].map((i) => call('POST', `/teams/${team._id}/tasks`, owner, { title: `Burst ${i}`, project: project._id })));
  const nums = burst.map((b) => b.data.task.number).sort((a, b) => a - b);
  check('tasks created at the same moment never share a serial', nums.join(',') === '3,4,5,6,7', nums.join(','));

  r = await call('PATCH', `/tasks/${task._id}`, rahul, { status: 'in_progress', progress: 40 });
  check('member can update status and progress of own task', r.status === 200 && r.data.task.progress === 40, r.status);
  r = await call('PATCH', `/tasks/${task._id}`, rahul, { title: 'Renamed' });
  check('member cannot rename the task', r.status === 403, r.status);
  r = await call('PATCH', `/tasks/${task._id}`, rahul, { assignee: null });
  check('member cannot unassign/reassign', r.status === 403, r.status);
  r = await call('PATCH', `/tasks/${task._id}`, rahul, { dueDate: new Date().toISOString() });
  check('member cannot change the due date', r.status === 403, r.status);
  r = await call('DELETE', `/tasks/${task._id}`, rahul);
  check('member cannot delete a task', r.status === 403, r.status);
  r = await call('PATCH', `/tasks/${task._id}`, priya, { title: 'Design homepage v2', assignee: priyaId });
  check('manager can edit and reassign', r.status === 200, r.status);
  r = await call('PATCH', `/tasks/${task._id}`, rahul, { status: 'done' });
  check('member cannot update a task no longer assigned to them', r.status === 403, r.status);
  const proofPath = `/tasks/${task._id}/attachments`;
  const proof = new FormData();
  proof.append('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'proof.pdf');
  const uploadProof = await fetch(BASE + proofPath, {
    method: 'POST',
    headers: { Authorization: `Bearer ${priya}` },
    body: proof,
  });
  check('assignee can upload task proof', uploadProof.status === 201, uploadProof.status);
  const attachment = (await uploadProof.json()).task.attachments[0];
  const downloadPath = `${proofPath}/${attachment._id}`;
  check('anonymous visitor cannot fetch task proof', (await fetch(BASE + downloadPath)).status === 401);
  const outsider = await call('GET', downloadPath, amit);
  check('outsider cannot fetch task proof', [403, 404].includes(outsider.status), outsider.status);
  const proofRes = await fetch(BASE + downloadPath, { headers: { Authorization: `Bearer ${rahul}` } });
  check('teammate can fetch task proof', proofRes.ok && await proofRes.text() === '%PDF-1.4');
  const direct = await fetch(new URL(attachment.url, BASE));
  check('legacy proof URL is no longer public', direct.status === 404);
  await call('DELETE', downloadPath, priya);

  r = await call('DELETE', `/tasks/${task._id}`, priya);
  check('manager can delete a task', r.status === 204, r.status);

  // ---- Project chat
  const chat = `/projects/${project._id}/messages`;
  r = await call('POST', chat, rahul, { text: 'Hi team, homepage draft is ready' });
  check('member can send a chat message', r.status === 201 && r.data.message.sender.name === 'Rahul', r.status);
  const rahulMsg = r.data.message;
  r = await call('POST', chat, owner, { text: 'Great, reviewing now' });
  check('owner can send a chat message', r.status === 201, r.status);
  const ownerMsg = r.data.message;
  r = await call('POST', chat, rahul, { text: '   ' });
  check('empty message is rejected', r.status === 400, r.status);
  r = await call('POST', chat, amit, { text: 'let me in' });
  check('non-member cannot post in the chat', r.status === 403 || r.status === 404, r.status);
  r = await call('GET', chat, amit);
  check('non-member cannot read the chat', r.status === 403 || r.status === 404, r.status);
  r = await call('GET', chat, priya);
  check('messages come back oldest first', r.status === 200 && r.data.messages.map((m) => m.text).join('|') === 'Hi team, homepage draft is ready|Great, reviewing now');
  r = await call('DELETE', `${chat}/${ownerMsg._id}`, rahul);
  check("member cannot delete someone else's message", r.status === 403, r.status);
  r = await call('DELETE', `${chat}/${rahulMsg._id}`, rahul);
  check('member can delete own message', r.status === 204, r.status);
  r = await call('DELETE', `${chat}/${ownerMsg._id}`, priya);
  check('manager can delete any message', r.status === 204, r.status);
  for (let i = 0; i < 55; i += 1) await call('POST', chat, owner, { text: `msg ${i}` });
  r = await call('GET', chat, rahul);
  check('chat returns pages of 50 with hasMore', r.data.messages.length === 50 && r.data.hasMore === true, `${r.data.messages.length}`);
  const older = await call('GET', `${chat}?before=${encodeURIComponent(r.data.messages[0].createdAt)}`, rahul);
  check('older page returns the rest', older.data.messages.length === 5 && older.data.hasMore === false, `${older.data.messages.length}`);

  // Chat photos use the same membership rules as text messages.
  const chatPhoto = new FormData();
  const photoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  chatPhoto.append('file', new Blob([photoBytes], { type: 'image/png' }), 'photo.png');
  const postPhoto = (token) => fetch(BASE + chat + '/photo', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: chatPhoto,
  });
  check('outsiders cannot share chat photos', (await postPhoto(amit)).status === 403);
  const uploaded = await postPhoto(rahul);
  const shared = (await uploaded.json()).message;
  check('member shares a photo without exposing bytes in the message', uploaded.status === 201 && shared.photoType === 'image/png' && !shared.photo);
  const photoPath = `${chat}/${shared._id}/photo`;
  const readPhoto = (token) => fetch(BASE + photoPath, { headers: { Authorization: `Bearer ${token}` } });
  const downloaded = await readPhoto(owner);
  check('teammates can view the original photo', downloaded.status === 200 && Buffer.from(await downloaded.arrayBuffer()).equals(photoBytes));
  check('outsiders cannot view chat photos', (await readPhoto(amit)).status === 403);
  await call('DELETE', `${chat}/${shared._id}`, rahul);
  check('deleting the message removes its photo', (await readPhoto(owner)).status === 404);

  // ---- Profile photos
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const sendPhoto = async (token, buf, type, name) => {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type }), name);
    const res = await fetch(`${BASE}/auth/me/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  r = await sendPhoto(rahul, png, 'image/png', 'me.png');
  check('member can upload a profile photo', r.status === 200 && r.data.user.avatarUrl.startsWith('/uploads/avatar-'), r.status);
  const firstPhoto = r.data.user.avatarUrl;
  const photoRes = await fetch(`http://localhost:${process.env.PORT}${firstPhoto}`);
  check('uploaded photo is served', photoRes.status === 200, photoRes.status);
  r = await call('GET', `/teams/${team._id}`, owner);
  check('teammates see the photo on the member list', r.data.team.members.some((m) => m.user.avatarUrl === firstPhoto));
  r = await sendPhoto(rahul, Buffer.from('%PDF-1.4'), 'application/pdf', 'cv.pdf');
  check('non-image profile photo is rejected', r.status === 400, r.status);
  r = await sendPhoto(rahul, png, 'image/png', 'new.png');
  const oldGone = await fetch(`http://localhost:${process.env.PORT}${firstPhoto}`);
  check('replacing a photo deletes the old file', r.status === 200 && r.data.user.avatarUrl !== firstPhoto && oldGone.status === 404, `${r.status}/${oldGone.status}`);
  r = await call('DELETE', '/auth/me/avatar', rahul);
  check('member can remove their photo', r.status === 200 && r.data.user.avatarUrl === '', r.status);

  // ---- Scheduled meetings
  const mtg = `/projects/${project._id}/meetings`;
  const soon = new Date(Date.now() + 3600e3).toISOString();
  r = await call('POST', mtg, rahul, { title: 'Sneaky meeting', startsAt: soon });
  check('member cannot schedule a meeting', r.status === 403, r.status);
  r = await call('POST', mtg, priya, { title: 'Sprint review', startsAt: soon, durationMinutes: 45, link: 'http://insecure.example' });
  check('non-https meeting link is rejected', r.status === 400, r.status);
  r = await call('POST', mtg, priya, { title: 'Sprint review', agenda: 'Demo the homepage', startsAt: soon, durationMinutes: 45, link: 'https://meet.google.com/abc-defg-hij' });
  check('manager can schedule a meeting with a Meet link', r.status === 201 && r.data.meeting.link.startsWith('https://meet.google.com'), r.status);
  const meetingId = r.data.meeting._id;
  r = await call('POST', mtg, owner, { title: 'Quick sync', startsAt: soon });
  check('owner can schedule a built-in meeting (no link)', r.status === 201 && r.data.meeting.link === '', r.status);
  r = await call('GET', mtg, rahul);
  check('member sees upcoming meetings', r.status === 200 && r.data.upcoming.length === 2 && r.data.call === null, r.status);
  r = await call('GET', mtg, amit);
  check('non-member cannot see meetings', r.status === 403 || r.status === 404, r.status);
  r = await call('DELETE', `${mtg}/${meetingId}`, rahul);
  check('member cannot cancel a meeting', r.status === 403, r.status);
  r = await call('DELETE', `${mtg}/${meetingId}`, priya);
  check('manager can cancel a meeting', r.status === 204, r.status);

  // ---- Live video call (Socket.io signalling)
  const url = `http://localhost:${process.env.PORT}`;
  const sock = (token) => new Promise((resolve, reject) => {
    const s = connectSocket(url, { auth: { token }, transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
  const emit = (s, ev, payload) => new Promise((resolve) => s.emit(ev, payload, resolve));
  const waitFor = (s, ev, ms = 3000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${ev}`)), ms);
    s.once(ev, (d) => { clearTimeout(t); resolve(d); });
  });
  const sOwner = await sock(owner);
  const sRahul = await sock(rahul);
  const sAmit = await sock(amit);
  const scheduledAlert = (socket) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('notify', onAlert);
      reject(new Error('Timed out waiting for scheduled meeting alert'));
    }, 3000);
    function onAlert(payload) {
      if (payload.kind !== 'scheduled-meeting' || payload.body !== 'Notification test') return;
      clearTimeout(timeout);
      socket.off('notify', onAlert);
      socket.emit('meeting:alert-seen', payload.meetingId);
      resolve(payload);
    }
    socket.on('notify', onAlert);
  });
  const schedulerAlert = scheduledAlert(sOwner);
  const memberAlert = scheduledAlert(sRahul);
  const scheduled = await call('POST', mtg, owner, { title: 'Notification test', startsAt: soon });
  check('meeting response does not expose pending recipients', !('pendingAlerts' in scheduled.data.meeting));
  const meetingAlerts = await Promise.all([schedulerAlert, memberAlert]);
  check('scheduler and connected member receive the alert', meetingAlerts.every((alert) => alert.meetingId === scheduled.data.meeting._id));
  const sPriya = connectSocket(url, { auth: { token: priya }, transports: ['websocket'], forceNew: true, autoConnect: false });
  const offlineAlert = scheduledAlert(sPriya);
  sPriya.connect();
  check('offline teammate receives the alert on reconnect', (await offlineAlert).meetingId === scheduled.data.meeting._id);
  sPriya.disconnect();

  let ack = await emit(sRahul, 'call:start', { projectId: project._id });
  check('member cannot start a live meeting', ack.ok === false, ack.error);
  const startedSeen = waitFor(sRahul, 'call:started');
  const notified = waitFor(sRahul, 'notify');
  ack = await emit(sOwner, 'call:start', { projectId: project._id });
  check('owner can start a live meeting', ack.ok === true && ack.call.participants.length === 0, ack.error);
  const started = await startedSeen;
  check('team is told the meeting started', started.projectId === String(project._id));
  check('members get a "meeting started" notification', (await notified).kind === 'call');
  ack = await emit(sOwner, 'call:join', { projectId: project._id });
  check('owner joins the call (no one else yet)', ack.ok && ack.peers.length === 0, ack.error);
  const peerJoined = waitFor(sOwner, 'call:peer-joined');
  ack = await emit(sRahul, 'call:join', { projectId: project._id });
  check('member joins and sees the owner already there', ack.ok && ack.peers.length === 1 && ack.peers[0].user.name === 'Owner', ack.error);
  const pj = await peerJoined;
  check('owner is told Rahul joined', pj.user.name === 'Rahul');
  ack = await emit(sAmit, 'call:join', { projectId: project._id });
  check('outsider cannot join the call', ack.ok === false, ack.error);
  // Signalling relay: Rahul sends an "offer" to the owner.
  const relayed = waitFor(sOwner, 'call:signal');
  sRahul.emit('call:signal', { to: pj.socketId === sRahul.id ? sOwner.id : sOwner.id, data: { type: 'offer', sdp: 'test-sdp' } });
  const sig = await relayed;
  check('offer is relayed to the other person', sig.from === sRahul.id && sig.data.sdp === 'test-sdp');
  sAmit.emit('call:signal', { to: sOwner.id, data: { type: 'offer', sdp: 'evil' } });
  const leakCheck = await waitFor(sOwner, 'call:signal', 500).then(() => 'leaked').catch(() => 'blocked');
  check('outsider signals are not relayed', leakCheck === 'blocked');
  r = await call('GET', mtg, rahul);
  check('meetings API shows the live call with 2 people', r.data.call && r.data.call.participants.length === 2);
  ack = await emit(sRahul, 'call:end', { projectId: project._id });
  check('member cannot end the call for everyone', ack.ok === false);
  const left = waitFor(sOwner, 'call:peer-left');
  ack = await emit(sRahul, 'call:leave');
  check('member can leave the call', ack.ok && (await left).socketId === sRahul.id);
  const ended = waitFor(sRahul, 'call:ended');
  ack = await emit(sOwner, 'call:end', { projectId: project._id });
  check('owner ends the call and the team is told', ack.ok && (await ended).projectId === String(project._id));
  r = await call('GET', mtg, rahul);
  check('no live call after it ends', r.data.call === null);
  // A call is closed automatically when the last person leaves.
  await emit(sOwner, 'call:start', { projectId: project._id });
  await emit(sOwner, 'call:join', { projectId: project._id });
  const autoEnd = waitFor(sRahul, 'call:ended');
  sOwner.disconnect();
  check('call ends automatically when everyone leaves', (await autoEnd).reason === 'empty');
  let staleEvents = 0;
  sRahul.on('chat:message', () => { staleEvents += 1; });
  r = await call('DELETE', `/teams/${team._id}/members/${rahulId}`, owner);
  check('owner can remove the connected member', r.status === 200, r.status);
  await call('POST', chat, owner, { text: 'After membership removal' });
  await emit(sRahul, 'call:leave'); // Flush earlier events on this connection.
  check('removed member no longer receives team chat', staleEvents === 0);
  [sRahul, sAmit].forEach((s) => s.disconnect());
} catch (err) {
  console.error(err);
  failures += 1;
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
await mongod.stop();
process.exit(failures ? 1 : 0);
