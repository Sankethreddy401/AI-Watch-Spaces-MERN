# WatchSpace — AI-Driven Hyper-Personalized Interactive Content & Social Watch Spaces

A MERN full-stack implementation of the supplied project specification. It provides JWT authentication, title catalog and timeline metadata, invite-based watch rooms, host-authoritative playback synchronization over Socket.io, persisted room chat, timeline-grounded AI Q&A, trivia cards, approved variation selection, dashboard, and a basic hybrid-style recommendation rail.

> This is an independent educational implementation. It is not affiliated with Netflix and does not connect to Netflix accounts, catalogues, or infrastructure. Use video assets you own or are licensed to use.

## Technology
- React + Vite (JavaScript)
- Node.js + Express REST API
- MongoDB + Mongoose
- Socket.io real-time gateway
- JWT access tokens (1 hour) and rotating refresh tokens (7 days)
- bcrypt password hashing

## Requirements
- Node.js 20+
- npm 10+
- MongoDB 7+ running locally, or a MongoDB Atlas connection string

## Run locally

### 1. Configure backend
```bash
cd server
npm install
cp .env.example .env
```
Edit `server/.env` and set a strong random `JWT_SECRET`, `JWT_REFRESH_SECRET`, and your `MONGODB_URI`.

### 2. Seed demo data
```bash
npm run seed
```
This creates a demo admin and one fictional sample title with timeline metadata.

Demo admin credentials:
- Email: `admin@watchspaces.dev`
- Password: `Admin@12345`

Change the demo password and secrets before using the application beyond local testing.

### 3. Start backend
```bash
npm run dev
```
API and Socket.io: `http://localhost:5000`
Health check: `http://localhost:5000/api/health`

### 4. Start frontend (new terminal)
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173`.

Optional frontend environment file `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

## Main user journey
1. Register a normal user or sign in with the seeded admin.
2. Open Dashboard and select **Create Watch Space**.
3. Select the sample title, create the room and copy its invite code.
4. Open a second browser/incognito session, register another user, and join using the invite code.
5. The host controls playback. Participants receive play/pause/seek updates through Socket.io and gently correct drift when the difference exceeds 250 ms.
6. Chat in real time; ask the AI Co-Pilot questions about timeline entries.
7. Trivia cards appear at authored timestamps. Use **Start vote** to apply an approved variation point.

## Demo content
The seed script creates **The Last Signal**, a 5-minute fictional sample title, and uses a public MDN sample video URL for local demonstration. Replace `videoAssetUrl` with a licensed clip of suitable duration if you want the sample timeline to align precisely with your video. The sample metadata contains scene, trivia, character, glossary, and variation-point events.

## API overview
Base path: `/api/v1`. Authenticated endpoints use `Authorization: Bearer <access-token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login and issue tokens |
| POST | `/auth/refresh` | Rotate refresh token |
| GET | `/auth/me` | Current user |
| GET | `/titles` | List catalog |
| GET | `/titles/:id` | Title and timeline |
| GET | `/titles/:id/timeline?from=&to=` | Timeline range |
| POST | `/titles` | Create title/timeline (admin only) |
| POST | `/watch-spaces` | Create room (host) |
| POST | `/watch-spaces/join` | Join by invite code |
| GET | `/watch-spaces/mine` | User's rooms |
| GET | `/watch-spaces/:id` | Room and recent chat |
| POST | `/watch-spaces/:id/ai/ask` | Timeline-grounded Q&A |
| POST | `/watch-spaces/:id/vote` | Apply an approved variation option |
| POST | `/watch-spaces/:id/end` | End room (host only) |
| GET | `/dashboard` | History, active rooms, recommendations |
| GET | `/dashboard/analytics/:roomId` | Session analytics |

### WebSocket events
Connect to the Socket.io server with `{ auth: { token } }`.

| Event | Direction | Purpose |
|---|---|---|
| `room.join` | Client → Server | Subscribe to a joined room |
| `room.state` | Server → Client | Initial playback snapshot |
| `room.playback.update` | Both | Host playback command / participant update |
| `room.presence.update` | Server → Clients | Participant presence |
| `room.chat.message` | Both | Persist and broadcast chat |
| `room.sync.ping` / `room.sync.pong` | Both | Clock offset measurement primitive |
| `room.variation.applied` | Server → Clients | Approved variation selection |
| `room.error` | Server → Client | Room authorization/validation error |

Common event envelope can be extended to `{ event, watchSpaceId, payload, ts }` as described in the PRD. Current Socket.io handlers use typed event names with payload objects.

## Architecture
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SECURITY.md`](docs/SECURITY.md), and [`docs/TESTING.md`](docs/TESTING.md).

## Important implementation notes and limitations
- AI Q&A uses retrieval over authored timeline metadata and returns source event IDs. It deliberately declines unsupported questions. It is a deterministic RAG-style baseline; connect a hosted LLM in `server/services/aiService.js` if natural-language synthesis is required, while keeping retrieved timeline evidence as the only allowed source.
- Recommendations use genre affinity derived from recorded interactions. This is a baseline hybrid-style ranking, not a trained collaborative-filtering model. Generate more interaction data and add offline Precision@5 evaluation before claiming the PRD KPI.
- Variation selection currently applies an approved option immediately. A timed, multi-user vote with vote deduplication and quorum is a recommended next increment.
- Playback state is stored on the room document and broadcast by the host. For robust drift control, add periodic client reports and server-side correction commands plus ping/pong clock-offset estimation.
- Presence is a lightweight room membership signal. Production-grade disconnect grace periods, host failover, moderator controls, typing indicators, and room locking UI need additional work.
- Analytics are based on persisted events and room metadata; validate against a manually recorded session before reporting metrics.
- The implementation is designed as a local/private project, not a production streaming service. It has no DRM, CDN, payment, or Netflix integration.

## Project structure
```text
AI-Watch-Spaces/
  client/                 React app
  server/                 Express + Socket.io API
    config/               MongoDB connection
    middleware/           JWT and RBAC
    models/               Mongoose schemas
    routes/                REST endpoints
    services/              AI retrieval and recommendations
    sockets/                Real-time room gateway
    seed/                   Demo data
  docs/                    Architecture, security, testing notes
```

## Environment and secrets
Never commit `.env`. `.gitignore` excludes local environment files, dependencies, and build output. Rotate the sample admin password before sharing a deployment.

## Docker (optional)
The compose file provides MongoDB, API and a frontend container. Build and run with:
```bash
# Set strong values in your shell first
export JWT_SECRET='replace-this-with-a-long-random-secret'
export JWT_REFRESH_SECRET='replace-this-with-another-long-random-secret'
docker compose up --build
```
The frontend container serves the built SPA on port 5173. For a production deployment, configure the API/socket URL at build time and use HTTPS.
