# Gamerizz — Phased Implementation Roadmap & Status Tracker

**Document status:** Living roadmap and progress log  
**Last updated:** October 2026  
**Primary Stack:** React 19 + Vite (Client) | Node.js + Express + Socket.IO (Server) | MongoDB Atlas  

---

## 1. Project Overview

Gamerizz is a browser-based, guest-first multiplayer gaming and transient chat platform. Strangers can instantly connect, play classic browser games (Rock Paper Scissors, Hand Cricket), and chat in real time without registration, webcams, or stored conversation history.

### Core Architectural Principles
1. **Server-Authoritative:** All match states, queue pairings, move resolutions, and scoring are evaluated by the backend. Clients cannot forge scores.
2. **Ephemeral Privacy:** Ordinary chat messages and gameplay events are strictly transient in memory — zero permanent chat logs are stored in MongoDB.
3. **Safety & Moderation:** Report categories, anonymous blocklists (preventing rematching), server-side rate limits, and a protected admin review dashboard.
4. **Zero-Cost Operation:** 100% free-tier compatible on Render/Vercel and MongoDB Atlas with zero mandatory paid APIs.

---

## 2. Phase-by-Phase Progress Tracker

| Phase | Description | Status | Key Deliverables & Artifacts |
|---|---|---|---|
| **Phase 0** | Repository & Architecture Planning | **DONE** | Monorepo structure, SRS, Architecture, API, Socket event contracts, Security docs |
| **Phase 1** | UI Shell & Guest Flow | **DONE** | Responsive dark theme, 18+ age gate, auto-generated editable nicknames, game selector |
| **Phase 2** | Backend Foundation & Real-Time | **DONE** | Express app, Socket.IO server, session manager, rate limiter, health checks |
| **Phase 3** | Matchmaking Engine | **DONE** | Per-game queues (RPS/Cricket), atomic pairing, queue cancellation, switch offers, block filtering |
| **Phase 4** | Rock Paper Scissors (Best of 3) | **DONE** | Authoritative RPS state machine, hidden moves, timeouts, scoreboard, round banners, confetti |
| **Phase 5** | Hand Cricket (3-Over Format) | **READY** | Odd/even toss, batting/bowling 1–6, chase targets, 1-over super-over tie breaker |
| **Phase 6** | Real-Time Chat & Reactions | **PENDING** | Transient text chat, unicode emojis, rate-limited predefined reactions, mobile drawer |
| **Phase 7** | Reporting, Blocking & Admin | **PENDING** | Match termination on report, MongoDB moderation tickets, admin login & audit trail |
| **Phase 8** | Hardening & Zero-Cost Deployment | **PENDING** | Full integration/E2E test suite, security hardening, Render/Vercel deployment guides |

---

## 3. Detailed Summary of Completed Phases

### Phase 0: Project Setup & Specification
- Established monorepo (`client`, `server`, `docs`).
- Created comprehensive specifications:
  - [`SRS.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/SRS.md)
  - [`ARCHITECTURE.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/ARCHITECTURE.md)
  - [`API.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/API.md)
  - [`SOCKET_EVENTS.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/SOCKET_EVENTS.md)
  - [`SECURITY.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/SECURITY.md)
  - [`DEPLOYMENT.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/DEPLOYMENT.md)
  - [`TESTING.md`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/docs/TESTING.md)

### Phase 1: Guest Identity & UI Shell
- **Age Gate:** 18+ confirmation modal with local persistence (FR-001, FR-002).
- **Guest Identity:** Cryptographically random session tokens with collision-resistant auto-generated nicknames (e.g. `CyberWolf482`) and real-time nickname editing (FR-004, FR-005, FR-006).
- **Game Selector:** Interactive cards for Rock Paper Scissors and Hand Cricket with rules preview (FR-008, FR-009).
- **UI Design:** Dark cyberpunk-inspired aesthetic with glassmorphism, responsive navigation, and footer legal links.

### Phase 2: Backend Foundation & Real-Time Connections
- **Express & Socket.IO:** Central server setup with CORS security, connection tracking, and health routes (`/api/health`, `/api/ready`).
- **Session Management:** Opaque session tokens, authenticated reconnection handshake (`session:resume` -> `session:ready`).
- **Security & Validation:** Zod schemas for all Socket.IO payloads and REST requests, in-memory sliding-window rate limiters (FR-077).

### Phase 3: Matchmaking Engine
- **Per-Game Queues:** Separate in-memory queues for RPS and Cricket (`matchmakingService.js`).
- **Atomic Pairing:** Safe pairing without duplicate matches or race conditions (FR-013, FR-019, FR-020).
- **Queue Controls:** Real-time cancellation (`queue:cancel`) and status updates.
- **Alternative Game Fallback:** Proactive switch offer (`queue:switch-offer`) when one queue is busy and the other is empty (FR-016).
- **Safety Filtering:** Matchmaking automatically excludes pairings present in either player's anonymous blocklist (FR-075).

### Phase 4: Rock Paper Scissors Game Engine
- **Server Engine ([`rpsGameEngine.js`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/server/src/services/games/rpsGameEngine.js)):**
  - Authoritative Best-of-3 format (first to 2 round wins, FR-028).
  - All 9 move combinations + tie resolution (FR-030).
  - Hidden move submissions — choices remain private until both players submit (FR-031, FR-046).
  - 20-second turn timeout with forfeit logic (FR-033).
  - Rejection of duplicate moves and stale round numbers (FR-032, FR-052).
- **Socket Handlers ([`rpsHandlers.js`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/server/src/sockets/handlers/rpsHandlers.js)):**
  - Validates `rps:move` with Zod.
  - Emits private `rps:move-accepted` to sender and anonymous `rps:opponent-submitted` to opponent.
  - Broadcasts `rps:round-result` with round winner, revealed moves, updated scores, and `rps:match-result`.
- **Frontend Arena ([`RpsArena.jsx`](file:///c:/Users/manna/OneDrive/Desktop/web%20Dev/Projects/Gamerizz/client/src/features/games/rps/RpsArena.jsx)):**
  - Interactive move cards with gradient cards (Rock, Paper, Scissors).
  - Live 20-second countdown timer with warning colors.
  - Opponent readiness indicator ("thinking..." vs "chosen!").
  - Round outcome banner and celebration confetti upon match victory.

---

## 4. Next Steps: Phase 5 & Beyond

### Phase 5: Hand Cricket Specification
- **Format:** 3 overs (18 legal deliveries) per innings (FR-039).
- **Toss:** Odd/even toss mechanism with hidden number submission (1–6) to choose batting or bowling (FR-037).
- **Deliveries:** Both players submit numbers 1 to 6 secretly:
  - If numbers match -> Batter is OUT (FR-038).
  - If numbers differ -> Batter scores runs equal to their chosen number (FR-040).
- **Innings Transition:** Target set to `FirstInningsRuns + 1` (FR-042). Second innings ends on dismissal, 18 balls, or target achieved.
- **Tie-Breaker:** 1-over super-over, repeatable up to 3 times before declaring a draw (FR-044, FR-045).
- **Components to Create:**
  - `server/src/services/games/handCricketGameEngine.js`
  - `server/src/sockets/handlers/cricketHandlers.js`
  - `server/src/__tests__/handCricketGameEngine.test.js`
  - `client/src/features/games/cricket/CricketArena.jsx`

### Phase 6: Real-Time Ephemeral Chat
- Live text messaging scoped strictly to active match rooms (`chat:send`, `chat:message`).
- Zero persistence in MongoDB (FR-060).
- Rate limits (5 msgs in 5s burst) and 500-char max (FR-054).
- Predefined reaction buttons (👍, 😂, 🎉, 😲) and Unicode emoji picker.

### Phase 7: Reporting, Blocking & Moderation
- Report button with categories (Harassment, Spam, Inappropriate, etc.).
- Immediate match termination upon report submission (FR-066).
- MongoDB persistence for moderation tickets (`ModerationTicket` model).
- Protected admin dashboard (`/admin`) with credentials authentication and ticket resolution workflow.

---

## 5. Local Development Quick Reference

### Running the Full Monorepo
To prevent Vite proxy `ECONNREFUSED` errors, always run both server and client concurrently from the workspace root:

```bash
# In the root Gamerizz directory:
npm run dev
```

This concurrently starts:
- **Backend API & WebSockets:** `http://localhost:5000`
- **Frontend Vite Client:** `http://localhost:5173`

### Running Tests
```bash
# Run tests across entire monorepo:
npm test

# Or run separately:
npm run test:server
npm run test:client
```
