import { z } from 'zod';
import mongoose from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.js';
import { PROJECT_STATUSES } from '../models/Project.js';

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'must be a valid id');
const nullableId = z.preprocess((v) => (v === '' ? null : v), objectId.nullable());
const date = z.coerce.date({ invalid_type_error: 'must be a valid date' });
const nullableDate = z.preprocess((v) => (v === '' ? null : v), z.union([z.null(), date]));
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #6366f1');

export const auth = {
  register: z.object({
    name: z.string().trim().min(2, 'must be at least 2 characters').max(80),
    email: z.string().trim().toLowerCase().email('must be a valid email'),
    password: z.string().min(6, 'must be at least 6 characters').max(128),
  }),
  login: z.object({
    email: z.string().trim().toLowerCase().email('must be a valid email'),
    password: z.string().min(1, 'is required'),
  }),
  updateMe: z
    .object({
      name: z.string().trim().min(2).max(80),
      weeklyCapacity: z.coerce.number().min(1).max(80),
      avatarColor: hexColor,
    })
    .partial(),
};

export const team = {
  create: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional(),
  }),
  update: z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500) }).partial(),
  join: z.object({ joinCode: z.string().trim().toUpperCase().length(6, 'must be 6 characters') }),
  invite: z.object({ label: z.string().trim().max(60).optional().default('') }),
  memberRole: z.object({ role: z.enum(['manager', 'member']) }),
};

export const project = {
  create: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: date.optional(),
    deadline: date,
    status: z.enum(PROJECT_STATUSES).optional(),
    color: hexColor.optional(),
  }),
};
project.update = project.create.partial();

const taskBase = {
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  assignee: nullableId.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: nullableDate.optional(),
  estimateHours: z.coerce.number().min(0.25).max(200).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
};

export const task = {
  create: z.object({ ...taskBase, project: objectId }),
  update: z.object({ ...taskBase, project: objectId.optional() }).partial(),
  listQuery: z.object({
    project: objectId.optional(),
    assignee: z.union([objectId, z.literal('me'), z.literal('none')]).optional(),
    status: z.enum(TASK_STATUSES).optional(),
  }),
};

export const chat = {
  send: z.object({ text: z.string().trim().min(1, 'Message cannot be empty').max(2000) }),
};

export const meeting = {
  create: z.object({
    title: z.string().trim().min(2).max(120),
    agenda: z.string().trim().max(2000).optional(),
    startsAt: date,
    durationMinutes: z.coerce.number().int().min(5).max(600).optional(),
    // Optional outside link (Google Meet, Zoom, Teams...). Empty = built-in video call.
    link: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v), 'Link must start with https://')
      .optional(),
  }),
};
