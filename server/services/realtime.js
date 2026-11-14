import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import Team from '../models/Team.js';

let io = null;

// Socket.io pushes changes to every open web tab and mobile app instantly,
// which is what makes "update on phone -> appears on web" visible in the demo.
export function initRealtime(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins.includes('*') ? true : corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const payload = verifyToken(String(token || ''));
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    const teams = await Team.find({ 'members.user': userId }).select('_id');
    teams.forEach((t) => socket.join(`team:${t._id}`));

    // Called by clients after they create or join a team.
    socket.on('team:subscribe', async (teamId) => {
      const ok = await Team.exists({ _id: teamId, 'members.user': userId }).catch(() => null);
      if (ok) socket.join(`team:${teamId}`);
    });
  });

  return io;
}

export function emitToTeam(teamId, event, payload) {
  io?.to(`team:${teamId}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
