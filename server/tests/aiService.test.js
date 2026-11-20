const { answerQuestion, getEventsBetween } = require('../services/aiService');
const mongoose = require('mongoose');
const title = { timeline: [
  { _id: new mongoose.Types.ObjectId(), ts: 10, type: 'character', characterId: 'Dr. Maya Chen', text: 'Dr. Maya Chen is the lead scientist monitoring the signal.' },
  { _id: new mongoose.Types.ObjectId(), ts: 20, type: 'glossary', term: 'Telemetry', definition: 'Automated measurement and transmission of data.' },
  { _id: new mongoose.Types.ObjectId(), ts: 40, type: 'trivia', text: 'The signal repeats every 17 seconds.' }
]};
test('answers with grounded timeline facts and source ids', () => {
  const result = answerQuestion(title, 'Who is Dr Maya Chen?', 30);
  expect(result.answer).toContain('lead scientist');
  expect(result.sourceEvents.length).toBeGreaterThan(0);
  expect(result.grounded).toBe(true);
});
test('does not use future timeline events', () => {
  const result = answerQuestion(title, 'What happens with the signal?', 15);
  expect(result.sourceEvents).not.toContain(String(title.timeline[2]._id));
});
test('returns no invented facts when metadata has no relevant context', () => {
  const result = answerQuestion({timeline:[]}, 'What is the capital of France?', 100);
  expect(result.sourceEvents).toEqual([]);
  expect(result.answer).toMatch(/could not find supporting information/i);
});
test('timeline range is sorted and bounded', () => {
  expect(getEventsBetween(title, 15, 35).map(e=>e.ts)).toEqual([20]);
});
