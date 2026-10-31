import crypto from 'crypto';

class SessionManager {
  constructor() {
    // Map of sessionId -> session object
    this.sessions = new Map();
    // Set of active normalized (lowercase) nicknames for O(1) uniqueness check
    this.activeNicknames = new Set();
    // Map of socketId -> sessionId
    this.socketToSession = new Map();
  }

  generateReadableNickname() {
    const prefixes = [
      'Pixel', 'Cyber', 'Neon', 'Shadow', 'Quantum', 'Glitch', 'Turbo', 'Cosmic',
      'Solar', 'Vortex', 'Apex', 'Hyper', 'Titan', 'Zenith', 'Echo', 'Rogue'
    ];
    const animals = [
      'Fox', 'Wolf', 'Hawk', 'Tiger', 'Viper', 'Falcon', 'Panda', 'Drake',
      'Otter', 'Lynx', 'Raven', 'Puma', 'Cobra', 'Eagle', 'Badger', 'Bison'
    ];

    for (let attempts = 0; attempts < 100; attempts++) {
      const p = prefixes[Math.floor(Math.random() * prefixes.length)];
      const a = animals[Math.floor(Math.random() * animals.length)];
      const num = Math.floor(100 + Math.random() * 900);
      const candidate = `${p}${a}${num}`;
      if (!this.activeNicknames.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
    // High-concurrency fallback
    return `Player${Math.floor(100000 + Math.random() * 900000)}`;
  }

  createSession() {
    const sessionId = crypto.randomUUID();
    const sessionSecret = crypto.randomBytes(32).toString('hex');
    const nickname = this.generateReadableNickname();

    const session = {
      sessionId,
      sessionSecret,
      nickname,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      socketId: null,
      status: 'lobby', // 'lobby' | 'queue' | 'match'
      selectedGame: null,
      queueId: null,
      matchId: null,
      reconnectUntil: null
    };

    this.sessions.set(sessionId, session);
    this.activeNicknames.add(nickname.toLowerCase());

    return {
      sessionId,
      sessionSecret,
      nickname,
      createdAt: session.createdAt
    };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  validateSessionSecret(sessionId, sessionSecret) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.sessionSecret !== sessionSecret) return null;
    session.lastSeenAt = new Date().toISOString();
    return session;
  }

  updateNickname(sessionId, newNickname) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found.' } };
    }

    if (session.status === 'match') {
      return { success: false, error: { code: 'NICKNAME_LOCKED', message: 'Nickname cannot be modified during an active match.' } };
    }

    const normalizedNew = newNickname.toLowerCase();
    const normalizedCurrent = session.nickname.toLowerCase();

    if (normalizedNew !== normalizedCurrent && this.activeNicknames.has(normalizedNew)) {
      return {
        success: false,
        error: { code: 'NICKNAME_TAKEN', message: `Nickname "${newNickname}" is currently in use. Please select another.` }
      };
    }

    // Release old nickname
    this.activeNicknames.delete(normalizedCurrent);
    // Claim new nickname
    this.activeNicknames.add(normalizedNew);
    session.nickname = newNickname;
    session.lastSeenAt = new Date().toISOString();

    return { success: true, nickname: newNickname };
  }

  bindSocket(sessionId, socketId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Disassociate previous socket if any
    if (session.socketId && session.socketId !== socketId) {
      this.socketToSession.delete(session.socketId);
    }

    session.socketId = socketId;
    session.reconnectUntil = null;
    session.lastSeenAt = new Date().toISOString();
    this.socketToSession.set(socketId, sessionId);

    return session;
  }

  unbindSocket(socketId, gracePeriodSeconds = 30) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;

    this.socketToSession.delete(socketId);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.socketId = null;
      session.reconnectUntil = Date.now() + (gracePeriodSeconds * 1000);
    }

    return session;
  }

  getSessionBySocket(socketId) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) || null;
  }

  removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.socketId) {
      this.socketToSession.delete(session.socketId);
    }
    this.activeNicknames.delete(session.nickname.toLowerCase());
    this.sessions.delete(sessionId);
    return true;
  }

  // Active session stats (safe for observability)
  getActiveStats() {
    return {
      activeSessions: this.sessions.size,
      activeNicknames: this.activeNicknames.size,
      connectedSockets: this.socketToSession.size
    };
  }

  // Clear all sessions (used in test suite)
  resetForTesting() {
    this.sessions.clear();
    this.activeNicknames.clear();
    this.socketToSession.clear();
  }
}

export const sessionManager = new SessionManager();
