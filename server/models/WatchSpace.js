const mongoose = require('mongoose');
const watchSpaceSchema = new mongoose.Schema({
  titleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Title', required: true },
  hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'Movie Night' }, inviteCode: { type: String, unique: true, required: true },
  status: { type: String, enum: ['scheduled','live','ended'], default: 'scheduled' },
  privacy: { type: String, enum: ['invite-only','public'], default: 'invite-only' },
  maxParticipants: { type: Number, default: 25, min: 2, max: 50 },
  aiVerbosity: { type: String, enum: ['minimal','normal','chatty'], default: 'normal' },
  votingEnabled: { type: Boolean, default: true }, locked: { type: Boolean, default: false },
  playback: { state: { type: String, enum: ['play','pause','seek','buffering'], default: 'pause' }, positionSeconds: { type: Number, default: 0 }, updatedAt: { type: Date, default: Date.now } },
  participants: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, joinedAt: Date, leftAt: Date, muted: { type: Boolean, default: false } }],
  peakParticipants: { type: Number, default: 1 }, startedAt: Date, endedAt: Date
}, { timestamps: true });
module.exports = mongoose.model('WatchSpace', watchSpaceSchema);
