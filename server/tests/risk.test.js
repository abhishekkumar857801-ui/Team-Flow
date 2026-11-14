import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTeam, taskLoad, urgencyWeight } from '../services/risk.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 12);
const at = (d) => new Date(NOW + d * DAY);

const users = {
  a: { _id: 'a', name: 'A', weeklyCapacity: 10 },
  b: { _id: 'b', name: 'B', weeklyCapacity: 20 },
};
const members = [
  { user: users.a, role: 'owner' },
  { user: users.b, role: 'member' },
];

test('urgency rises as the deadline approaches', () => {
  assert.equal(urgencyWeight(at(-1), NOW), 1.5);
  assert.equal(urgencyWeight(at(1), NOW), 1.3);
  assert.equal(urgencyWeight(at(30), NOW), 0.3);
  assert.equal(urgencyWeight(null, NOW), 0.6);
});

test('progress reduces remaining load', () => {
  const base = { estimateHours: 10, priority: 'medium', dueDate: at(5) };
  assert.equal(taskLoad({ ...base, progress: 0 }, NOW), 10);
  assert.equal(taskLoad({ ...base, progress: 50 }, NOW), 5);
});

test('flags overloaded member and suggests moving work to the free one', () => {
  const tasks = [
    { _id: 't1', project: 'p1', title: 'Big', assignee: users.a, status: 'todo', priority: 'high', estimateHours: 6, dueDate: at(1) },
    { _id: 't2', project: 'p1', title: 'Small', assignee: users.a, status: 'todo', priority: 'low', estimateHours: 2, dueDate: at(3) },
  ];
  const projects = [{ _id: 'p1', name: 'P', deadline: at(3) }];
  const r = analyzeTeam({ members, projects, tasks, now: NOW });

  const a = r.members.find((m) => m.user._id === 'a');
  assert.equal(a.status, 'overloaded');
  assert.equal(r.summary.overloadedMembers, 1);
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.suggestions[0].task._id, 't2', 'moves the lower-priority task first');
  assert.equal(r.suggestions[0].to._id, 'b');
});

test('project past its deadline with open work is critical', () => {
  const tasks = [{ _id: 't1', project: 'p1', title: 'x', assignee: users.b, status: 'todo', priority: 'medium', estimateHours: 2 }];
  const r = analyzeTeam({ members, projects: [{ _id: 'p1', name: 'Late', deadline: at(-1) }], tasks, now: NOW });
  assert.equal(r.projects[0].riskLevel, 'critical');
  assert.equal(r.projects[0].riskScore, 100);
});

test('project with plenty of time is low risk', () => {
  const tasks = [{ _id: 't1', project: 'p1', title: 'x', assignee: users.b, status: 'todo', priority: 'medium', estimateHours: 2, dueDate: at(20) }];
  const r = analyzeTeam({ members, projects: [{ _id: 'p1', name: 'Easy', deadline: at(30) }], tasks, now: NOW });
  assert.equal(r.projects[0].riskLevel, 'low');
});

test('finished project is marked done', () => {
  const tasks = [{ _id: 't1', project: 'p1', title: 'x', assignee: users.b, status: 'done', priority: 'medium', estimateHours: 2, completedAt: at(-1) }];
  const r = analyzeTeam({ members, projects: [{ _id: 'p1', name: 'Done', deadline: at(5) }], tasks, now: NOW });
  assert.equal(r.projects[0].riskLevel, 'done');
  assert.equal(r.projects[0].completion, 100);
});
