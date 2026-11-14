import Activity from '../models/Activity.js';
import { emitToTeam } from './realtime.js';

export async function logActivity({ req, team, project = null, task = null, action, message }) {
  const doc = await Activity.create({
    team,
    project,
    task,
    actor: req.user._id,
    action,
    message,
    platform: req.platform || 'api',
  });
  const populated = await doc.populate('actor', 'name avatarColor');
  emitToTeam(team, 'activity:new', populated);
  return populated;
}
