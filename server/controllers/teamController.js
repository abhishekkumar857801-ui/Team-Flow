import mongoose from 'mongoose';
import Team from '../models/Team.js';
import Invite, { teamPrefix } from '../models/Invite.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole } from '../middleware/team.js';
import { logActivity } from '../services/activity.js';
import { emitToTeam } from '../services/realtime.js';

const MEMBER_FIELDS = 'name email avatarColor weeklyCapacity';

// joinCode is a legacy field (one shared code per team); joining now uses single-use invites.
const withRole = (team, userId) => {
  const { joinCode, ...rest } = team.toObject();
  return { ...rest, myRole: team.roleOf(userId), invitePrefix: teamPrefix(team.name) };
};

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
    Invite.deleteMany({ team: teamId }),
  ]);
  await req.team.deleteOne();
  emitToTeam(teamId, 'team:deleted', { teamId });
  res.status(204).end();
});

// Join with a single-use invite code. The code is used up the moment it is accepted.
export const joinTeam = asyncHandler(async (req, res) => {
  const invite = await Invite.findOne({ code: req.body.joinCode });
  if (!invite) throw notFound('Invalid join code');
  if (invite.usedBy) throw badRequest('This join code has already been used. Ask your manager for a new one.');

  const team = await Team.findById(invite.team);
  if (!team) throw notFound('The team for this code no longer exists');
  // Don't waste the code on someone who is already in the team.
  if (team.roleOf(req.user._id)) throw badRequest('You are already a member of this team');

  // Claim the code atomically so two people can't use it at the same time.
  const claimed = await Invite.findOneAndUpdate(
    { _id: invite._id, usedBy: null },
    { usedBy: req.user._id, usedAt: new Date() },
    { new: true }
  );
  if (!claimed) throw badRequest('This join code has already been used. Ask your manager for a new one.');

  team.members.push({ user: req.user._id, role: 'member' });
  await team.save();
  await logActivity({ req, team: team._id, action: 'team.joined', message: `${req.user.name} joined the team` });
  emitToTeam(team._id, 'team:updated', { teamId: team._id });

  await team.populate('members.user', MEMBER_FIELDS);
  res.json({ team: withRole(team, req.user._id) });
});

export const listInvites = asyncHandler(async (req, res) => {
  const invites = await Invite.find({ team: req.team._id })
    .populate('usedBy', 'name email')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ invites, prefix: teamPrefix(req.team.name) });
});

export const createInvite = asyncHandler(async (req, res) => {
  const invite = await Invite.createFor(req.team, req.user._id, req.body.label);
  await invite.populate('createdBy', 'name');
  res.status(201).json({ invite });
});

// Revoke a code that hasn't been used yet. Used codes stay as a record of who joined.
export const deleteInvite = asyncHandler(async (req, res) => {
  const { inviteId } = req.params;
  if (!mongoose.isValidObjectId(inviteId)) throw badRequest('Invalid invite id');
  const invite = await Invite.findOne({ _id: inviteId, team: req.team._id });
  if (!invite) throw notFound('Invite not found');
  if (invite.usedBy) throw badRequest('This code was already used and cannot be revoked');
  await invite.deleteOne();
  res.status(204).end();
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
