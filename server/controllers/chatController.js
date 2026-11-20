import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Project from '../models/Project.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/http.js';
import { hasRole, loadTeamForUser } from '../middleware/team.js';
import { emitToTeam } from '../services/realtime.js';

const SENDER_FIELDS = 'name avatarColor';
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
