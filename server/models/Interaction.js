const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Title', required: true },
  watchedSeconds: { type: Number, default: 0 }, completed: { type: Boolean, default: false },
  rating: { type: Number, min: 1, max: 5 }, coWatchedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });
schema.index({ userId: 1, titleId: 1 });
module.exports = mongoose.model('Interaction', schema);
