import { matchLifecycleService } from '../../services/matches/matchLifecycleService.js';
import { rpsMoveSchema } from '../../validators/socketValidator.js';
import { RpsGameEngine } from '../../services/games/rpsGameEngine.js';
import { sessionManager } from '../../services/sessions/sessionManager.js';

function getPlayerSocketId(sessionId, fallbackSocketId) {
  const session = sessionManager.getSession(sessionId);
  return session?.socketId || fallbackSocketId;
}

export function registerRpsHandlers(io, socket) {
  socket.on('rps:move', (payload) => {
    const parse = rpsMoveSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('rps:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid move payload.'
      });
    }

    const { matchId, move } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);

    if (!match || match.status !== 'active' || match.gameType !== 'rps') {
      return socket.emit('rps:error', {
        code: 'INVALID_MATCH',
        message: 'Active RPS match not found.'
      });
    }

    // Verify session belongs to match (FR-100)
    if (!match.playerSessionIds.includes(socket.sessionId)) {
      return socket.emit('rps:error', {
        code: 'UNAUTHORIZED_MATCH',
        message: 'You are not a participant in this match.'
      });
    }

    // Initialize game engine if not already created
    if (!match.engine) {
      match.engine = new RpsGameEngine(
        matchId,
        match.players,
        (timeoutResult) => {
          handleRpsRoundResolution(io, match, timeoutResult);
        }
      );
    }

    const roundNumber = payload.round;
    const result = match.engine.submitMove(socket.sessionId, move, roundNumber);

    if (!result.success) {
      return socket.emit('rps:error', result.error);
    }

    // Private acknowledgement to submitter (FR-031)
    socket.emit('rps:move-accepted', {
      matchId,
      round: match.engine.round,
      move
    });

    // Notify opponent that a move was locked in (without revealing what it is!)
    const opponent = matchLifecycleService.getOpponent(matchId, socket.sessionId);
    if (opponent) {
      const oppSocketId = getPlayerSocketId(opponent.sessionId, opponent.socketId);
      if (oppSocketId) {
        io.to(oppSocketId).emit('rps:opponent-submitted', {
          matchId,
          round: match.engine.round
        });
      }
    }

    // If both players submitted, resolve round
    if (result.isRoundResolved) {
      handleRpsRoundResolution(io, match, result.roundResult);
    }
  });

  // Client requests initial RPS state sync (FR-049)
  socket.on('rps:get-state', (payload) => {
    const matchId = payload?.matchId;
    const match = matchLifecycleService.getMatch(matchId);
    if (!match || match.gameType !== 'rps' || !match.playerSessionIds.includes(socket.sessionId)) return;

    if (!match.engine) {
      match.engine = new RpsGameEngine(
        matchId,
        match.players,
        (timeoutResult) => {
          handleRpsRoundResolution(io, match, timeoutResult);
        }
      );
    }

    socket.emit('rps:state', match.engine.getPlayerState(socket.sessionId));
  });
}

function handleRpsRoundResolution(io, match, roundResult) {
  const roomName = `match:${match.matchId}`;

  // Broadcast revealed moves & outcome (FR-030, FR-034)
  io.to(roomName).emit('rps:round-result', roundResult);

  // Synchronize state for each player individually
  for (const player of match.players) {
    const sId = getPlayerSocketId(player.sessionId, player.socketId);
    if (sId && match.engine) {
      io.to(sId).emit('rps:state', match.engine.getPlayerState(player.sessionId));
    }
  }

  // If match concluded (first to 2 wins) (FR-028, FR-035)
  if (roundResult.isMatchOver) {
    matchLifecycleService.endMatch(match.matchId, 'completed', roundResult.matchWinnerNickname);

    io.to(roomName).emit('rps:match-result', {
      matchId: match.matchId,
      winnerSessionId: roundResult.matchWinnerSessionId,
      winnerNickname: roundResult.matchWinnerNickname,
      scores: roundResult.scores
    });

    io.to(roomName).emit('match:ended', {
      matchId: match.matchId,
      reason: 'completed',
      winnerNickname: roundResult.matchWinnerNickname
    });
  }
}
