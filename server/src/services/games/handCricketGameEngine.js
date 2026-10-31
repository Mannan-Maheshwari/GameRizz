import { env } from '../../config/environment.js';

/**
 * Format balls to cricket overs notation (e.g., 8 balls -> "1.2") (FR-041)
 */
export function formatOvers(balls) {
  const overs = Math.floor(balls / 6);
  const remainder = balls % 6;
  return `${overs}.${remainder}`;
}

/**
 * Server-authoritative Hand Cricket Game Engine (FR-036 - FR-052)
 */
export class HandCricketGameEngine {
  constructor(matchId, players, onTimeout, onStateUpdate) {
    this.matchId = matchId;
    this.players = players; // [{ sessionId, nickname, socketId }, ...]
    this.onTimeout = onTimeout;
    this.onStateUpdate = onStateUpdate;
    this.timeoutSeconds = env.CRICKET_MOVE_TIMEOUT_SECONDS || 20;

    // Phases: 'TOSS_WAITING' | 'TOSS_DECISION' | 'INNINGS_1' | 'INNINGS_BREAK' | 'INNINGS_2' | 'SUPER_OVER_1' | 'SUPER_OVER_2' | 'MATCH_OVER'
    this.phase = 'TOSS_WAITING';

    // Toss state (FR-037)
    this.toss = {
      callerSessionId: players[0].sessionId,
      nonCallerSessionId: players[1].sessionId,
      callerCall: null, // 'odd' | 'even'
      moves: {}, // sessionId -> number (1-6)
      winnerSessionId: null,
      winnerNickname: null,
      decision: null // 'bat' | 'bowl'
    };

    // Innings tracking
    this.maxBalls = 18; // 3 overs (FR-039)
    this.superOverMaxBalls = 6; // 1 over (FR-044)

    this.innings = 1; // 1, 2, 'so1', 'so2'
    this.superOverRound = 0; // 0 = main match, 1..3 = super over rounds (FR-045)

    this.battingSessionId = null;
    this.bowlingSessionId = null;

    this.scorecard = {
      innings1: {
        batterSessionId: null,
        bowlerSessionId: null,
        runs: 0,
        wickets: 0, // In MVP 1 wicket = all out (individual batter)
        balls: 0,
        timeline: []
      },
      innings2: {
        batterSessionId: null,
        bowlerSessionId: null,
        runs: 0,
        wickets: 0,
        balls: 0,
        target: null,
        timeline: []
      },
      superOver: []
    };

    this.currentDeliveryMoves = {}; // sessionId -> number
    this.currentDeliveryIndex = 1; // 1-indexed delivery of current innings
    this.lastDeliveryResult = null;

    this.status = 'IN_PROGRESS';
    this.winnerSessionId = null;
    this.winnerNickname = null;
    this.resultSummary = null;

    this.timeoutTimer = null;
    this.timeoutAt = null;

    this.startTimer();
  }

  startTimer() {
    this.clearTimer();
    this.timeoutAt = Date.now() + (this.timeoutSeconds * 1000);
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutSeconds * 1000);

    if (this.timeoutTimer && typeof this.timeoutTimer.unref === 'function') {
      this.timeoutTimer.unref();
    }
  }

  clearTimer() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.timeoutAt = null;
  }

  // --- TOSS LOGIC (FR-037) ---
  submitToss(sessionId, number, call) {
    if (this.phase !== 'TOSS_WAITING') {
      return { success: false, error: { code: 'INVALID_PHASE', message: 'Toss has already concluded.' } };
    }

    if (number < 1 || number > 6) {
      return { success: false, error: { code: 'INVALID_NUMBER', message: 'Toss number must be between 1 and 6.' } };
    }

    if (this.toss.moves[sessionId]) {
      return { success: false, error: { code: 'ALREADY_SUBMITTED', message: 'You have already submitted your toss choice.' } };
    }

    // If caller, record their odd/even call
    if (sessionId === this.toss.callerSessionId && call) {
      this.toss.callerCall = call;
    }

    this.toss.moves[sessionId] = number;

    const pA = this.players[0].sessionId;
    const pB = this.players[1].sessionId;

    // Both players submitted their numbers
    if (this.toss.moves[pA] && this.toss.moves[pB]) {
      this.clearTimer();

      // Default callerCall to 'odd' if unspecified
      if (!this.toss.callerCall) {
        this.toss.callerCall = 'odd';
      }

      const sum = this.toss.moves[pA] + this.toss.moves[pB];
      const isSumOdd = sum % 2 === 1;
      const callerWins = (isSumOdd && this.toss.callerCall === 'odd') || (!isSumOdd && this.toss.callerCall === 'even');

      this.toss.winnerSessionId = callerWins ? this.toss.callerSessionId : this.toss.nonCallerSessionId;
      const winnerPlayer = this.players.find(p => p.sessionId === this.toss.winnerSessionId);
      this.toss.winnerNickname = winnerPlayer?.nickname || 'Toss Winner';

      this.phase = 'TOSS_DECISION';
      this.startTimer();

      return {
        success: true,
        tossResolved: true,
        tossResult: {
          moves: { ...this.toss.moves },
          sum,
          isSumOdd,
          callerCall: this.toss.callerCall,
          winnerSessionId: this.toss.winnerSessionId,
          winnerNickname: this.toss.winnerNickname
        }
      };
    }

    return {
      success: true,
      tossResolved: false
    };
  }

  submitTossDecision(sessionId, decision) {
    if (this.phase !== 'TOSS_DECISION') {
      return { success: false, error: { code: 'INVALID_PHASE', message: 'Toss decision not accepted at this time.' } };
    }

    if (sessionId !== this.toss.winnerSessionId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Only the toss winner can choose to bat or bowl.' } };
    }

    if (!['bat', 'bowl'].includes(decision)) {
      return { success: false, error: { code: 'INVALID_DECISION', message: 'Decision must be "bat" or "bowl".' } };
    }

    this.clearTimer();
    this.toss.decision = decision;

    const otherPlayer = this.players.find(p => p.sessionId !== sessionId);
    if (decision === 'bat') {
      this.battingSessionId = sessionId;
      this.bowlingSessionId = otherPlayer.sessionId;
    } else {
      this.battingSessionId = otherPlayer.sessionId;
      this.bowlingSessionId = sessionId;
    }

    this.scorecard.innings1.batterSessionId = this.battingSessionId;
    this.scorecard.innings1.bowlerSessionId = this.bowlingSessionId;

    this.phase = 'INNINGS_1';
    this.innings = 1;
    this.currentDeliveryIndex = 1;
    this.currentDeliveryMoves = {};
    this.startTimer();

    return {
      success: true,
      decision,
      battingSessionId: this.battingSessionId,
      bowlingSessionId: this.bowlingSessionId,
      battingNickname: this.players.find(p => p.sessionId === this.battingSessionId)?.nickname,
      bowlingNickname: this.players.find(p => p.sessionId === this.bowlingSessionId)?.nickname
    };
  }

  // --- DELIVERY LOGIC (FR-038 - FR-048) ---
  submitDelivery(sessionId, number, ballIndex) {
    if (!['INNINGS_1', 'INNINGS_2', 'SUPER_OVER_1', 'SUPER_OVER_2'].includes(this.phase)) {
      return { success: false, error: { code: 'INVALID_PHASE', message: `Cannot submit move in current phase: ${this.phase}` } };
    }

    // Stale action rejection (FR-052)
    if (ballIndex && ballIndex !== this.currentDeliveryIndex) {
      return { success: false, error: { code: 'STALE_DELIVERY', message: `Received move for ball ${ballIndex}, but current ball is ${this.currentDeliveryIndex}.` } };
    }

    if (number < 1 || number > 6) {
      return { success: false, error: { code: 'INVALID_NUMBER', message: 'Choice must be a number from 1 to 6.' } };
    }

    // Idempotency: Reject duplicate move (FR-032)
    if (this.currentDeliveryMoves[sessionId]) {
      return { success: false, error: { code: 'ALREADY_SUBMITTED', message: 'You have already submitted a number for this delivery.' } };
    }

    this.currentDeliveryMoves[sessionId] = number;

    const pA = this.players[0].sessionId;
    const pB = this.players[1].sessionId;

    if (this.currentDeliveryMoves[pA] && this.currentDeliveryMoves[pB]) {
      this.clearTimer();
      const deliveryResult = this.resolveDelivery(this.currentDeliveryMoves[this.battingSessionId], this.currentDeliveryMoves[this.bowlingSessionId]);
      return {
        success: true,
        isDeliveryResolved: true,
        deliveryResult
      };
    }

    return {
      success: true,
      isDeliveryResolved: false,
      ballIndex: this.currentDeliveryIndex
    };
  }

  resolveDelivery(batterNumber, bowlerNumber, isTimeout = false, timedOutSessionId = null) {
    const isWicket = !isTimeout && (batterNumber === bowlerNumber);
    const runsScored = isTimeout ? 0 : (isWicket ? 0 : batterNumber);

    const deliveryRecord = {
      ballIndex: this.currentDeliveryIndex,
      batterSessionId: this.battingSessionId,
      bowlerSessionId: this.bowlingSessionId,
      batterNumber: batterNumber || 0,
      bowlerNumber: bowlerNumber || 0,
      runsScored,
      isWicket,
      isTimeout,
      timedOutSessionId
    };

    let activeInningsData;
    let isSuperOver = false;

    if (this.phase === 'INNINGS_1') {
      activeInningsData = this.scorecard.innings1;
    } else if (this.phase === 'INNINGS_2') {
      activeInningsData = this.scorecard.innings2;
    } else {
      isSuperOver = true;
      const currentSO = this.scorecard.superOver[this.scorecard.superOver.length - 1];
      activeInningsData = this.phase === 'SUPER_OVER_1' ? currentSO.innings1 : currentSO.innings2;
    }

    activeInningsData.balls += 1;
    activeInningsData.runs += runsScored;
    if (isWicket) {
      activeInningsData.wickets += 1;
    }
    activeInningsData.timeline.push(deliveryRecord);
    this.lastDeliveryResult = deliveryRecord;

    const maxBallsForPhase = isSuperOver ? this.superOverMaxBalls : this.maxBalls;
    let isInningsOver = false;
    let inningsEndReason = null;

    if (isWicket) {
      isInningsOver = true;
      inningsEndReason = 'wicket';
    } else if (activeInningsData.balls >= maxBallsForPhase) {
      isInningsOver = true;
      inningsEndReason = 'overs_completed';
    }

    // 2nd Innings Target Chase check (FR-042)
    if ((this.phase === 'INNINGS_2' || this.phase === 'SUPER_OVER_2') && activeInningsData.target) {
      if (activeInningsData.runs >= activeInningsData.target) {
        isInningsOver = true;
        inningsEndReason = 'target_reached';
      }
    }

    // Transition state
    let matchResult = null;

    if (isInningsOver) {
      matchResult = this.handleInningsTransition(inningsEndReason, isSuperOver);
    } else {
      // Continue same innings
      this.currentDeliveryIndex += 1;
      this.currentDeliveryMoves = {};
      this.startTimer();
    }

    return {
      deliveryRecord,
      inningsData: {
        runs: activeInningsData.runs,
        wickets: activeInningsData.wickets,
        balls: activeInningsData.balls,
        oversFormatted: formatOvers(activeInningsData.balls),
        target: activeInningsData.target || null
      },
      isInningsOver,
      inningsEndReason,
      isMatchOver: this.status === 'MATCH_OVER',
      matchResult
    };
  }

  handleInningsTransition(reason, isSuperOver) {
    if (this.phase === 'INNINGS_1') {
      // Set Target for 2nd Innings: 1st innings runs + 1 (FR-042)
      const target = this.scorecard.innings1.runs + 1;
      this.scorecard.innings2.target = target;
      this.scorecard.innings2.batterSessionId = this.bowlingSessionId; // swap
      this.scorecard.innings2.bowlerSessionId = this.battingSessionId;

      // Swap roles
      const prevBatter = this.battingSessionId;
      this.battingSessionId = this.bowlingSessionId;
      this.bowlingSessionId = prevBatter;

      this.phase = 'INNINGS_2';
      this.innings = 2;
      this.currentDeliveryIndex = 1;
      this.currentDeliveryMoves = {};
      this.startTimer();

      return {
        nextPhase: 'INNINGS_2',
        target,
        chasingNickname: this.players.find(p => p.sessionId === this.battingSessionId)?.nickname
      };
    }

    if (this.phase === 'INNINGS_2') {
      const inn1Runs = this.scorecard.innings1.runs;
      const inn2Runs = this.scorecard.innings2.runs;

      if (inn2Runs > inn1Runs) {
        // Chasing player won (FR-043)
        return this.concludeMatch(this.scorecard.innings2.batterSessionId, 'chased_target');
      } else if (inn2Runs < inn1Runs) {
        // Defending player won (FR-043)
        return this.concludeMatch(this.scorecard.innings1.batterSessionId, 'defended_score');
      } else {
        // TIE -> Trigger Super-Over (FR-044)
        return this.startSuperOver();
      }
    }

    if (this.phase === 'SUPER_OVER_1') {
      const currentSO = this.scorecard.superOver[this.scorecard.superOver.length - 1];
      const target = currentSO.innings1.runs + 1;
      currentSO.innings2.target = target;
      currentSO.innings2.batterSessionId = this.bowlingSessionId;
      currentSO.innings2.bowlerSessionId = this.battingSessionId;

      const prevBatter = this.battingSessionId;
      this.battingSessionId = this.bowlingSessionId;
      this.bowlingSessionId = prevBatter;

      this.phase = 'SUPER_OVER_2';
      this.currentDeliveryIndex = 1;
      this.currentDeliveryMoves = {};
      this.startTimer();

      return {
        nextPhase: 'SUPER_OVER_2',
        target,
        superOverRound: this.superOverRound
      };
    }

    if (this.phase === 'SUPER_OVER_2') {
      const currentSO = this.scorecard.superOver[this.scorecard.superOver.length - 1];
      const so1Runs = currentSO.innings1.runs;
      const so2Runs = currentSO.innings2.runs;

      if (so2Runs > so1Runs) {
        return this.concludeMatch(currentSO.innings2.batterSessionId, 'super_over_win');
      } else if (so2Runs < so1Runs) {
        return this.concludeMatch(currentSO.innings1.batterSessionId, 'super_over_win');
      } else {
        // Tied again! Repeated tie-breaker up to 3 times (FR-045)
        if (this.superOverRound < 3) {
          return this.startSuperOver();
        } else {
          // Limit reached -> Draw (FR-045)
          return this.concludeMatch(null, 'draw_super_over_limit');
        }
      }
    }
  }

  startSuperOver() {
    this.superOverRound += 1;
    // FR-044: Player who batted second in the main match bats first in the super-over
    const firstBatterId = this.scorecard.innings2.batterSessionId;
    const firstBowlerId = this.scorecard.innings1.batterSessionId;

    this.battingSessionId = firstBatterId;
    this.bowlingSessionId = firstBowlerId;

    this.scorecard.superOver.push({
      round: this.superOverRound,
      innings1: {
        batterSessionId: firstBatterId,
        bowlerSessionId: firstBowlerId,
        runs: 0,
        wickets: 0,
        balls: 0,
        timeline: []
      },
      innings2: {
        batterSessionId: firstBowlerId,
        bowlerSessionId: firstBatterId,
        runs: 0,
        wickets: 0,
        balls: 0,
        target: null,
        timeline: []
      }
    });

    this.phase = 'SUPER_OVER_1';
    this.currentDeliveryIndex = 1;
    this.currentDeliveryMoves = {};
    this.startTimer();

    return {
      isSuperOver: true,
      superOverRound: this.superOverRound,
      battingNickname: this.players.find(p => p.sessionId === this.battingSessionId)?.nickname
    };
  }

  concludeMatch(winnerSessionId, reason) {
    this.clearTimer();
    this.status = 'MATCH_OVER';
    this.phase = 'MATCH_OVER';
    this.winnerSessionId = winnerSessionId;

    if (winnerSessionId) {
      const winner = this.players.find(p => p.sessionId === winnerSessionId);
      this.winnerNickname = winner?.nickname || 'Winner';
      this.resultSummary = `${this.winnerNickname} won by ${reason === 'chased_target' ? 'chasing target' : reason === 'defended_score' ? 'runs' : 'super-over'}!`;
    } else {
      this.winnerNickname = null;
      this.resultSummary = 'Match ended in a Draw after maximum tie-breakers.';
    }

    return {
      isMatchOver: true,
      winnerSessionId: this.winnerSessionId,
      winnerNickname: this.winnerNickname,
      reason,
      summary: this.resultSummary,
      scorecard: this.scorecard
    };
  }

  handleTimeout() {
    if (this.phase === 'TOSS_WAITING') {
      // If toss times out, assign random choices
      const pA = this.players[0].sessionId;
      const pB = this.players[1].sessionId;
      if (!this.toss.moves[pA]) this.toss.moves[pA] = Math.floor(Math.random() * 6) + 1;
      if (!this.toss.moves[pB]) this.toss.moves[pB] = Math.floor(Math.random() * 6) + 1;
      if (!this.toss.callerCall) this.toss.callerCall = 'odd';

      const sum = this.toss.moves[pA] + this.toss.moves[pB];
      const isSumOdd = sum % 2 === 1;
      const callerWins = (isSumOdd && this.toss.callerCall === 'odd') || (!isSumOdd && this.toss.callerCall === 'even');

      this.toss.winnerSessionId = callerWins ? this.toss.callerSessionId : this.toss.nonCallerSessionId;
      const winner = this.players.find(p => p.sessionId === this.toss.winnerSessionId);
      this.toss.winnerNickname = winner?.nickname;

      this.phase = 'TOSS_DECISION';
      this.startTimer();

      if (this.onTimeout) {
        this.onTimeout({ type: 'toss_timeout', toss: this.toss });
      }
      return;
    }

    if (this.phase === 'TOSS_DECISION') {
      // Default toss winner to bat
      this.submitTossDecision(this.toss.winnerSessionId, 'bat');
      if (this.onTimeout) {
        this.onTimeout({ type: 'toss_decision_timeout', battingSessionId: this.battingSessionId });
      }
      return;
    }

    if (['INNINGS_1', 'INNINGS_2', 'SUPER_OVER_1', 'SUPER_OVER_2'].includes(this.phase)) {
      const pA = this.players[0].sessionId;
      const pB = this.players[1].sessionId;
      const moveA = this.currentDeliveryMoves[pA];
      const moveB = this.currentDeliveryMoves[pB];

      let timedOutSessionId = null;
      if (!moveA && !moveB) {
        timedOutSessionId = 'both';
      } else if (!moveA) {
        timedOutSessionId = pA;
      } else {
        timedOutSessionId = pB;
      }

      // Auto-assign move or forfeit
      const batterMove = this.currentDeliveryMoves[this.battingSessionId] || (Math.floor(Math.random() * 6) + 1);
      const bowlerMove = this.currentDeliveryMoves[this.bowlingSessionId] || (Math.floor(Math.random() * 6) + 1);

      const result = this.resolveDelivery(batterMove, bowlerMove, true, timedOutSessionId);

      if (this.onTimeout) {
        this.onTimeout({ type: 'delivery_timeout', result });
      }
    }
  }

  getPlayerState(sessionId) {
    const isBatter = this.battingSessionId === sessionId;
    const isBowler = this.bowlingSessionId === sessionId;
    const opponent = this.players.find(p => p.sessionId !== sessionId);

    let currentInningsData = this.scorecard.innings1;
    if (this.phase === 'INNINGS_2') {
      currentInningsData = this.scorecard.innings2;
    } else if (this.phase === 'SUPER_OVER_1' || this.phase === 'SUPER_OVER_2') {
      const currentSO = this.scorecard.superOver[this.scorecard.superOver.length - 1];
      currentInningsData = this.phase === 'SUPER_OVER_1' ? currentSO?.innings1 : currentSO?.innings2;
    }

    return {
      matchId: this.matchId,
      phase: this.phase,
      status: this.status,
      innings: this.innings,
      superOverRound: this.superOverRound,
      toss: {
        isCaller: this.toss.callerSessionId === sessionId,
        winnerNickname: this.toss.winnerNickname,
        winnerSessionId: this.toss.winnerSessionId,
        decision: this.toss.decision,
        myMoveSubmitted: !!this.toss.moves[sessionId],
        opponentSubmitted: opponent ? !!this.toss.moves[opponent.sessionId] : false
      },
      role: isBatter ? 'bat' : isBowler ? 'bowl' : null,
      currentInnings: {
        runs: currentInningsData?.runs || 0,
        wickets: currentInningsData?.wickets || 0,
        balls: currentInningsData?.balls || 0,
        oversFormatted: formatOvers(currentInningsData?.balls || 0),
        target: currentInningsData?.target || null,
        timeline: (currentInningsData?.timeline || []).slice(-6) // last 6 balls for quick view
      },
      scorecard: {
        innings1: {
          runs: this.scorecard.innings1.runs,
          wickets: this.scorecard.innings1.wickets,
          oversFormatted: formatOvers(this.scorecard.innings1.balls)
        },
        innings2: {
          runs: this.scorecard.innings2.runs,
          wickets: this.scorecard.innings2.wickets,
          oversFormatted: formatOvers(this.scorecard.innings2.balls),
          target: this.scorecard.innings2.target
        }
      },
      myMoveSubmitted: !!this.currentDeliveryMoves[sessionId],
      opponentSubmitted: opponent ? !!this.currentDeliveryMoves[opponent.sessionId] : false,
      ballIndex: this.currentDeliveryIndex,
      timeoutAt: this.timeoutAt,
      winnerNickname: this.winnerNickname,
      winnerSessionId: this.winnerSessionId,
      resultSummary: this.resultSummary
    };
  }

  destroy() {
    this.clearTimer();
  }
}
