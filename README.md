# Gamerizz

> Real-time stranger matchmaking, browser multiplayer gaming, and ephemeral text chat.

Gamerizz lets two strangers instantly connect, play classic browser games (Rock Paper Scissors, Hand Cricket), and chat in real time without registration, webcams, or retained chat histories.

---

## Key Features

- **Guest-First & Anonymous:** Immediate access with editable, unique nicknames. No account or password required.
- **Classic Browser Games:**
  - **Rock Paper Scissors:** Best of 3 rounds with hidden move submissions and 20-second turn timers.
  - **Hand Cricket:** 3 overs (18 balls) per innings, odd/even toss, chase targets, and 1-over super-over tie breakers.
- **Ephemeral Text Chat:** Live messaging with emojis and predefined reactions. Zero persistent message storage.
- **Safety & Moderation:** Report abusive players, personal blocklists, server-side rate limits, and protected admin dashboard.
- **Responsive Dark Theme:** Split-panel desktop view (60% game / 40% chat) that adapts to mobile viewports.
- **Zero Cost Deployment:** 100% free-tier ready on Render/Vercel and MongoDB Atlas.

---

## Tech Stack

- **Frontend:** React 19, Vite, Socket.IO Client, Vanilla CSS (Dark theme design tokens).
- **Backend:** Node.js, Express, Socket.IO, Mongoose, Zod.
- **Testing:** Vitest, Supertest, Testing Library.

---

## Local Development Setup

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB instance (local or free MongoDB Atlas URI)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd Gamerizz

# Install dependencies for both server and client
npm install
```

### 3. Environment Variables
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```
Ensure `MONGODB_URI` points to a running MongoDB database.

### 4. Running Locally
```bash
# Start both server and client concurrently
npm run dev

# Or run separately:
npm run dev:server  # Runs backend on http://localhost:5000
npm run dev:client  # Runs Vite frontend on http://localhost:5173
```

### 5. Running Tests
```bash
npm test
```

---

## Project Documentation
- [Software Requirements Specification (SRS)](./docs/SRS.md)
- [System Architecture](./docs/ARCHITECTURE.md)
- [Phase Implementation Roadmap](./docs/PHASE_ROADMAP.md)
- [REST API Reference](./docs/API.md)
- [Socket.IO Event Contract](./docs/SOCKET_EVENTS.md)
- [Security & Threat Model](./docs/SECURITY.md)
- [Zero-Cost Deployment Guide](./docs/DEPLOYMENT.md)
- [Testing Strategy](./docs/TESTING.md)

---

## License
MIT
