import mongoose from 'mongoose';

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    // Permanent per-team serial shown as TF-0001 on web, phone and notifications.
    number: { type: Number, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    estimateHours: { type: Number, default: 2, min: 0.25, max: 200 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    completedAt: { type: Date, default: null },
    attachments: [attachmentSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// New tasks take the next serial from their team's counter (atomic, so two
// tasks created at the same moment never share a number).
taskSchema.pre('save', async function assignSerial(next) {
  if (!this.isNew || this.number) return next();
  try {
    const team = await mongoose
      .model('Team')
      .findByIdAndUpdate(this.team, { $inc: { taskCounter: 1 } }, { new: true, projection: { taskCounter: 1 } });
    if (team) this.number = team.taskCounter;
    next();
  } catch (err) {
    next(err);
  }
});

// Keep completedAt / progress consistent with status, whichever client changed it.
taskSchema.pre('save', function syncCompletion(next) {
  if (this.isModified('status')) {
    if (this.status === 'done') {
      this.completedAt = this.completedAt || new Date();
      this.progress = 100;
    } else {
      this.completedAt = null;
      if (this.progress === 100) this.progress = 90;
    }
  }
  next();
});

export default mongoose.model('Task', taskSchema);
