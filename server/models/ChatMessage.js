const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  watchSpaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WatchSpace', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  displayName: String, msgType: { type: String, enum: ['chat','ai_answer','system'], default: 'chat' },
  body: { type: String, required: true, maxlength: 1500 }, tsSeconds: Number
}, { timestamps: true });
schema.index({ watchSpaceId: 1, createdAt: -1 });
module.exports = mongoose.model('ChatMessage', schema);
