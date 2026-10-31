import { sessionManager } from '../sessions/sessionManager.js';
import { matchLifecycleService } from '../matches/matchLifecycleService.js';

class MatchmakingService {
  constructor() {
    // Per-game queues: Map of gameType -> Array of queue entries
    // Each entry: { sessionId, nickname, socketId, joinedAt, blocklist: Set, switchOffer: null }
    this.queues = {
      rps: [],
      cricket: []
    };

    // Lock to prevent race condition during atomic pairing (FR-020)
    this.isProcessing = {
      rps: false,
      cricket: false
    };

    // Global session to queue index
    this.sessionToQueue = new Map(); // sessionId -> gameType
  }

  getQueueStatus(gameType) {
    const queue = this.queues[gameType] || [];
    return {
      gameType,
      waitersCount: queue.length
    };
  }

  joinQueue(sessionId, socketId, gameType, clientBlocklist = []) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: { code: 'INVALID_SESSION', message: 'Session not found.' } };
    }

    // Single active match/queue constraint (FR-014)
    if (session.status === 'match' || matchLifecycleService.getMatchBySession(sessionId)) {
      return { success: false, error: { code: 'ALREADY_IN_MATCH', message: 'You are already in an active match.' } };
    }

    // If already in a queue, remove first
    this.leaveQueue(sessionId);

    const blocklistSet = new Set((clientBlocklist || []).map(id => id.toLowerCase()));

    const entry = {
      sessionId,
      nickname: session.nickname,
      socketId,
      joinedAt: Date.now(),
      blocklist: blocklistSet,
      switchOffer: null
    };

    if (!this.queues[gameType]) {
      this.queues[gameType] = [];
    }

    this.queues[gameType].push(entry);
    this.sessionToQueue.set(sessionId, gameType);

    session.status = 'queue';
    session.queueId = gameType;
    session.selectedGame = gameType;

    return {
      success: true,
      gameType,
      joinedAt: entry.joinedAt
    };
  }

  leaveQueue(sessionId) {
    const gameType = this.sessionToQueue.get(sessionId);
    if (!gameType) return false;

    const queue = this.queues[gameType];
    if (queue) {
      this.queues[gameType] = queue.filter(e => e.sessionId !== sessionId);
    }
    this.sessionToQueue.delete(sessionId);

    const session = sessionManager.getSession(sessionId);
    if (session && session.status === 'queue') {
      session.status = 'lobby';
      session.queueId = null;
    }

    return true;
  }

  // Check mutual block compatibility (FR-075)
  isCompatible(entryA, entryB) {
    if (entryA.sessionId === entryB.sessionId) return false;
    // Check if A blocked B
    if (entryA.blocklist.has(entryB.sessionId.toLowerCase())) return false;
    // Check if B blocked A
    if (entryB.blocklist.has(entryA.sessionId.toLowerCase())) return false;
    return true;
  }

  // Atomic pairing loop (FR-013, FR-019, FR-020)
  processQueue(gameType) {
    if (this.isProcessing[gameType]) return null;
    this.isProcessing[gameType] = true;

    try {
      const queue = this.queues[gameType];
      if (!queue || queue.length < 2) {
        return null;
      }

      for (let i = 0; i < queue.length; i++) {
        for (let j = i + 1; j < queue.length; j++) {
          const entryA = queue[i];
          const entryB = queue[j];

          if (this.isCompatible(entryA, entryB)) {
            // Verify both sessions and sockets are still active
            const sessionA = sessionManager.getSession(entryA.sessionId);
            const sessionB = sessionManager.getSession(entryB.sessionId);

            if (!sessionA || !sessionB || !sessionA.socketId || !sessionB.socketId) {
              continue;
            }

            // Atomically remove both from queue
            this.queues[gameType] = queue.filter(
              e => e.sessionId !== entryA.sessionId && e.sessionId !== entryB.sessionId
            );
            this.sessionToQueue.delete(entryA.sessionId);
            this.sessionToQueue.delete(entryB.sessionId);

            // Create match record
            const match = matchLifecycleService.createMatch(gameType, sessionA, sessionB);

            return {
              match,
              playerA: { session: sessionA, socketId: entryA.socketId },
              playerB: { session: sessionB, socketId: entryB.socketId }
            };
          }
        }
      }

      return null;
    } finally {
      this.isProcessing[gameType] = false;
    }
  }

  // Check if an alternative queue has compatible players waiting (FR-016)
  checkAlternativeOffer(sessionId) {
    const currentQueue = this.sessionToQueue.get(sessionId);
    if (!currentQueue) return null;

    const altQueue = currentQueue === 'rps' ? 'cricket' : 'rps';
    const altWaiters = this.queues[altQueue] || [];

    if (altWaiters.length > 0) {
      return {
        proposedGame: altQueue,
        availableWaiters: altWaiters.length
      };
    }
    return null;
  }

  // Atomically switch queues upon user confirmation (FR-016)
  switchQueue(sessionId, targetGameType) {
    const currentQueue = this.sessionToQueue.get(sessionId);
    if (!currentQueue || currentQueue === targetGameType) return false;

    const currentEntry = (this.queues[currentQueue] || []).find(e => e.sessionId === sessionId);
    if (!currentEntry) return false;

    // Atomically transfer entry
    this.queues[currentQueue] = this.queues[currentQueue].filter(e => e.sessionId !== sessionId);
    currentEntry.joinedAt = Date.now();
    currentEntry.switchOffer = null;

    if (!this.queues[targetGameType]) {
      this.queues[targetGameType] = [];
    }

    this.queues[targetGameType].push(currentEntry);
    this.sessionToQueue.set(sessionId, targetGameType);

    const session = sessionManager.getSession(sessionId);
    if (session) {
      session.queueId = targetGameType;
      session.selectedGame = targetGameType;
    }

    return true;
  }

  // Handle client socket disconnect during queue (FR-021, FR-105)
  handleDisconnect(socketId) {
    for (const [gameType, queue] of Object.entries(this.queues)) {
      const entry = queue.find(e => e.socketId === socketId);
      if (entry) {
        this.leaveQueue(entry.sessionId);
        return { gameType, sessionId: entry.sessionId };
      }
    }
    return null;
  }

  resetForTesting() {
    this.queues = { rps: [], cricket: [] };
    this.sessionToQueue.clear();
    this.isProcessing = { rps: false, cricket: false };
  }
}

export const matchmakingService = new MatchmakingService();
