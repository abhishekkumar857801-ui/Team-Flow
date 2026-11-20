import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { requireTeamRole } from '../middleware/team.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import * as S from '../validators/schemas.js';
import * as auth from '../controllers/authController.js';
import * as teams from '../controllers/teamController.js';
import * as projects from '../controllers/projectController.js';
import * as tasks from '../controllers/taskController.js';
import * as chat from '../controllers/chatController.js';
import * as dashboard from '../controllers/dashboardController.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

router.get('/health', (_req, res) => res.json({ ok: true, service: 'teamflow-api', time: new Date() }));

// ---- Auth (shared accounts for web + mobile) ----
router.post('/auth/register', authLimiter, validate({ body: S.auth.register }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: S.auth.login }), auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/me', requireAuth, validate({ body: S.auth.updateMe }), auth.updateMe);

// Everything below needs a valid token.
router.use(requireAuth);

// ---- Teams ----
router.get('/teams', teams.listMyTeams);
router.post('/teams', validate({ body: S.team.create }), teams.createTeam);
router.post('/teams/join', validate({ body: S.team.join }), teams.joinTeam);
router.get('/teams/:teamId', requireTeamRole('member'), teams.getTeam);
router.patch('/teams/:teamId', requireTeamRole('manager'), validate({ body: S.team.update }), teams.updateTeam);
router.delete('/teams/:teamId', requireTeamRole('owner'), teams.deleteTeam);
router.get('/teams/:teamId/invites', requireTeamRole('manager'), teams.listInvites);
router.post('/teams/:teamId/invites', requireTeamRole('manager'), validate({ body: S.team.invite }), teams.createInvite);
router.delete('/teams/:teamId/invites/:inviteId', requireTeamRole('manager'), teams.deleteInvite);
router.patch(
  '/teams/:teamId/members/:userId',
  requireTeamRole('owner'),
  validate({ body: S.team.memberRole }),
  teams.updateMemberRole
);
router.delete('/teams/:teamId/members/:userId', requireTeamRole('member'), teams.removeMember);

// ---- Dashboard, activity, reports ----
router.get('/teams/:teamId/dashboard', requireTeamRole('member'), dashboard.getDashboard);
router.get('/teams/:teamId/activity', requireTeamRole('member'), dashboard.getActivity);
router.get('/teams/:teamId/reports/tasks.csv', requireTeamRole('member'), dashboard.exportTasksCsv);

// ---- Projects ----
router.get('/teams/:teamId/projects', requireTeamRole('member'), projects.listProjects);
router.post('/teams/:teamId/projects', requireTeamRole('manager'), validate({ body: S.project.create }), projects.createProject);
router.get('/projects/:projectId', projects.getProject);
router.patch('/projects/:projectId', validate({ body: S.project.update }), projects.updateProject);
router.delete('/projects/:projectId', projects.deleteProject);

// ---- Project chat (any team member) ----
router.get('/projects/:projectId/messages', chat.listMessages);
router.post('/projects/:projectId/messages', validate({ body: S.chat.send }), chat.sendMessage);
router.delete('/projects/:projectId/messages/:messageId', chat.deleteMessage);

// ---- Tasks ----
router.get('/tasks/mine', tasks.listMyTasks);
router.get('/teams/:teamId/tasks', requireTeamRole('member'), validate({ query: S.task.listQuery }), tasks.listTeamTasks);
router.post('/teams/:teamId/tasks', requireTeamRole('manager'), validate({ body: S.task.create }), tasks.createTask);
router.get('/tasks/:taskId', tasks.getTask);
router.patch('/tasks/:taskId', validate({ body: S.task.update }), tasks.updateTask);
router.delete('/tasks/:taskId', tasks.deleteTask);
router.post('/tasks/:taskId/attachments', upload.single('file'), tasks.addAttachment);
router.delete('/tasks/:taskId/attachments/:attachmentId', tasks.removeAttachment);

export default router;
