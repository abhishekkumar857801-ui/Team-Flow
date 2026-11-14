import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { asyncHandler, unauthorized } from '../utils/http.js';

export const signToken = (userId) => jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

// Requires "Authorization: Bearer <token>". Same token works for web and mobile.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Session expired or invalid token. Please sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  req.user = user;
  // Clients send X-Client: web | mobile so the activity feed can show the source.
  const client = String(req.headers['x-client'] || '').toLowerCase();
  req.platform = ['web', 'mobile'].includes(client) ? client : 'api';
  next();
});
