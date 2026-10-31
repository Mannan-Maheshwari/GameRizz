import crypto from 'crypto';
import { sessionManager } from '../sessions/sessionManager.js';

class MatchLifecycleService {
  constructor() {
    // Map of matchId -> match object
    this.matches = new Map();
    // Map of sessionId -> matchId
    this.sessionToMatch = new Map();
  }

  createMatch(gameType, playerA, playerB) {
    const matchId = `match_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const match = {
      matchId,
      gameType,
      players: [
        { sessionId: playerA.sessionId, nickname: playerA.nickname, socketId: playerA.socketId },
        { sessionId: playerB.sessionId, nickname: playerB.nickname, socketId: playerB.socketId }
      ],
      playerSessionIds: [playerA.sessionId, playerB.sessionId],
      status: 'active', // 'active' | 'ended'
      createdAt: now,
      endedAt: null,
      endReason: null,
      winnerNickname: null,
      gameState: null // Initialized by specific game engine
    };

    this.matches.set(matchId, match);
    this.sessionToMatch.set(playerA.sessionId, matchId);
    this.sessionToMatch.set(playerB.sessionId, matchId);

    // Update sessions
    const sA = sessionManager.getSession(playerA.sessionId);
    if (sA) {
      sA.status = 'match';
      sA.matchId = matchId;
      sA.queueId = null;
    }

    const sB = sessionManager.getSession(playerB.sessionId);
    if (sB) {
      sB.status = 'match';
      sB.matchId = matchId;
      sB.queueId = null;
    }

    return match;
  }

  getMatch(matchId) {
    return this.matches.get(matchId) || null;
  }

  getMatchBySession(sessionId) {
    const matchId = this.sessionToMatch.get(sessionId);
    if (!matchId) return null;
    return this.matches.get(matchId) || null;
  }

  endMatch(matchId, reason = 'completed', winnerNickname = null) {
    const match = this.matches.get(matchId);
    if (!match || match.status === 'ended') {
      return match || null; // Idempotent termination (FR-026)
    }

    match.status = 'ended';
    match.endedAt = new Date().toISOString();
    match.endReason = reason;
    match.winnerNickname = winnerNickname;

    // Release session match associations
    for (const pid of match.playerSessionIds) {
      this.sessionToMatch.delete(pid);
      const s = sessionManager.getSession(pid);
      if (s && s.matchId === matchId) {
        s.status = 'lobby';
        s.matchId = null;
      }
    }

    return match;
  }

  getOpponent(matchId, sessionId) {
    const match = this.matches.get(matchId);
    if (!match) return null;
    return match.players.find(p => p.sessionId !== sessionId) || null;
  }

  resetForTesting() {
    this.matches.clear();
    this.sessionToMatch.clear();
  }
}

export const matchLifecycleService = new MatchLifecycleService();
