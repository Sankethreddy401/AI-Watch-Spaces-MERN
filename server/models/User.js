const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['viewer','host','admin'], default: 'viewer' },
  preferences: { subtitleLocale: { type: String, default: 'en' }, genreAffinity: [String] },
  refreshTokenHash: String
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
