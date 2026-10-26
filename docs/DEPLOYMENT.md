# Gamerizz — Zero-Cost Deployment Guide

## 1. Zero-Cost Infrastructure Assessment

The Gamerizz platform requires:
1. **Persistent WebSocket support** (Socket.IO client to server).
2. **Node.js runtime** with persistent execution during active user connections.
3. **MongoDB persistence** for moderation tickets, bans, and audit records.
4. **Static Single Page Application (SPA) hosting** for Vite React client.

### Recommended 100% Free Tier Stack:
- **Frontend Hosting:** Vercel (Hobby plan) or Cloudflare Pages / Netlify (Free).
- **Backend Hosting:** Render Web Service (Free Tier) or Fly.io (Free allowance) or Koyeb (Free).
  *Note on Render free tier:* Instances spin down after 15 minutes of inactivity. When a new user lands, there may be a 30-50 second cold start. Socket.IO connections work properly over WSS once active.
- **Database:** MongoDB Atlas M0 Free Tier (512MB storage, shared RAM, zero cost, no credit card required).

---

## 2. Step-by-Step Setup Guide

### 2.1 MongoDB Atlas M0 (Free)
1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a Free Shared Cluster (M0).
3. Under **Database Access**, create a user `gamerizz_app` with read/write privileges.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) so cloud web services can connect.
5. Copy the connection string: `mongodb+srv://gamerizz_app:<PASSWORD>@cluster0.mongodb.net/gamerizz?retryWrites=true&w=majority`.

### 2.2 Backend Deployment (e.g., Render Free Web Service)
1. Connect your GitHub repository to Render.
2. Select **Web Service**, Root Directory: `server`.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `CLIENT_ORIGIN`: `https://your-gamerizz-client.vercel.app`
   - `MONGODB_URI`: `<Atlas Connection String>`
   - `SESSION_SECRET`: `<Generate with crypto.randomBytes(32).toString('hex')>`
   - `ADMIN_JWT_SECRET`: `<Generate with crypto.randomBytes(32).toString('hex')>`
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: `<Secure administrative password>`

### 2.3 Frontend Deployment (e.g., Vercel)
1. Import repository on Vercel.
2. Framework Preset: `Vite`.
3. Root Directory: `client`.
4. Environment Variables:
   - `VITE_SERVER_URL`: `https://your-gamerizz-server.onrender.com`
5. Deploy.

---

## 3. Honest Limitations of Free Hosting
- **Cold Starts:** Free backend containers hibernate after inactivity. The client displays a friendly "Waking up server..." status message if the initial connection takes >5 seconds.
- **Single Instance:** Free tier instances do not share in-memory state. Matchmaking operates seamlessly on a single persistent container. Multi-instance scaling with Redis is documented for future phase.
- **No Automatic Paid Upgrades:** None of the chosen tiers require payment credentials or auto-bill.
