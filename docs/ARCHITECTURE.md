# Architecture Overview

## Components
1. **React SPA** — authentication, dashboard, title selection, room UI, video player, chat and AI panel.
2. **Express API** — authentication, catalog/timeline, room lifecycle, grounded AI Q&A, recommendations and analytics.
3. **Socket.io gateway** — JWT-authenticated room channels for playback, chat, presence and approved variation events.
4. **AI Content Engine** — timestamp-aware retrieval over each title's authored timeline. It returns only facts present in retrieved events and exposes source event IDs.
5. **MongoDB** — users, titles/timelines, watch spaces, chat messages, interactions and session events.

## Data model
- `User`: identity, password hash, role and subtitle preferences.
- `Title`: media metadata, genres, video URL, subtitles and embedded timeline events.
- `WatchSpace`: host, invite code, room settings, participants, playback snapshot and lifecycle timestamps.
- `ChatMessage`: persisted chat and AI answers.
- `Interaction`: watched duration, completion, rating and co-watch data.
- `SessionEvent`: event log used by analytics.

## Playback flow
1. Host creates a room through `POST /watch-spaces`; host is added as first participant.
2. Participant submits invite code to `/watch-spaces/join`.
3. Authenticated socket subscribes with `room.join` after API membership validation.
4. Host sends `room.playback.update`; server verifies host identity, persists current room snapshot and broadcasts to the room.
5. Participants compare local and authoritative positions and correct when drift exceeds 250 ms.

## AI flow
The API loads the title timeline, selects relevant entries at or before the current timestamp (last 10 minutes), scores text matches against question terms, and returns a grounded answer plus source event IDs. If no supporting context exists, it declines to answer.

## Recommendation flow
Interactions generate genre-affinity weights. Unwatched titles are ranked using accumulated genre scores. This is an initial ranking baseline; a held-out Precision@5 evaluation and collaborative filtering component are future work.
