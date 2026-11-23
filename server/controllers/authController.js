import fs from 'node:fs/promises';
import path from 'node:path';
import User from '../models/User.js';
import Team from '../models/Team.js';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { emitToTeam } from '../services/realtime.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../utils/http.js';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw conflict('An account with this email already exists');
  const user = await User.create({
    name,
    email,
    password,
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
  });
  res.status(201).json({ token: signToken(user._id), user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw unauthorized('Incorrect email or password');
  res.json({ token: signToken(user._id), user });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user });
});

// Remove a previously uploaded photo file (only files we stored ourselves).
async function deleteOldAvatar(url) {
  if (url && url.startsWith('/uploads/avatar-')) {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
  }
}

// Teammates see the new photo straight away.
async function announceProfileChange(userId) {
  const teams = await Team.find({ 'members.user': userId }).select('_id');
  teams.forEach((t) => emitToTeam(t._id, 'team:updated', { teamId: t._id }));
}

// POST /auth/me/avatar (multipart field "file")
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Choose a photo to upload in the "file" field');
  const old = req.user.avatarUrl;
  req.user.avatarUrl = `/uploads/${req.file.filename}`;
  await req.user.save();
  await deleteOldAvatar(old);
  await announceProfileChange(req.user._id);
  res.json({ user: req.user });
});

// DELETE /auth/me/avatar: back to initials.
export const removeAvatar = asyncHandler(async (req, res) => {
  const old = req.user.avatarUrl;
  req.user.avatarUrl = '';
  await req.user.save();
  await deleteOldAvatar(old);
  await announceProfileChange(req.user._id);
  res.json({ user: req.user });
});
