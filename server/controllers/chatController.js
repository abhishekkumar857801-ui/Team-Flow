import multer from 'multer';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Project from '../models/Project.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole, loadTeamForUser } from '../middleware/team.js';
import { emitToTeam } from '../services/realtime.js';

const SENDER_FIELDS = 'name avatarColor avatarUrl';
const PAGE_SIZE = 50;

// Any member of the project's team may use its chat.
async function loadProjectForChat(req) {
  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) throw badRequest('Invalid project id');
  const project = await Project.findById(projectId).select('team name');
  if (!project) throw notFound('Project not found');
  const { role } = await loadTeamForUser(project.team, req.user._id);
  return { project, role };
}

// GET /projects/:projectId/messages?before=<ISO date>
// Returns up to 50 messages, oldest first, plus whether older ones exist.
export const listMessages = asyncHandler(async (req, res) => {
  const { project } = await loadProjectForChat(req);
  const filter = { project: project._id };
  if (req.query.before) {
    const before = new Date(String(req.query.before));
    if (Number.isNaN(before.getTime())) throw badRequest('Invalid "before" date');
    filter.createdAt = { $lt: before };
  }
  const newestFirst = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE + 1)
    .populate('sender', SENDER_FIELDS);
  const hasMore = newestFirst.length > PAGE_SIZE;
  res.json({ messages: newestFirst.slice(0, PAGE_SIZE).reverse(), hasMore });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { project } = await loadProjectForChat(req);
  const message = await Message.create({
    project: project._id,
    team: project.team,
    sender: req.user._id,
    text: req.body.text,
  });
  await message.populate('sender', SENDER_FIELDS);
  emitToTeam(project.team, 'chat:message', { projectId: String(project._id), message });
  res.status(201).json({ message });
});

// The sender can delete their own message; the owner or a manager can delete any.
export const deleteMessage = asyncHandler(async (req, res) => {
  const { project, role } = await loadProjectForChat(req);
  const { messageId } = req.params;
  if (!mongoose.isValidObjectId(messageId)) throw badRequest('Invalid message id');
  const message = await Message.findOne({ _id: messageId, project: project._id });
  if (!message) throw notFound('Message not found');
  if (String(message.sender) !== String(req.user._id) && !hasRole(role, 'manager')) {
    throw forbidden('You can only delete your own messages');
  }
  await message.deleteOne();
  emitToTeam(project.team, 'chat:deleted', { projectId: String(project._id), messageId: String(message._id) });
  res.status(204).end();
});

export const authorizePhotoUpload = asyncHandler(async (req, _res, next) => {
  req.chatProject = (await loadProjectForChat(req)).project;
  next();
});

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 },
}).single('file');

export const sendPhoto = asyncHandler(async (req, res) => {
  const bytes = req.file?.buffer;
  let photoType;
  if (bytes?.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) photoType = 'image/jpeg';
  if (bytes?.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) photoType = 'image/png';
  if (bytes?.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') photoType = 'image/webp';
  if (!photoType) throw badRequest('Choose a JPG, PNG or WebP photo.');

  const project = req.chatProject;
  const saved = await Message.create({
    project: project._id,
    team: project.team,
    sender: req.user._id,
    photoType,
    photo: bytes,
  });
  const message = saved.toObject();
  delete message.photo;
  await Message.populate(message, { path: 'sender', select: SENDER_FIELDS });
  emitToTeam(project.team, 'chat:message', { projectId: String(project._id), message });
  res.status(201).json({ message });
});

export const readPhoto = asyncHandler(async (req, res) => {
  const { project } = await loadProjectForChat(req);
  const { messageId } = req.params;
  if (!mongoose.isValidObjectId(messageId)) throw badRequest('Invalid message id');
  const message = await Message.findOne({ _id: messageId, project: project._id }).select('photoType +photo');
  if (!message?.photo || !message.photoType) throw notFound('Photo not found');
  res.set('Cache-Control', 'private, no-store').type(message.photoType).send(message.photo);
});
