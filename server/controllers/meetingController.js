import mongoose from 'mongoose';
import Meeting, { meetingAlert } from '../models/Meeting.js';
import Project from '../models/Project.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole, loadTeamForUser } from '../middleware/team.js';
import { logActivity } from '../services/activity.js';
import { emitToTeam, emitToUser, getCall, getTeamCalls } from '../services/realtime.js';

const POPULATE = { path: 'createdBy', select: 'name avatarColor avatarUrl' };

async function loadProject(req) {
  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) throw badRequest('Invalid project id');
  const project = await Project.findById(projectId).select('team name color');
  if (!project) throw notFound('Project not found');
  const { team, role } = await loadTeamForUser(project.team, req.user._id);
  return { project, team, role };
}

// GET /projects/:projectId/meetings
// Upcoming and in-progress meetings (soonest first), the last few past ones,
// and whether a live video call is running right now.
export const listMeetings = asyncHandler(async (req, res) => {
  const { project } = await loadProject(req);
  const all = await Meeting.find({ project: project._id }).sort({ startsAt: 1 }).populate(POPULATE);
  const now = Date.now();
  const endOf = (m) => new Date(m.startsAt).getTime() + m.durationMinutes * 60_000;
  const upcoming = all.filter((m) => endOf(m) >= now);
  const past = all.filter((m) => endOf(m) < now).slice(-5).reverse();
  res.json({ upcoming, past, call: getCall(project._id) });
});

export const createMeeting = asyncHandler(async (req, res) => {
  const { project, team, role } = await loadProject(req);
  if (!hasRole(role, 'manager')) throw forbidden('Only the owner or a manager can schedule meetings');

  const recipients = team.members.map((member) => member.user);
  const meeting = await Meeting.create({
    ...req.body,
    project: project._id,
    team: team._id,
    createdBy: req.user._id,
    pendingAlerts: recipients,
  });
  await meeting.populate(POPULATE);

  const when = new Date(meeting.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  await logActivity({
    req,
    team: team._id,
    project: project._id,
    action: 'meeting.scheduled',
    message: `${req.user.name} scheduled "${meeting.title}" for ${when}`,
  });
  emitToTeam(team._id, 'meeting:changed', { projectId: String(project._id) });
  const notification = meetingAlert(meeting, project.name);
  for (const userId of recipients) emitToUser(userId, 'notify', notification);
  const { pendingAlerts, ...visibleMeeting } = meeting.toObject();
  res.status(201).json({ meeting: visibleMeeting });
});

export const deleteMeeting = asyncHandler(async (req, res) => {
  const { project, role } = await loadProject(req);
  if (!hasRole(role, 'manager')) throw forbidden('Only the owner or a manager can cancel meetings');
  const { meetingId } = req.params;
  if (!mongoose.isValidObjectId(meetingId)) throw badRequest('Invalid meeting id');
  const meeting = await Meeting.findOneAndDelete({ _id: meetingId, project: project._id });
  if (!meeting) throw notFound('Meeting not found');
  emitToTeam(project.team, 'meeting:changed', { projectId: String(project._id) });
  res.status(204).end();
});

// GET /teams/:teamId/calls: live meetings running anywhere in the team.
export const listTeamCalls = asyncHandler(async (req, res) => {
  res.json({ calls: getTeamCalls(req.team._id) });
});
