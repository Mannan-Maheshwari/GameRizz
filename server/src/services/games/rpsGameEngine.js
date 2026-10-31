import { env } from '../../config/environment.js';

export const RPS_MOVES = {
  ROCK: 'rock',
  PAPER: 'paper',
  SCISSORS: 'scissors'
};

/**
 * Authoritative Rock Paper Scissors Engine (Best of 3)
 */
export class RpsGameEngine {
  constructor(matchId, players, onRoundTimeout, onStateUpdate) {
    this.matchId = matchId;
    this.players = players; // [{ sessionId, nickname, socketId }, ...]
    this.round = 1;
    this.scores = {
      [players[0].sessionId]: 0,
      [players[1].sessionId]: 0
    };
    this.moves = {}; // sessionId -> move
    this.roundHistory = [];
    this.status = 'WAITING_FOR_MOVES'; // 'WAITING_FOR_MOVES' | 'ROUND_RESOLVED' | 'MATCH_OVER'
    this.winner = null;
    this.winnerNickname = null;
    this.timeoutTimer = null;
    this.timeoutAt = null;
    this.onRoundTimeout = onRoundTimeout;
    this.onStateUpdate = onStateUpdate;
    this.timeoutSeconds = env.RPS_MOVE_TIMEOUT_SECONDS || 20;

    this.startRoundTimer();
  }

  startRoundTimer() {
    this.clearRoundTimer();
    this.timeoutAt = Date.now() + (this.timeoutSeconds * 1000);

    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutSeconds * 1000);

    if (this.timeoutTimer && typeof this.timeoutTimer.unref === 'function') {
      this.timeoutTimer.unref();
    }
  }

  clearRoundTimer() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.timeoutAt = null;
  }

  submitMove(sessionId, move, roundNumber) {
    if (this.status === 'MATCH_OVER') {
      return { success: false, error: { code: 'MATCH_OVER', message: 'Match has already ended.' } };
    }

    // Reject stale round actions (FR-052)
    if (roundNumber && roundNumber !== this.round) {
      return { success: false, error: { code: 'STALE_ROUND', message: `Action received for round ${roundNumber}, but current round is ${this.round}.` } };
    }

    // Reject invalid moves (FR-029)
    if (!['rock', 'paper', 'scissors'].includes(move)) {
      return { success: false, error: { code: 'INVALID_MOVE', message: 'Move must be rock, paper, or scissors.' } };
    }

    // Idempotency: Reject duplicate moves (FR-032)
    if (this.moves[sessionId]) {
      return { success: false, error: { code: 'MOVE_ALREADY_SUBMITTED', message: 'You have already submitted a move for this round.' } };
    }

    // Record private move (FR-031)
    this.moves[sessionId] = move;

    const pA = this.players[0].sessionId;
    const pB = this.players[1].sessionId;

    // Both players have submitted
    if (this.moves[pA] && this.moves[pB]) {
      this.clearRoundTimer();
      const roundResult = this.resolveRound(this.moves[pA], this.moves[pB]);
      return {
        success: true,
        isRoundResolved: true,
        roundResult
      };
    }

    return {
      success: true,
      isRoundResolved: false,
      round: this.round
    };
  }

  // Resolve outcome of two moves (FR-030)
  // Returns: sessionId of winner, or 'tie'
  determineWinner(moveA, moveB) {
    if (moveA === moveB) return 'tie';
    if (
      (moveA === 'rock' && moveB === 'scissors') ||
      (moveA === 'scissors' && moveB === 'paper') ||
      (moveA === 'paper' && moveB === 'rock')
    ) {
      return this.players[0].sessionId;
    }
    return this.players[1].sessionId;
  }

  resolveRound(moveA, moveB, isTimeout = false, timedOutSessionId = null) {
    const pA = this.players[0].sessionId;
    const pB = this.players[1].sessionId;
    let roundWinnerSessionId = null;

    if (isTimeout) {
      if (timedOutSessionId === 'both') {
        roundWinnerSessionId = 'tie';
      } else if (timedOutSessionId === pA) {
        roundWinnerSessionId = pB; // pA forfeits round (FR-033)
      } else {
        roundWinnerSessionId = pA; // pB forfeits round (FR-033)
      }
    } else {
      roundWinnerSessionId = this.determineWinner(moveA, moveB);
    }

    let roundWinnerNickname = null;
    if (roundWinnerSessionId !== 'tie') {
      this.scores[roundWinnerSessionId] += 1;
      const winnerPlayer = this.players.find(p => p.sessionId === roundWinnerSessionId);
      roundWinnerNickname = winnerPlayer ? winnerPlayer.nickname : null;
    }

    const roundData = {
      round: this.round,
      moves: {
        [pA]: moveA || 'timeout',
        [pB]: moveB || 'timeout'
      },
      winnerSessionId: roundWinnerSessionId,
      winnerNickname: roundWinnerNickname,
      isTie: roundWinnerSessionId === 'tie',
      isTimeout,
      scores: { ...this.scores }
    };

    this.roundHistory.push(roundData);
    this.status = 'ROUND_RESOLVED';

    // Check Match Completion (Best of 3 -> First to 2 wins, FR-028, FR-035)
    if (this.scores[pA] >= 2) {
      this.status = 'MATCH_OVER';
      this.winner = pA;
      this.winnerNickname = this.players[0].nickname;
    } else if (this.scores[pB] >= 2) {
      this.status = 'MATCH_OVER';
      this.winner = pB;
      this.winnerNickname = this.players[1].nickname;
    } else {
      // Prepare next round
      this.round += 1;
      this.moves = {};
      this.status = 'WAITING_FOR_MOVES';
      this.startRoundTimer();
    }

    return {
      roundData,
      isMatchOver: this.status === 'MATCH_OVER',
      matchWinnerSessionId: this.winner,
      matchWinnerNickname: this.winnerNickname,
      nextRound: this.round,
      scores: { ...this.scores }
    };
  }

  handleTimeout() {
    const pA = this.players[0].sessionId;
    const pB = this.players[1].sessionId;

    const moveA = this.moves[pA];
    const moveB = this.moves[pB];

    let timedOutSessionId = null;
    if (!moveA && !moveB) {
      timedOutSessionId = 'both';
    } else if (!moveA) {
      timedOutSessionId = pA;
    } else if (!moveB) {
      timedOutSessionId = pB;
    } else {
      return; // Both submitted
    }

    const roundResult = this.resolveRound(moveA, moveB, true, timedOutSessionId);

    if (this.onRoundTimeout) {
      this.onRoundTimeout(roundResult);
    }
  }

  // Sanitized state representation safe to emit to a specific player
  getPlayerState(sessionId) {
    const opponent = this.players.find(p => p.sessionId !== sessionId);
    return {
      matchId: this.matchId,
      round: this.round,
      status: this.status,
      scores: {
        myScore: this.scores[sessionId] || 0,
        opponentScore: opponent ? (this.scores[opponent.sessionId] || 0) : 0
      },
      myMoveSubmitted: !!this.moves[sessionId],
      opponentSubmitted: opponent ? !!this.moves[opponent.sessionId] : false,
      timeoutAt: this.timeoutAt,
      winner: this.winnerNickname
    };
  }

  destroy() {
    this.clearRoundTimer();
  }
}
