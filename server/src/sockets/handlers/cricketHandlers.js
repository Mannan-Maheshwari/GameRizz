import { matchLifecycleService } from '../../services/matches/matchLifecycleService.js';
import { cricketTossSchema, cricketTossDecisionSchema, cricketDeliverySchema } from '../../validators/socketValidator.js';
import { HandCricketGameEngine } from '../../services/games/handCricketGameEngine.js';
import { sessionManager } from '../../services/sessions/sessionManager.js';

function getPlayerSocketId(sessionId, fallbackSocketId) {
  const session = sessionManager.getSession(sessionId);
  return session?.socketId || fallbackSocketId;
}

export function registerCricketHandlers(io, socket) {
  // Ensure game engine exists on match
  function getOrCreateEngine(match) {
    if (!match.engine) {
      match.engine = new HandCricketGameEngine(
        match.matchId,
        match.players,
        (timeoutEvent) => {
          handleCricketTimeout(io, match, timeoutEvent);
        }
      );
    }
    return match.engine;
  }

  // Submit Toss choice & number (FR-037)
  socket.on('cricket:toss-choice', (payload) => {
    const parse = cricketTossSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('cricket:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid toss payload.'
      });
    }

    const { matchId, call, number } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);

    if (!match || match.status !== 'active' || match.gameType !== 'cricket') {
      return socket.emit('cricket:error', {
        code: 'INVALID_MATCH',
        message: 'Active Hand Cricket match not found.'
      });
    }

    if (!match.playerSessionIds.includes(socket.sessionId)) {
      return socket.emit('cricket:error', {
        code: 'UNAUTHORIZED_MATCH',
        message: 'You are not a participant in this match.'
      });
    }

    const engine = getOrCreateEngine(match);
    const result = engine.submitToss(socket.sessionId, number, call);

    if (!result.success) {
      return socket.emit('cricket:error', result.error);
    }

    socket.emit('cricket:toss-accepted', {
      matchId,
      number
    });

    const opponent = matchLifecycleService.getOpponent(matchId, socket.sessionId);
    if (opponent) {
      const oppSocketId = getPlayerSocketId(opponent.sessionId, opponent.socketId);
      if (oppSocketId) {
        io.to(oppSocketId).emit('cricket:opponent-submitted', { matchId, phase: 'toss' });
      }
    }

    if (result.tossResolved) {
      const roomName = `match:${match.matchId}`;
      io.to(roomName).emit('cricket:toss-result', result.tossResult);
      syncCricketState(io, match);
    }
  });

  // Submit Toss Decision (Bat/Bowl) by toss winner (FR-037)
  socket.on('cricket:toss-decision', (payload) => {
    const parse = cricketTossDecisionSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('cricket:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid toss decision.'
      });
    }

    const { matchId, decision } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);
    if (!match || match.status !== 'active' || match.gameType !== 'cricket') return;

    const engine = getOrCreateEngine(match);
    const result = engine.submitTossDecision(socket.sessionId, decision);

    if (!result.success) {
      return socket.emit('cricket:error', result.error);
    }

    const roomName = `match:${match.matchId}`;
    io.to(roomName).emit('cricket:toss-decision-made', result);
    syncCricketState(io, match);
  });

  // Submit Delivery Number 1-6 (FR-038 - FR-048)
  socket.on('cricket:delivery', (payload) => {
    const parse = cricketDeliverySchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('cricket:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid delivery payload.'
      });
    }

    const { matchId, number, ballIndex } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);

    if (!match || match.status !== 'active' || match.gameType !== 'cricket') {
      return socket.emit('cricket:error', {
        code: 'INVALID_MATCH',
        message: 'Active Hand Cricket match not found.'
      });
    }

    if (!match.playerSessionIds.includes(socket.sessionId)) {
      return socket.emit('cricket:error', {
        code: 'UNAUTHORIZED_MATCH',
        message: 'You are not a participant in this match.'
      });
    }

    const engine = getOrCreateEngine(match);
    const result = engine.submitDelivery(socket.sessionId, number, ballIndex);

    if (!result.success) {
      return socket.emit('cricket:error', result.error);
    }

    // Private acknowledgement to submitter (FR-046)
    socket.emit('cricket:delivery-accepted', {
      matchId,
      ballIndex: engine.currentDeliveryIndex,
      number
    });

    // Notify opponent that choice is locked in secretly
    const opponent = matchLifecycleService.getOpponent(matchId, socket.sessionId);
    if (opponent) {
      const oppSocketId = getPlayerSocketId(opponent.sessionId, opponent.socketId);
      if (oppSocketId) {
        io.to(oppSocketId).emit('cricket:opponent-submitted', {
          matchId,
          ballIndex: engine.currentDeliveryIndex
        });
      }
    }

    // If both players submitted, broadcast result and state sync
    if (result.isDeliveryResolved) {
      const roomName = `match:${match.matchId}`;
      io.to(roomName).emit('cricket:delivery-result', result.deliveryResult);
      syncCricketState(io, match);

      if (result.deliveryResult.isMatchOver) {
        handleCricketMatchConclusion(io, match, result.deliveryResult.matchResult);
      }
    }
  });

  // Client requests authoritative state sync (FR-049)
  socket.on('cricket:get-state', (payload) => {
    const matchId = payload?.matchId;
    const match = matchLifecycleService.getMatch(matchId);
    if (!match || match.gameType !== 'cricket' || !match.playerSessionIds.includes(socket.sessionId)) return;

    const engine = getOrCreateEngine(match);
    socket.emit('cricket:state', engine.getPlayerState(socket.sessionId));
  });
}

function syncCricketState(io, match) {
  if (!match?.engine) return;
  for (const player of match.players) {
    const sId = getPlayerSocketId(player.sessionId, player.socketId);
    if (sId) {
      io.to(sId).emit('cricket:state', match.engine.getPlayerState(player.sessionId));
    }
  }
}

function handleCricketTimeout(io, match, timeoutEvent) {
  syncCricketState(io, match);
  const roomName = `match:${match.matchId}`;
  if (timeoutEvent.type === 'delivery_timeout') {
    io.to(roomName).emit('cricket:delivery-result', timeoutEvent.result);
    if (timeoutEvent.result.isMatchOver) {
      handleCricketMatchConclusion(io, match, timeoutEvent.result.matchResult);
    }
  }
}

function handleCricketMatchConclusion(io, match, matchResult) {
  const roomName = `match:${match.matchId}`;
  matchLifecycleService.endMatch(match.matchId, 'completed', matchResult.winnerNickname);

  io.to(roomName).emit('cricket:match-result', {
    matchId: match.matchId,
    winnerSessionId: matchResult.winnerSessionId,
    winnerNickname: matchResult.winnerNickname,
    summary: matchResult.summary,
    scorecard: matchResult.scorecard
  });

  io.to(roomName).emit('match:ended', {
    matchId: match.matchId,
    reason: 'completed',
    winnerNickname: matchResult.winnerNickname
  });
}
