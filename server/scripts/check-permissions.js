// End-to-end check of roles and single-use invite codes against a throwaway
// in-memory database. Run with: node scripts/check-permissions.js
import { MongoMemoryServer } from 'mongodb-memory-server';

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
} catch (err) {
  console.error(err);
  failures += 1;
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
await mongod.stop();
process.exit(failures ? 1 : 0);
