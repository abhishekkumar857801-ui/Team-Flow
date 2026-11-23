import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import { hasRole } from '../middleware/team.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Meeting, { meetingAlert } from '../models/Meeting.js';

let io = null;

// Socket.io pushes changes to every open web tab and mobile app instantly,
// which is what makes "update on phone -> appears on web" visible in the demo.
// It also relays WebRTC signalling for the built-in project video calls.
export function initRealtime(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins.includes('*') ? true : corsOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const payload = verifyToken(String(token || ''));
      socket.data.userId = payload.sub;
      const user = await User.findById(payload.sub).select('name avatarColor avatarUrl');
      if (!user) throw new Error('unknown user');
      socket.data.user = { _id: String(user._id), name: user.name, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);


    // Called by clients after they create or join a team.
    socket.on('team:subscribe', async (teamId) => {
      const ok = await Team.exists({ _id: teamId, 'members.user': userId }).catch(() => null);
      if (ok) socket.join(`team:${teamId}`);
    });

    registerCallHandlers(socket);
    socket.on('meeting:alert-seen', async (meetingId) => {
      if (typeof meetingId !== 'string' || !mongoose.isValidObjectId(meetingId)) return;
      try {
        await Meeting.updateOne({ _id: meetingId, pendingAlerts: userId }, { $pull: { pendingAlerts: userId } });
      } catch (error) {
        console.error('Could not acknowledge meeting alert', error);
      }
    });

    try {
      const teams = await Team.find({ 'members.user': userId }).select('_id');
      teams.forEach((team) => socket.join(`team:${team._id}`));
      const pending = await Meeting.find({
        team: { $in: teams.map((team) => team._id) },
        pendingAlerts: userId,
        startsAt: { $gte: new Date() },
      }).sort({ startsAt: 1 }).lean();
      const projects = await Project.find({ _id: { $in: pending.map((meeting) => meeting.project) } }).select('name');
      const names = new Map(projects.map((project) => [String(project._id), project.name]));
      for (const meeting of pending) {
        const name = names.get(String(meeting.project));
        if (name) socket.emit('notify', meetingAlert(meeting, name));
      }
    } catch (error) {
      console.error('Could not load team rooms or meeting alerts', error);
    }
  });

  return io;
}

export function emitToTeam(teamId, event, payload) {
  io?.to(`team:${teamId}`).emit(event, payload);
}

export function revokeTeamAccess(teamId, userId) {
  if (!io) return;
  const teamRoom = `team:${teamId}`;
  const socketIds = io.sockets.adapter.rooms.get(`user:${userId}`);
  for (const socketId of socketIds ?? []) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.leave(teamRoom);
    if (calls.get(socket.data.callProjectId)?.teamId === String(teamId)) {
      socket.emit('call:ended', { projectId: socket.data.callProjectId, reason: 'membership_removed' });
      leaveCall(socket);
    }
  }
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

// ---------------------------------------------------------------------------
// Built-in video calls (one live call per project, WebRTC mesh).
//
// The server never touches audio/video. It only keeps track of who is in each
// call and relays the WebRTC "offer / answer / ICE candidate" messages between
// browsers and phones so they can connect directly to each other.
// ---------------------------------------------------------------------------

const MAX_PARTICIPANTS = 8; // mesh calls get heavy beyond this
const EMPTY_CALL_TIMEOUT_MS = 90_000;

// projectId -> { projectId, teamId, projectName, startedBy, startedAt, participants: Map<socketId, user> }
const calls = new Map();

const callRoom = (projectId) => `call:${projectId}`;

function serializeCall(call) {
  if (!call) return null;
  return {
    projectId: call.projectId,
    teamId: call.teamId,
    projectName: call.projectName,
    startedBy: call.startedBy,
    startedAt: call.startedAt,
    participants: [...call.participants].map(([socketId, user]) => ({ socketId, user })),
  };
}

/** All live calls in a team (for the "meeting in progress" banner). */
export function getTeamCalls(teamId) {
  return [...calls.values()].filter((c) => c.teamId === String(teamId)).map(serializeCall);
}

/** Current live call for a project (or null), safe to send to clients. */
export function getCall(projectId) {
  return serializeCall(calls.get(String(projectId)));
}

// Loads the project and the caller's role in its team; throws a short message on failure.
async function membership(projectId, userId) {
  if (!mongoose.isValidObjectId(projectId)) throw new Error('Invalid project');
  const project = await Project.findById(projectId).select('team name');
  if (!project) throw new Error('Project not found');
  const team = await Team.findOne({ _id: project.team, 'members.user': userId });
  if (!team) throw new Error('You are not a member of this team');
  return { project, team, role: team.roleOf(userId) };
}

function broadcastCallState(call) {
  emitToTeam(call.teamId, 'call:updated', { projectId: call.projectId, call: serializeCall(call) });
}

function endCall(projectId, reason = 'ended') {
  const call = calls.get(projectId);
  if (!call) return;
  clearTimeout(call.emptyTimer);
  calls.delete(projectId);
  for (const socketId of call.participants.keys()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.data.callProjectId = null;
  }
  io.to(callRoom(projectId)).to(`team:${call.teamId}`).emit('call:ended', { projectId, reason });
  io.in(callRoom(projectId)).socketsLeave(callRoom(projectId));
}

function scheduleEmptyCheck(call) {
  clearTimeout(call.emptyTimer);
  call.emptyTimer = setTimeout(() => {
    if (calls.get(call.projectId) === call && call.participants.size === 0) endCall(call.projectId, 'empty');
  }, EMPTY_CALL_TIMEOUT_MS);
}

function leaveCall(socket) {
  const projectId = socket.data.callProjectId;
  if (!projectId) return;
  socket.data.callProjectId = null;
  socket.leave(callRoom(projectId));
  const call = calls.get(projectId);
  if (!call) return;
  call.participants.delete(socket.id);
  socket.to(callRoom(projectId)).emit('call:peer-left', { projectId, socketId: socket.id });
  if (call.participants.size === 0) endCall(projectId, 'empty');
  else broadcastCallState(call);
}

function registerCallHandlers(socket) {
  const userId = socket.data.userId;
  const safe = (handler) => async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      reply({ ok: true, ...(await handler(payload || {})) });
    } catch (err) {
      reply({ ok: false, error: err.message || 'Something went wrong' });
    }
  };

  // Owner/manager starts the live call for a project; the team is notified.
  socket.on('call:start', safe(async ({ projectId }) => {
    const { project, team, role } = await membership(projectId, userId);
    if (!hasRole(role, 'manager')) throw new Error('Only the owner or a manager can start a meeting');
    const id = String(project._id);
    if (calls.has(id)) return { call: getCall(id), alreadyRunning: true };

    const call = {
      projectId: id,
      teamId: String(team._id),
      projectName: project.name,
      startedBy: socket.data.user,
      startedAt: new Date(),
      participants: new Map(),
    };
    calls.set(id, call);
    scheduleEmptyCheck(call);
    emitToTeam(team._id, 'call:started', { projectId: id, call: serializeCall(call) });
    for (const m of team.members) {
      if (String(m.user) === String(userId)) continue;
      emitToUser(m.user, 'notify', {
        title: `Meeting started · ${project.name}`,
        body: `${socket.data.user.name} started a video meeting. Tap to join.`,
        projectId: id,
        teamId: String(team._id),
        kind: 'call',
      });
    }
    return { call: serializeCall(call) };
  }));

  // Join the running call: returns the people already in it. The newcomer then
  // sends a WebRTC offer to each of them (so two sides never offer at once).
  socket.on('call:join', safe(async ({ projectId }) => {
    await membership(projectId, userId);
    const id = String(projectId);
    const call = calls.get(id);
    if (!call) throw new Error('This meeting has ended');
    if (socket.data.callProjectId && socket.data.callProjectId !== id) leaveCall(socket);
    if (!call.participants.has(socket.id) && call.participants.size >= MAX_PARTICIPANTS) {
      throw new Error(`This meeting is full (max ${MAX_PARTICIPANTS} people)`);
    }
    const peers = [...call.participants]
      .filter(([socketId]) => socketId !== socket.id) // re-joining from the same connection
      .map(([socketId, user]) => ({ socketId, user }));
    call.participants.set(socket.id, socket.data.user);
    clearTimeout(call.emptyTimer);
    socket.data.callProjectId = id;
    socket.join(callRoom(id));
    socket.to(callRoom(id)).emit('call:peer-joined', { projectId: id, socketId: socket.id, user: socket.data.user });
    broadcastCallState(call);
    return { peers, call: serializeCall(call), me: socket.id };
  }));

  // Relay an offer / answer / ICE candidate to one other person in the same call.
  socket.on('call:signal', ({ to, data } = {}) => {
    const projectId = socket.data.callProjectId;
    const call = projectId && calls.get(projectId);
    if (!call || !call.participants.has(socket.id) || !call.participants.has(to)) return;
    io.to(to).emit('call:signal', { from: socket.id, data });
  });

  // Mic / camera on-off, so others can show a "muted" badge.
  socket.on('call:media', ({ audio, video } = {}) => {
    const projectId = socket.data.callProjectId;
    if (!projectId) return;
    socket.to(callRoom(projectId)).emit('call:peer-media', { socketId: socket.id, audio: !!audio, video: !!video });
  });

  socket.on('call:leave', safe(async () => {
    leaveCall(socket);
    return {};
  }));

  // Owner/manager ends the meeting for everyone.
  socket.on('call:end', safe(async ({ projectId }) => {
    const { role } = await membership(projectId, userId);
    if (!hasRole(role, 'manager')) throw new Error('Only the owner or a manager can end the meeting for everyone');
    endCall(String(projectId), 'ended');
    return {};
  }));

  socket.on('disconnect', () => leaveCall(socket));
}
