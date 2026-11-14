import mongoose from 'mongoose';
import Team from '../models/Team.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';

const ROLE_RANK = { member: 1, manager: 2, owner: 3 };

export const hasRole = (role, minimum) => (ROLE_RANK[role] || 0) >= ROLE_RANK[minimum];

// Loads a team the current user belongs to and attaches req.team + req.teamRole.
export async function loadTeamForUser(teamId, userId) {
  if (!mongoose.isValidObjectId(teamId)) throw badRequest('Invalid team id');
  const team = await Team.findById(teamId);
  if (!team) throw notFound('Team not found');
  const role = team.roleOf(userId);
  if (!role) throw forbidden('You are not a member of this team');
  return { team, role };
}

// Route guard for /teams/:teamId/... routes.
export const requireTeamRole = (minimum = 'member') =>
  asyncHandler(async (req, _res, next) => {
    const { team, role } = await loadTeamForUser(req.params.teamId, req.user._id);
    if (!hasRole(role, minimum)) throw forbidden(`This action needs the ${minimum} role`);
    req.team = team;
    req.teamRole = role;
    next();
  });
