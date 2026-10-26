# Gamerizz — Architecture Document

## 1. Overview
Gamerizz is architected as a modular monolith optimized for zero-cost deployment, real-time synchronization, and server-authoritative casual browser gaming. 

```text
+-------------------------------------------------------+
|                 Client (React + Vite)                 |
|  - Guest Lobby & Nickname Editor                      |
|  - Game Selector & Queue Status                       |
|  - Split Panel: Game Engine View + Real-Time Chat     |
|  - Report/Block Modal & Admin Dashboard UI            |
+--------------------------+----------------------------+
                           |
            HTTPS / WSS    | REST API (Zod schemas)
                           | Socket.IO Events
                           v
+-------------------------------------------------------+
|            Backend Server (Node.js + Express)         |
|  +--------------------+  +-------------------------+  |
|  | Express HTTP Layer |  | Socket.IO Server Layer  |  |
|  +---------+----------+  +------------+------------+  |
|            |                          |               |
|            v                          v               |
|  +-------------------------------------------------+  |
|  |             Application Service Core            |  |
|  | - Session Manager (Opaque IDs, Nickname Registry)|  |
|  | - Matchmaking Engine (Atomic Queues & Switching)|  |
|  | - Match Lifecycle Manager (Creation, Exit, TTL) |  |
|  | - Game Engines (RPS & Hand Cricket Authoritative)|  |
|  | - Moderation Service (Reporting, Ban/Block)     |  |
|  | - Rate Limiter & Security Guard                 |  |
|  +-------------------------+-----------------------+  |
+----------------------------+--------------------------+
                             |
                             v
           +---------------------------------+
           |     MongoDB Atlas (Free M0)     |
           | - Moderation Tickets            |
           | - Enforcement Records (Bans)    |
           | - Admin Accounts (Hashed PW)    |
           | - Audit Logs                    |
           +---------------------------------+
```

---

## 2. State Ownership & Persistence Boundaries

### 2.1 Ephemeral State (In-Memory on Single Node)
To strictly uphold privacy principles and zero persistent chat leakage:
- **Active Guest Sessions:** In-memory map of `sessionId -> { socketId, nickname, status, matchId, queueId, reconnectUntil, createdAt, lastSeenAt }`.
- **Matchmaking Queues:** Per-game FIFO sets with atomic pairing logic and blocklist checking.
- **Active Matches & Games:** In-memory state holding authoritative RPS and Hand Cricket round/over data, secret moves until resolved, scores, and turn timers.
- **Transient Chat:** Buffered in memory during the match only for ordering. Upon match termination, skip, report, or leave, match state is destroyed.

### 2.2 Persistent State (MongoDB)
Persistent data is restricted to:
1. `ModerationTicket`: Reports created by users, containing category, reporter pseudonym, reported pseudonym, timestamp, status, and admin decision.
2. `EnforcementRecord`: Platform-level temporary or permanent bans.
3. `AdminUser`: Hashed administrator credentials.
4. `AuditLog`: Immutable log of admin decisions and moderation actions.

---

## 3. Matchmaking & Race Condition Prevention
- Atomic Queue Operations: Sessions entering or leaving queues are processed with state locks to ensure no session is double-booked or paired simultaneously into two matches.
- Mutual Block Validation: Before pairing user A and user B, matchmaking checks if either user has blocked the other's persistent pseudonymous ID or session.
- Queue Switching: When switching queues on fallback offers, session removal from Queue A and insertion into Queue B occurs in a single synchronous operation on the server.

---

## 4. Game Engine Architectures

### 4.1 Rock Paper Scissors (Best of 3)
- Authoritative state machine: `WAITING_FOR_MOVES`, `ROUND_RESOLVED`, `MATCH_OVER`.
- Private submission: Client sends `rps:move`. Server acknowledges receipt (`rps:move-accepted`) without revealing the choice to the opponent until both players submit or round times out (20s).
- First to 2 round wins takes the match. Tied rounds do not increment scores.

### 4.2 Hand Cricket (3 Overs / 18 Deliveries per Innings)
- Phase 1: Server-controlled odd/even toss. Both players submit a number (1-6). Sum is calculated, winner chooses Bat/Bowl.
- Phase 2: First Innings (18 legal deliveries max or until wicket). Batter scores chosen runs if numbers differ; dismissed if numbers match.
- Phase 3: Innings Break & Target calculation (`first_innings_runs + 1`).
- Phase 4: Second Innings (ends when target achieved, batter dismissed, or 18 deliveries completed).
- Phase 5: Super-Over Tie Breaker: 1 over (6 deliveries) each. If still tied, repeat up to configured limit (3 super-overs max), ending in a draw if tied after limit.

---

## 5. Security and Moderation Architecture
- **Input Validation:** All REST endpoints and Socket.IO payloads validated against Zod schemas.
- **XSS Prevention:** Plain text rendering, sanitization on nicknames, chat messages, and reports.
- **Rate Limiting:** Leaky bucket / window-based limiting on messages (max 5 per 5s), moves, queue switches, and admin login attempts.
- **Admin Authentication:** Secure JWT in HttpOnly cookie or Authorization header, bcrypt password hashing, and role checks.
