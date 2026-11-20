// Retrieval-grounded Q&A: answers only from the title timeline; no unsupported facts are invented.
function retrieveContext(title, question, currentTs) {
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  return title.timeline.filter(e => e.ts <= currentTs && currentTs - e.ts <= 600)
    .map(e => ({ event: e, score: words.filter(w => `${e.text || ''} ${e.term || ''} ${e.definition || ''} ${e.characterId || ''}`.toLowerCase().includes(w)).length }))
    .filter(x => x.score > 0 || ['character','scene','glossary','trivia'].includes(x.event.type))
    .sort((a,b) => b.score - a.score || b.event.ts - a.event.ts).slice(0, 4).map(x => x.event);
}
function answerQuestion(title, question, currentTs) {
  const events = retrieveContext(title, question, currentTs);
  if (!events.length) return { answer: 'I could not find supporting information for that question in this title’s timeline yet.', sourceEvents: [], grounded: true };
  const facts = events.map(e => e.text || (e.term ? `${e.term}: ${e.definition}` : e.characterId ? `Character: ${e.characterId}` : '')).filter(Boolean);
  return { answer: facts.length ? facts.join(' ') : 'I found related timeline entries, but they do not contain enough detail to answer confidently.', sourceEvents: events.map(e => String(e._id)), grounded: true };
}
function getEventsBetween(title, from, to) { return title.timeline.filter(e => e.ts >= from && e.ts <= to).sort((a,b) => a.ts-b.ts); }
module.exports = { retrieveContext, answerQuestion, getEventsBetween };
