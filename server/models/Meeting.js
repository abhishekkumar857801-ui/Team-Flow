import mongoose from 'mongoose';

// A scheduled meeting for a project. It can carry an outside link (Google Meet,
// Zoom...) or be held with TeamFlow's built-in video call (link left empty).
const meetingSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    agenda: { type: String, trim: true, maxlength: 2000, default: '' },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 5, max: 600, default: 30 },
    link: { type: String, trim: true, maxlength: 500, default: '' },
    pendingAlerts: { type: [mongoose.Schema.Types.ObjectId], select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

meetingSchema.index({ project: 1, startsAt: 1 });

meetingSchema.index({ pendingAlerts: 1, startsAt: 1 });

export function meetingAlert(meeting, projectName) {
  return {
    kind: 'scheduled-meeting',
    meetingId: String(meeting._id),
    projectId: String(meeting.project),
    teamId: String(meeting.team),
    title: `Meeting scheduled · ${projectName}`,
    body: meeting.title,
    startsAt: meeting.startsAt,
  };
}

export default mongoose.model('Meeting', meetingSchema);
