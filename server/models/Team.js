import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const TEAM_ROLES = ['owner', 'manager', 'member'];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: TEAM_ROLES, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    // Legacy shared join code, no longer used for joining (see models/Invite.js).
    // Kept so the existing unique index in the database stays valid.
    joinCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(3).toString('hex').toUpperCase(),
    },
    members: [memberSchema],
    // Running count used to give every task a permanent serial (TF-0001, TF-0002 ...).
    taskCounter: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

teamSchema.index({ 'members.user': 1 });

teamSchema.methods.roleOf = function roleOf(userId) {
  const m = this.members.find((x) => String(x.user?._id ?? x.user) === String(userId));
  return m ? m.role : null;
};

export default mongoose.model('Team', teamSchema);
