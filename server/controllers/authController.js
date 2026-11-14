import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler, conflict, unauthorized } from '../utils/http.js';

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
