import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Single-use invite codes. Every code for a team starts with the same three
// letters taken from the team name (e.g. "Bindas" -> BIN), followed by three
// random characters, so each new member gets their own code: BIN7K2, BIN4QX ...
const inviteSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    code: { type: String, required: true, unique: true },
    // Optional note so managers remember who the code was made for.
    label: { type: String, trim: true, maxlength: 60, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unambiguous characters only (no 0/O or 1/I) so codes are easy to read out loud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** First three letters of the team name, uppercased; padded with X if the name is short. */
export function teamPrefix(teamName = '') {
  const letters = teamName.toUpperCase().replace(/[^A-Z]/g, '');
  return (letters + 'XXX').slice(0, 3);
}

function randomSuffix(length = 3) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Create a new unused invite for a team, retrying if the random code is already taken. */
inviteSchema.statics.createFor = async function createFor(team, createdBy, label = '') {
  const prefix = teamPrefix(team.name);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = prefix + randomSuffix();
    try {
      return await this.create({ team: team._id, code, createdBy, label });
    } catch (err) {
      if (err?.code !== 11000) throw err; // duplicate code: try another suffix
    }
  }
  throw new Error('Could not generate a unique invite code, please try again');
};

export default mongoose.model('Invite', inviteSchema);
