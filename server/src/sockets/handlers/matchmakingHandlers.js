import { matchmakingService } from '../../services/matchmaking/matchmakingService.js';
import { matchLifecycleService } from '../../services/matches/matchLifecycleService.js';
import { queueJoinSchema, queueSwitchRespondSchema } from '../../validators/socketValidator.js';

export function registerMatchmakingHandlers(io, socket) {
  // Join Matchmaking Queue (FR-011, FR-012, FR-013)
  socket.on('queue:join', (payload) => {
    const parse = queueJoinSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('queue:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid queue request.'
      });
    }

    const { gameType, clientBlocklist } = parse.data;
    const result = matchmakingService.joinQueue(socket.sessionId, socket.id, gameType, clientBlocklist);

    if (!result.success) {
      return socket.emit('queue:error', result.error);
    }

    socket.emit('queue:joined', {
      gameType,
      joinedAt: result.joinedAt
    });

    // Check if an immediate match can be created
    const pairResult = matchmakingService.processQueue(gameType);
    if (pairResult) {
      const { match, playerA, playerB } = pairResult;

      // Join socket room
      const roomName = `match:${match.matchId}`;
      const sockA = io.sockets.sockets.get(playerA.socketId);
      const sockB = io.sockets.sockets.get(playerB.socketId);
      if (sockA) sockA.join(roomName);
      if (sockB) sockB.join(roomName);

      // Notify Player A
      io.to(playerA.socketId).emit('match:found', {
        matchId: match.matchId,
        gameType: match.gameType,
        opponentNickname: playerB.session.nickname
      });

      // Notify Player B
      io.to(playerB.socketId).emit('match:found', {
        matchId: match.matchId,
        gameType: match.gameType,
        opponentNickname: playerA.session.nickname
      });

      // Emit ready
      io.to(roomName).emit('match:ready', {
        matchId: match.matchId,
        gameType: match.gameType
      });
    } else {
      // Check if alternative queue has waiters to offer a fallback switch (FR-016)
      const altOffer = matchmakingService.checkAlternativeOffer(socket.sessionId);
      if (altOffer) {
        socket.emit('queue:switch-offer', altOffer);
      }
    }
  });

  // Cancel Queue (FR-018)
  socket.on('queue:cancel', () => {
    matchmakingService.leaveQueue(socket.sessionId);
    socket.emit('queue:cancelled', { success: true });
  });

  // Respond to Alternative Queue Switch Offer (FR-016)
  socket.on('queue:switch-respond', (payload) => {
    const parse = queueSwitchRespondSchema.safeParse(payload);
    if (!parse.success) return;

    if (parse.data.accept) {
      const offer = matchmakingService.checkAlternativeOffer(socket.sessionId);
      if (offer) {
        const switched = matchmakingService.switchQueue(socket.sessionId, offer.proposedGame);
        socket.emit('queue:switch-result', {
          success: switched,
          gameType: offer.proposedGame
        });

        if (switched) {
          // Attempt immediate pairing in the new queue
          const pairResult = matchmakingService.processQueue(offer.proposedGame);
          if (pairResult) {
            const { match, playerA, playerB } = pairResult;
            const roomName = `match:${match.matchId}`;
            const sA = io.sockets.sockets.get(playerA.socketId);
            const sB = io.sockets.sockets.get(playerB.socketId);
            if (sA) sA.join(roomName);
            if (sB) sB.join(roomName);

            io.to(playerA.socketId).emit('match:found', {
              matchId: match.matchId,
              gameType: match.gameType,
              opponentNickname: playerB.session.nickname
            });
            io.to(playerB.socketId).emit('match:found', {
              matchId: match.matchId,
              gameType: match.gameType,
              opponentNickname: playerA.session.nickname
            });
            io.to(roomName).emit('match:ready', {
              matchId: match.matchId,
              gameType: match.gameType
            });
          }
        }
      } else {
        socket.emit('queue:switch-result', {
          success: false,
          message: 'Alternative queue is no longer available.'
        });
      }
    }
  });

  // Skip Match (FR-023)
  socket.on('match:skip', (payload) => {
    const matchId = payload?.matchId;
    const match = matchLifecycleService.getMatch(matchId);
    if (!match || match.status === 'ended') return;

    // Verify session belongs to match
    if (!match.playerSessionIds.includes(socket.sessionId)) return;

    const roomName = `match:${matchId}`;
    matchLifecycleService.endMatch(matchId, 'skipped');

    io.to(roomName).emit('match:ended', {
      matchId,
      reason: 'skipped',
      skippedBy: socket.sessionId
    });
  });

  // Leave Match (FR-024)
  socket.on('match:leave', (payload) => {
    const matchId = payload?.matchId;
    const match = matchLifecycleService.getMatch(matchId);
    if (!match || match.status === 'ended') return;

    if (!match.playerSessionIds.includes(socket.sessionId)) return;

    const roomName = `match:${matchId}`;
    matchLifecycleService.endMatch(matchId, 'left');

    io.to(roomName).emit('match:ended', {
      matchId,
      reason: 'opponent_left'
    });
  });
}
