import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Message from '../models/Message.js';
import Meeting from '../models/Meeting.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole, loadTeamForUser } from '../middleware/team.js';
import { logActivity } from '../services/activity.js';
import { emitToTeam } from '../services/realtime.js';

// Loads a project and checks the user belongs to its team.
async function loadProject(req, minimumRole = 'member') {
  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) throw badRequest('Invalid project id');
  const project = await Project.findById(projectId);
  if (!project) throw notFound('Project not found');
  const { team, role } = await loadTeamForUser(project.team, req.user._id);
  if (!hasRole(role, minimumRole)) throw forbidden(`This action needs the ${minimumRole} role`);
  return { project, team, role };
}

async function withCounts(projects) {
  const ids = projects.map((p) => p._id);
  const counts = await Task.aggregate([
    { $match: { project: { $in: ids } } },
    {
      $group: {
        _id: '$project',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      },
    },
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  return projects.map((p) => {
    const c = byId[String(p._id)] || { total: 0, done: 0 };
    return { ...p.toObject(), taskCount: c.total, doneCount: c.done };
  });
}

export const listProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({ team: req.team._id }).sort({ deadline: 1 });
  res.json({ projects: await withCounts(projects) });
});

export const createProject = asyncHandler(async (req, res) => {
  const project = await Project.create({ ...req.body, team: req.team._id, createdBy: req.user._id });
  await logActivity({
    req,
    team: req.team._id,
    project: project._id,
    action: 'project.created',
    message: `${req.user.name} created project "${project.name}"`,
  });
  emitToTeam(req.team._id, 'project:changed', { teamId: req.team._id, projectId: project._id });
  res.status(201).json({ project: (await withCounts([project]))[0] });
});

export const getProject = asyncHandler(async (req, res) => {
  const { project, role } = await loadProject(req);
  res.json({ project: (await withCounts([project]))[0], myRole: role });
});

export const updateProject = asyncHandler(async (req, res) => {
  const { project } = await loadProject(req, 'manager');
  Object.assign(project, req.body);
  await project.save();
  await logActivity({
    req,
    team: project.team,
    project: project._id,
    action: 'project.updated',
    message: `${req.user.name} updated project "${project.name}"`,
  });
  emitToTeam(project.team, 'project:changed', { teamId: project.team, projectId: project._id });
  res.json({ project: (await withCounts([project]))[0] });
});

export const deleteProject = asyncHandler(async (req, res) => {
  const { project } = await loadProject(req, 'manager');
  await Task.deleteMany({ project: project._id });
  await Message.deleteMany({ project: project._id });
  await Meeting.deleteMany({ project: project._id });
  await project.deleteOne();
  await logActivity({
    req,
    team: project.team,
    action: 'project.deleted',
    message: `${req.user.name} deleted project "${project.name}"`,
  });
  emitToTeam(project.team, 'project:changed', { teamId: project.team, projectId: project._id, deleted: true });
  emitToTeam(project.team, 'tasks:refresh', { teamId: project.team });
  res.status(204).end();
});
