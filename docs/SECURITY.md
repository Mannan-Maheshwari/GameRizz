# Gamerizz — Security and Threat Model

## 1. Principles & Objectives
1. **Zero Chat Persistence:** General conversational data is never written to disk or database. Memory state is freed immediately upon match conclusion.
2. **Server-Authoritative Control:** Clients can never submit scores, declare wins, or manipulate timers.
3. **Defense in Depth:** All incoming data (HTTP & WebSockets) is validated against Zod schemas.

---

## 2. Threat Analysis & Mitigations

### 2.1 Cross-Site Scripting (XSS)
- **Risk:** Malicious payloads in nicknames, chat messages, or reports injected into the DOM.
- **Mitigation:** Nicknames and chat texts are strictly rendered as text, stripped of HTML markup/control characters, and escaped on both server and client layers.

### 2.2 Broken Authentication & Session Hijacking
- **Risk:** Guessing active session IDs or hijacking stranger sessions.
- **Mitigation:**
  - Session IDs and session secrets are generated via cryptographically secure `crypto.randomUUID()` and `crypto.randomBytes(32)`.
  - Both `sessionId` and `sessionSecret` are required to resume a session or send authenticated requests.
  - Admin login issues secure HttpOnly, SameSite cookies with bcrypt password hashing (cost factor >= 10).

### 2.3 Game Cheating & State Manipulation
- **Risk:** Modifying scores locally, reading opponent's hidden moves before committing.
- **Mitigation:**
  - Hidden moves (RPS move, Cricket number) are never broadcast until both players have locked in their moves or the turn timer expires.
  - State calculation is exclusively done on the server.

### 2.4 Denial of Service (DoS) & Abuse
- **Risk:** Chat flooding, rapid queue join/cancels, mass reporting.
- **Mitigation:**
  - In-memory rate limiting: Max 5 chat messages per 5s burst.
  - Max 1 move per turn, duplicate submissions rejected idempotently.
  - Reporting terminates match and enforces cooldown; duplicate ticket submission prevention.

### 2.5 Admin Route Protection
- Protected via middleware verifying cryptographic JWT tokens signed by `ADMIN_JWT_SECRET`. Rate limits enforced on `/api/admin/login` (5 attempts per 15 min per IP).
