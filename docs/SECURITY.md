# Security Notes
- Passwords are hashed using bcrypt with cost 12.
- Access JWTs expire after one hour; refresh JWTs expire after seven days and are stored server-side as SHA-256 hashes. Refresh tokens rotate on use.
- REST routes require a verified access token except registration/login/health.
- Timeline creation is restricted server-side to the `admin` role.
- Playback changes verify the authenticated socket user is the room host.
- Chat content is length-limited and strips HTML tags before persistence.
- Express uses Helmet, CORS allowlisting and API rate limiting.
- MongoDB and JWT secrets are supplied by environment variables; do not commit `.env`.

Before public deployment: add HTTPS, secure refresh-token storage, CSRF protection if cookies are used, stronger schema validation, audit logging, account recovery, socket rate limits, room membership revalidation on every privileged event, and secret rotation.
