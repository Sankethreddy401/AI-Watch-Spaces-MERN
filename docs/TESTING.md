# Testing and Acceptance Checklist

Run backend tests with `cd server && npm test` (test suite to be expanded alongside features).

## Manual end-to-end test
- [ ] Register two users in separate browser sessions.
- [ ] Create a Watch Space with user A and copy invite code.
- [ ] Join as user B and confirm room presence.
- [ ] Play, pause and seek as host; verify participant follows.
- [ ] Send chat from both users and verify both receive messages.
- [ ] Ask a question about a seeded timeline fact; verify answer includes source event IDs.
- [ ] Ask an unsupported question; verify the assistant declines to invent an answer.
- [ ] Wait for an authored trivia timestamp and verify contextual card appears.
- [ ] Apply a pre-approved variation point and verify event reaches room members.
- [ ] End room as host and inspect dashboard history/analytics.
- [ ] Attempt host playback event using participant socket and verify rejection.
- [ ] Attempt title creation using viewer token and verify HTTP 403.

## Performance measurements to record
Use at least 3 clients for a local baseline and record actual measured values. Do not claim the PRD's P95 or concurrency targets without running a repeatable test. Measure API P95, socket fan-out time, participant playback drift and AI request latency.
