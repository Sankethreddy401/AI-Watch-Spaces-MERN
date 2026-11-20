const mongoose = require('mongoose');
const timelineSchema = new mongoose.Schema({
  ts: { type: Number, required: true, min: 0 },
  endTs: { type: Number, min: 0 },
  type: { type: String, enum: ['scene','trivia','character','glossary','variationPoint','subtitle'], required: true },
  text: String,
  characterId: String,
  term: String,
  definition: String,
  variationId: String,
  options: [{ id: String, label: String, locale: String, assetRef: String }]
}, { _id: true });
const titleSchema = new mongoose.Schema({
  name: { type: String, required: true }, description: String,
  durationSeconds: { type: Number, required: true }, genres: [String],
  videoAssetUrl: { type: String, required: true }, posterUrl: String,
  timeline: [timelineSchema], subtitles: [{ locale: String, url: String, version: Number }]
}, { timestamps: true });
titleSchema.index({ 'timeline.ts': 1 });
module.exports = mongoose.model('Title', titleSchema);
