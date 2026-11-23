import Task from '../models/Task.js';
import Team from '../models/Team.js';

// One-time backfill: tasks created before serial numbers existed get one,
// in creation order per team, and the team counter moves past them.
export async function ensureTaskNumbers() {
  const missing = await Task.find({ $or: [{ number: { $exists: false } }, { number: null }] })
    .select('team createdAt')
    .sort({ createdAt: 1 })
    .lean();
  if (!missing.length) return 0;
  const byTeam = new Map();
  for (const t of missing) {
    const key = String(t.team);
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(t._id);
  }
  for (const [teamId, ids] of byTeam) {
    const team = await Team.findByIdAndUpdate(teamId, { $inc: { taskCounter: ids.length } }, { new: true });
    if (!team) continue;
    let n = team.taskCounter - ids.length;
    await Task.bulkWrite(ids.map((_id) => ({ updateOne: { filter: { _id }, update: { $set: { number: ++n } } } })));
  }
  return missing.length;
}
