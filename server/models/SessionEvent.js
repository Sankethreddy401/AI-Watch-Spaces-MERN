const mongoose = require('mongoose');
module.exports = mongoose.model('SessionEvent', new mongoose.Schema({
  watchSpaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WatchSpace', index: true },
  type: { type: String, required: true }, userId: mongoose.Schema.Types.ObjectId,
  payload: mongoose.Schema.Types.Mixed
}, { timestamps: true }));
