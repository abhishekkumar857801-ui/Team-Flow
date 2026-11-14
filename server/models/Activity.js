import mongoose from 'mongoose';

// Audit trail: who did what, from which platform. Powers the activity feed
// and lets the demo show "updated from mobile" next to web changes.
const activitySchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g. task.created, task.status_changed
    message: { type: String, required: true },
    platform: { type: String, enum: ['web', 'mobile', 'api'], default: 'api' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ team: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
