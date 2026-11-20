const Interaction = require('../models/Interaction');
const Title = require('../models/Title');
async function recommend(userId) {
  const [interactions, titles] = await Promise.all([Interaction.find({ userId }), Title.find()]);
  const seen = new Set(interactions.map(i => String(i.titleId)));
  const genreScores = {};
  for (const i of interactions) {
    const title = titles.find(t => String(t._id) === String(i.titleId));
    if (!title) continue;
    const weight = (i.rating || 3) + (i.completed ? 2 : 0) + Math.min(i.watchedSeconds / 600, 2);
    title.genres.forEach(g => genreScores[g] = (genreScores[g] || 0) + weight);
  }
  return titles.filter(t => !seen.has(String(t._id))).map(t => ({ title: t, score: t.genres.reduce((s,g) => s + (genreScores[g] || 0), 0) + (Math.random() * 0.01) }))
    .sort((a,b) => b.score-a.score).slice(0, 10).map(x => ({ ...x.title.toObject(), recommendationScore: Number(x.score.toFixed(2)) }));
}
module.exports = { recommend };
