import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { asyncHandler } from '../utils/http.js';
import { analyzeTeam } from '../services/risk.js';

const MEMBER_FIELDS = 'name email avatarColor weeklyCapacity';

// GET /api/teams/:teamId/dashboard: the workload & deadline risk dashboard.
export const getDashboard = asyncHandler(async (req, res) => {
  await req.team.populate('members.user', MEMBER_FIELDS);
  const [projects, tasks] = await Promise.all([
    Project.find({ team: req.team._id, status: { $ne: 'completed' } }).lean(),
    Task.find({ team: req.team._id })
      .populate('assignee', 'name avatarColor')
      .populate('project', 'name color')
      .lean(),
  ]);
  const members = req.team.members.filter((m) => m.user); // skip deleted users
  res.json(analyzeTeam({ members, projects, tasks }));
});

export const getActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const activity = await Activity.find({ team: req.team._id })
    .populate('actor', 'name avatarColor')
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({ activity });
});

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote, escape quotes, and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const exportTasksCsv = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ team: req.team._id })
    .populate('assignee', 'name email')
    .populate('project', 'name')
    .sort({ project: 1, dueDate: 1 })
    .lean();
  const header = ['Project', 'Task', 'Assignee', 'Status', 'Priority', 'Due date', 'Estimate (h)', 'Progress %', 'Completed at'];
  const rows = tasks.map((t) => [
    t.project?.name,
    t.title,
    t.assignee?.name || 'Unassigned',
    t.status,
    t.priority,
    t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '',
    t.estimateHours,
    t.progress,
    t.completedAt ? new Date(t.completedAt).toISOString() : '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const filename = `${req.team.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-tasks.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
