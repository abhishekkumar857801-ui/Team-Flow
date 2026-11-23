import mongoose from 'mongoose';

// One chat message inside a project. Every member of the project's team can
// read and post; messages are pushed live to web and mobile over Socket.io.
const messageSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '', trim: true, maxlength: 2000 },
    photoType: String,
    photo: { type: Buffer, select: false },
  },
  { timestamps: true }
);

// Newest-first paging within a project.
messageSchema.index({ project: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
