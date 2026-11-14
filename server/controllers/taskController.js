import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole, loadTeamForUser } from '../middleware/team.js';
import { logActivity } from '../services/activity.js';
import { emitToTeam, emitToUser } from '../services/realtime.js';
import { UPLOAD_DIR } from '../middleware/upload.js';

const POPULATE = [
  { path: 'assignee', select: 'name email avatarColor' },
  { path: 'createdBy', select: 'name' },
  { path: 'project', select: 'name color deadline' },
  { path: 'team', select: 'name' },
];

const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Done' };

async function loadTask(req) {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) throw badRequest('Invalid task id');
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task not found');
  const { team, role } = await loadTeamForUser(task.team, req.user._id);
  return { task, team, role };
}

const isMine = (task, userId) =>
  String(task.assignee) === String(userId) || String(task.createdBy) === String(userId);

function ensureAssigneeInTeam(team, assignee) {
  if (assignee && !team.roleOf(assignee)) throw badRequest('Assignee must be a member of this team');
}

async function broadcast(task, event) {
  const populated = await Task.findById(task._id).populate(POPULATE);
  emitToTeam(task.team, event, populated);
  return populated;
}

function notifyAssignee(task, req, title) {
  if (task.assignee && String(task.assignee) !== String(req.user._id)) {
    emitToUser(task.assignee, 'notify', {
      title,
      body: `${task.title} (from ${req.user.name})`,
      taskId: task._id,
      teamId: task.team,
    });
  }
}

export const listTeamTasks = asyncHandler(async (req, res) => {
  const q = req.validQuery || {};
  const filter = { team: req.team._id };
  if (q.project) filter.project = q.project;
  if (q.status) filter.status = q.status;
  if (q.assignee === 'me') filter.assignee = req.user._id;
  else if (q.assignee === 'none') filter.assignee = null;
  else if (q.assignee) filter.assignee = q.assignee;

  const tasks = await Task.find(filter).populate(POPULATE).sort({ dueDate: 1, createdAt: -1 });
  res.json({ tasks });
});

// Everything assigned to me across all my teams: the main mobile screen.
export const listMyTasks = asyncHandler(async (req, res) => {
  const teams = await Team.find({ 'members.user': req.user._id }).select('_id');
  const tasks = await Task.find({ team: { $in: teams.map((t) => t._id) }, assignee: req.user._id })
    .populate(POPULATE)
    .sort({ status: 1, dueDate: 1 });
  res.json({ tasks });
});

export const createTask = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.body.project, team: req.team._id });
  if (!project) throw badRequest('Project does not belong to this team');
  ensureAssigneeInTeam(req.team, req.body.assignee);
  // Members may create tasks for themselves; assigning others needs manager.
  if (req.body.assignee && String(req.body.assignee) !== String(req.user._id) && !hasRole(req.teamRole, 'manager')) {
    throw forbidden('Only managers can assign tasks to other members');
  }

  const task = await Task.create({ ...req.body, team: req.team._id, createdBy: req.user._id });
  await logActivity({
    req,
    team: task.team,
    project: task.project,
    task: task._id,
    action: 'task.created',
    message: `${req.user.name} created "${task.title}"`,
  });
  notifyAssignee(task, req, 'New task assigned to you');
  res.status(201).json({ task: await broadcast(task, 'task:created') });
});

export const getTask = asyncHandler(async (req, res) => {
  const { task } = await loadTask(req);
  await task.populate(POPULATE);
  res.json({ task });
});

export const updateTask = asyncHandler(async (req, res) => {
  const { task, team, role } = await loadTask(req);
  const manager = hasRole(role, 'manager');
  if (!manager && !isMine(task, req.user._id)) throw forbidden('You can only update tasks assigned to you');

  const changes = req.body;
  if ('assignee' in changes) {
    ensureAssigneeInTeam(team, changes.assignee);
    const reassigningOthers = changes.assignee && String(changes.assignee) !== String(req.user._id);
    if (!manager && reassigningOthers) throw forbidden('Only managers can reassign tasks to other members');
  }
  if (changes.project && String(changes.project) !== String(task.project)) {
    const ok = await Project.exists({ _id: changes.project, team: team._id });
    if (!ok) throw badRequest('Project does not belong to this team');
  }

  const before = { status: task.status, assignee: task.assignee ? String(task.assignee) : null };
  Object.assign(task, changes);
  await task.save();

  const messages = [];
  if (changes.status && changes.status !== before.status) {
    messages.push(['task.status_changed', `${req.user.name} moved "${task.title}" to ${STATUS_LABEL[task.status]}`]);
  }
  const after = task.assignee ? String(task.assignee) : null;
  if ('assignee' in changes && after !== before.assignee) {
    messages.push(['task.assigned', `${req.user.name} reassigned "${task.title}"`]);
    notifyAssignee(task, req, 'Task assigned to you');
  }
  if (!messages.length) messages.push(['task.updated', `${req.user.name} updated "${task.title}"`]);
  for (const [action, message] of messages) {
    await logActivity({ req, team: task.team, project: task.project, task: task._id, action, message });
  }

  res.json({ task: await broadcast(task, 'task:updated') });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const { task, role } = await loadTask(req);
  if (!hasRole(role, 'manager') && String(task.createdBy) !== String(req.user._id)) {
    throw forbidden('Only managers or the task creator can delete it');
  }
  await task.deleteOne();
  await logActivity({
    req,
    team: task.team,
    project: task.project,
    action: 'task.deleted',
    message: `${req.user.name} deleted "${task.title}"`,
  });
  emitToTeam(task.team, 'task:deleted', { _id: task._id, team: task.team, project: task.project });
  res.status(204).end();
});

// Photo / file proof, typically captured with the phone camera.
export const addAttachment = asyncHandler(async (req, res) => {
  const { task, role } = await loadTask(req);
  if (!req.file) throw badRequest('Attach a file in the "file" field');
  if (!hasRole(role, 'manager') && !isMine(task, req.user._id)) {
    await fs.unlink(req.file.path).catch(() => {});
    throw forbidden('You can only attach files to your own tasks');
  }
  task.attachments.push({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    uploadedBy: req.user._id,
  });
  await task.save();
  await logActivity({
    req,
    team: task.team,
    project: task.project,
    task: task._id,
    action: 'task.attachment_added',
    message: `${req.user.name} attached a file to "${task.title}"`,
  });
  res.status(201).json({ task: await broadcast(task, 'task:updated') });
});

export const removeAttachment = asyncHandler(async (req, res) => {
  const { task, role } = await loadTask(req);
  const att = task.attachments.id(req.params.attachmentId);
  if (!att) throw notFound('Attachment not found');
  if (!hasRole(role, 'manager') && String(att.uploadedBy) !== String(req.user._id)) {
    throw forbidden('You can only remove your own attachments');
  }
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(att.url))).catch(() => {});
  att.deleteOne();
  await task.save();
  res.json({ task: await broadcast(task, 'task:updated') });
});
