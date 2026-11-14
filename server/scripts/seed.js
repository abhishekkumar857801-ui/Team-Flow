// Demo data so the risk dashboard has something interesting to show.
// Usage: npm run seed   (uses MONGO_URI from .env)
// All demo accounts use the password: demo1234
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY);

export async function seed() {
  if (await User.exists({ email: 'asha@teamflow.dev' })) {
    console.log('[seed] demo data already present, skipping');
    return;
  }

  const [asha, rahul, priya] = await User.create([
    { name: 'Asha Rao', email: 'asha@teamflow.dev', password: 'demo1234', weeklyCapacity: 25, avatarColor: '#6366f1' },
    { name: 'Rahul Menon', email: 'rahul@teamflow.dev', password: 'demo1234', weeklyCapacity: 15, avatarColor: '#0ea5e9' },
    { name: 'Priya Shah', email: 'priya@teamflow.dev', password: 'demo1234', weeklyCapacity: 20, avatarColor: '#10b981' },
  ]);

  const team = await Team.create({
    name: 'Coding Club Core Team',
    description: 'Organising the annual hackathon and the club website',
    joinCode: 'DEMO42',
    createdBy: asha._id,
    members: [
      { user: asha._id, role: 'owner' },
      { user: rahul._id, role: 'member' },
      { user: priya._id, role: 'member' },
    ],
  });

  const [hackathon, website] = await Project.create([
    { team: team._id, name: 'Hackathon 2026', description: 'Venue, sponsors, registrations', deadline: inDays(6), color: '#ef4444', createdBy: asha._id, startDate: inDays(-20) },
    { team: team._id, name: 'Club Website Revamp', description: 'New site with events calendar', deadline: inDays(30), color: '#6366f1', createdBy: asha._id, startDate: inDays(-5) },
  ]);

  const t = (project, title, assignee, extra = {}) => ({
    team: team._id,
    project: project._id,
    title,
    assignee: assignee?._id ?? null,
    createdBy: asha._id,
    ...extra,
  });

  await Task.create([
    // Hackathon: tight deadline, Rahul overloaded
    t(hackathon, 'Confirm venue booking', asha, { status: 'done', priority: 'high', estimateHours: 3, dueDate: inDays(-10), completedAt: inDays(-9) }),
    t(hackathon, 'Design registration form', priya, { status: 'done', priority: 'medium', estimateHours: 4, dueDate: inDays(-6), completedAt: inDays(-5) }),
    t(hackathon, 'Email 20 sponsors', rahul, { status: 'in_progress', priority: 'critical', estimateHours: 8, progress: 30, dueDate: inDays(-1) }),
    t(hackathon, 'Prepare problem statements', rahul, { status: 'todo', priority: 'high', estimateHours: 6, dueDate: inDays(2) }),
    t(hackathon, 'Order T-shirts and swag', rahul, { status: 'todo', priority: 'medium', estimateHours: 3, dueDate: inDays(3) }),
    t(hackathon, 'Judging rubric', rahul, { status: 'todo', priority: 'medium', estimateHours: 4, dueDate: inDays(4) }),
    t(hackathon, 'Volunteer schedule', null, { status: 'todo', priority: 'high', estimateHours: 3, dueDate: inDays(4) }),
    t(hackathon, 'Social media countdown posts', priya, { status: 'in_progress', priority: 'low', estimateHours: 2, progress: 50, dueDate: inDays(5) }),
    // Website: comfortable
    t(website, 'Wireframes for home page', priya, { status: 'review', priority: 'medium', estimateHours: 5, progress: 90, dueDate: inDays(7) }),
    t(website, 'Set up React project', asha, { status: 'done', priority: 'medium', estimateHours: 2, dueDate: inDays(-2), completedAt: inDays(-3) }),
    t(website, 'Events calendar component', asha, { status: 'in_progress', priority: 'high', estimateHours: 8, progress: 20, dueDate: inDays(14) }),
    t(website, 'Deploy to Vercel', null, { status: 'todo', priority: 'low', estimateHours: 1, dueDate: inDays(28) }),
  ]);

  await Activity.create({ team: team._id, actor: asha._id, action: 'team.created', message: 'Asha Rao created the team', platform: 'web' });

  console.log('[seed] demo team "Coding Club Core Team" (join code DEMO42)');
  console.log('[seed] logins: asha@ / rahul@ / priya@teamflow.dev, password demo1234');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await connectDB(env.mongoUri);
  await seed();
  await mongoose.disconnect();
}
