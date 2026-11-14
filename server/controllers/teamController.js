import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole } from '../middleware/team.js';
import { logActivity } from '../services/activity.js';
import { emitToTeam } from '../services/realtime.js';

const MEMBER_FIELDS = 'name email avatarColor weeklyCapacity';

const withRole = (team, userId) => ({ ...team.toObject(), myRole: team.roleOf(userId) });

export const listMyTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ 'members.user': req.user._id })
    .populate('members.user', MEMBER_FIELDS)
    .sort({ createdAt: -1 });
  res.json({ teams: teams.map((t) => withRole(t, req.user._id)) });
});

export const createTeam = asyncHandler(async (req, res) => {
  const team = await Team.create({
    ...req.body,
    createdBy: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }],
  });
  await team.populate('members.user', MEMBER_FIELDS);
  await logActivity({ req, team: team._id, action: 'team.created', message: `${req.user.name} created the team` });
  res.status(201).json({ team: withRole(team, req.user._id) });
});

export const getTeam = asyncHandler(async (req, res) => {
  await req.team.populate('members.user', MEMBER_FIELDS);
  res.json({ team: withRole(req.team, req.user._id) });
});

export const updateTeam = asyncHandler(async (req, res) => {
  Object.assign(req.team, req.body);
  await req.team.save();
  await req.team.populate('members.user', MEMBER_FIELDS);
  emitToTeam(req.team._id, 'team:updated', { teamId: req.team._id });
  res.json({ team: withRole(req.team, req.user._id) });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const teamId = req.team._id;
  await Promise.all([
    Task.deleteMany({ team: teamId }),
    Project.deleteMany({ team: teamId }),
    Activity.deleteMany({ team: teamId }),
  ]);
  await req.team.deleteOne();
  emitToTeam(teamId, 'team:deleted', { teamId });
  res.status(204).end();
});

export const joinTeam = asyncHandler(async (req, res) => {
  const team = await Team.findOne({ joinCode: req.body.joinCode });
  if (!team) throw notFound('No team found with that join code');
  if (!team.roleOf(req.user._id)) {
    team.members.push({ user: req.user._id, role: 'member' });
    await team.save();
    await logActivity({ req, team: team._id, action: 'team.joined', message: `${req.user.name} joined the team` });
    emitToTeam(team._id, 'team:updated', { teamId: team._id });
  }
  await team.populate('members.user', MEMBER_FIELDS);
  res.json({ team: withRole(team, req.user._id) });
});

export const regenerateJoinCode = asyncHandler(async (req, res) => {
  req.team.joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  await req.team.save();
  res.json({ joinCode: req.team.joinCode });
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) throw badRequest('Invalid user id');
  const member = req.team.members.find((m) => String(m.user) === userId);
  if (!member) throw notFound('Member not found');
  if (member.role === 'owner') throw forbidden('The owner role cannot be changed');
  member.role = req.body.role;
  await req.team.save();
  emitToTeam(req.team._id, 'team:updated', { teamId: req.team._id });
  res.json({ ok: true });
});

// Managers can remove members; any member can remove themselves (leave).
export const removeMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const isSelf = String(req.user._id) === userId;
  if (!isSelf && !hasRole(req.teamRole, 'manager')) throw forbidden('Only managers can remove members');
  const member = req.team.members.find((m) => String(m.user) === userId);
  if (!member) throw notFound('Member not found');
  if (member.role === 'owner') throw forbidden('The owner cannot leave or be removed. Delete the team instead.');

  req.team.members = req.team.members.filter((m) => String(m.user) !== userId);
  await req.team.save();
  // Their open tasks go back to the unassigned pool.
  await Task.updateMany({ team: req.team._id, assignee: userId, status: { $ne: 'done' } }, { assignee: null });
  emitToTeam(req.team._id, 'team:updated', { teamId: req.team._id });
  emitToTeam(req.team._id, 'tasks:refresh', { teamId: req.team._id });
  res.json({ ok: true });
});
