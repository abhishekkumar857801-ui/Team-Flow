import mongoose from 'mongoose';

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed'];

const projectSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    startDate: { type: Date, default: Date.now },
    deadline: { type: Date, required: true },
    status: { type: String, enum: PROJECT_STATUSES, default: 'active' },
    color: { type: String, default: '#6366f1' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
