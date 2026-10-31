import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { createApp } from '../app.js';
import { initializeSocketServer } from '../sockets/socketServer.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { matchmakingService } from '../services/matchmaking/matchmakingService.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';
import { HandCricketGameEngine, formatOvers } from '../services/games/handCricketGameEngine.js';

describe('Phase 5: Hand Cricket Game Engine Unit Tests', () => {
  const p1 = { sessionId: 'player1', nickname: 'BatterOne', socketId: 'sock1' };
  const p2 = { sessionId: 'player2', nickname: 'BowlerTwo', socketId: 'sock2' };

  it('Calculates overs notation correctly (FR-041)', () => {
    expect(formatOvers(0)).toBe('0.0');
    expect(formatOvers(1)).toBe('0.1');
    expect(formatOvers(5)).toBe('0.5');
    expect(formatOvers(6)).toBe('1.0');
    expect(formatOvers(8)).toBe('1.2');
    expect(formatOvers(17)).toBe('2.5');
    expect(formatOvers(18)).toBe('3.0');
  });

  it('Resolves odd/even toss and assigns batting/bowling (FR-037)', () => {
    const engine = new HandCricketGameEngine('cricket_match_1', [p1, p2]);
    expect(engine.phase).toBe('TOSS_WAITING');

    // Player 1 calls 'odd' and plays 3
    const t1 = engine.submitToss('player1', 3, 'odd');
    expect(t1.tossResolved).toBe(false);

    // Player 2 plays 2 -> Sum = 5 (odd) -> Player 1 wins toss!
    const t2 = engine.submitToss('player2', 2);
    expect(t2.tossResolved).toBe(true);
    expect(t2.tossResult.winnerSessionId).toBe('player1');
    expect(engine.phase).toBe('TOSS_DECISION');

    // Toss winner chooses to bat
    const dec = engine.submitTossDecision('player1', 'bat');
    expect(dec.success).toBe(true);
    expect(engine.battingSessionId).toBe('player1');
    expect(engine.bowlingSessionId).toBe('player2');
    expect(engine.phase).toBe('INNINGS_1');

    engine.destroy();
  });

  it('Accumulates runs when numbers differ and takes wicket when numbers match (FR-038, FR-040)', () => {
    const engine = new HandCricketGameEngine('cricket_match_2', [p1, p2]);
    engine.submitToss('player1', 4, 'even');
    engine.submitToss('player2', 2); // 4 + 2 = 6 (even) -> p1 wins
    engine.submitTossDecision('player1', 'bat');

    // Delivery 1: Batter picks 6, Bowler picks 4 -> Differ! Batter scores 6 runs
    engine.submitDelivery('player1', 6, 1);
    const d1 = engine.submitDelivery('player2', 4, 1);
    expect(d1.isDeliveryResolved).toBe(true);
    expect(d1.deliveryResult.deliveryRecord.runsScored).toBe(6);
    expect(d1.deliveryResult.deliveryRecord.isWicket).toBe(false);
    expect(engine.scorecard.innings1.runs).toBe(6);
    expect(engine.scorecard.innings1.balls).toBe(1);

    // Delivery 2: Batter picks 4, Bowler picks 4 -> Match! Batter is OUT!
    engine.submitDelivery('player1', 4, 2);
    const d2 = engine.submitDelivery('player2', 4, 2);
    expect(d2.isDeliveryResolved).toBe(true);
    expect(d2.deliveryResult.deliveryRecord.isWicket).toBe(true);
    expect(d2.deliveryResult.isInningsOver).toBe(true);
    expect(d2.deliveryResult.inningsEndReason).toBe('wicket');

    // Innings 1 ends with 6 runs, Target for Innings 2 is 7 (FR-042)
    expect(engine.scorecard.innings1.runs).toBe(6);
    expect(engine.scorecard.innings2.target).toBe(7);
    expect(engine.phase).toBe('INNINGS_2');
    expect(engine.battingSessionId).toBe('player2'); // Roles swapped

    engine.destroy();
  });

  it('Resolves second innings target chase victory (FR-042, FR-043)', () => {
    const engine = new HandCricketGameEngine('cricket_match_3', [p1, p2]);
    engine.submitToss('player1', 3, 'odd');
    engine.submitToss('player2', 2);
    engine.submitTossDecision('player1', 'bat');

    // Innings 1: 4 runs then out -> Total 4 runs (Target = 5)
    engine.submitDelivery('player1', 4, 1);
    engine.submitDelivery('player2', 1, 1); // 4 runs
    engine.submitDelivery('player1', 2, 2);
    engine.submitDelivery('player2', 2, 2); // Out!
    expect(engine.scorecard.innings2.target).toBe(5);

    // Innings 2: Player 2 bats. Hits a 6! (Reaches 6 >= target 5) -> Chaser wins!
    engine.submitDelivery('player2', 6, 1);
    const chaseResult = engine.submitDelivery('player1', 3, 1);

    expect(chaseResult.deliveryResult.isInningsOver).toBe(true);
    expect(chaseResult.deliveryResult.isMatchOver).toBe(true);
    expect(engine.winnerSessionId).toBe('player2');
    expect(engine.winnerNickname).toBe('BowlerTwo');
    expect(engine.status).toBe('MATCH_OVER');

    engine.destroy();
  });

  it('Triggers super-over tie-breaker when scores are tied after both innings (FR-044)', () => {
    const engine = new HandCricketGameEngine('cricket_match_4', [p1, p2]);
    engine.submitToss('player1', 1, 'even');
    engine.submitToss('player2', 1); // 1 + 1 = 2 (even) -> p1 wins
    engine.submitTossDecision('player1', 'bat');

    // Innings 1: 3 runs, then out -> Total 3 runs
    engine.submitDelivery('player1', 3, 1);
    engine.submitDelivery('player2', 1, 1);
    engine.submitDelivery('player1', 5, 2);
    engine.submitDelivery('player2', 5, 2); // Out! Total = 3

    // Innings 2: Player 2 scores 3 runs, then out -> Total 3 runs (Tied 3 - 3!)
    engine.submitDelivery('player2', 3, 1);
    engine.submitDelivery('player1', 2, 1);
    engine.submitDelivery('player2', 1, 2);
    const dTie = engine.submitDelivery('player1', 1, 2); // Out! Total = 3

    expect(dTie.deliveryResult.isMatchOver).toBe(false);
    expect(engine.phase).toBe('SUPER_OVER_1');
    expect(engine.superOverRound).toBe(1);

    // FR-044: Player who batted 2nd in main match (player2) bats first in Super Over
    expect(engine.battingSessionId).toBe('player2');

    engine.destroy();
  });
});

describe('Phase 5: Hand Cricket Socket Integration', () => {
  let app;
  let server;
  let io;
  let serverPort;
  const clients = [];

  beforeEach(async () => {
    sessionManager.resetForTesting();
    matchmakingService.resetForTesting();
    matchLifecycleService.resetForTesting();

    app = createApp();
    server = http.createServer(app);
    io = initializeSocketServer(server);

    await new Promise((resolve) => server.listen(0, resolve));
    serverPort = server.address().port;
  });

  afterEach(() => {
    while (clients.length) {
      const c = clients.pop();
      if (c?.connected) c.disconnect();
    }
    if (io) io.close();
    if (server) server.close();
  });

  async function createConnectedClientSocket(session) {
    const socket = Client(`http://localhost:${serverPort}`, {
      auth: { sessionId: session.sessionId, sessionSecret: session.sessionSecret },
      transports: ['websocket'],
      autoConnect: false
    });
    clients.push(socket);
    const readyPromise = new Promise((resolve) => socket.once('session:ready', resolve));
    socket.connect();
    await readyPromise;
    return socket;
  }

  it('Executes full two-player Hand Cricket match over Socket.IO from toss to finish', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'cricket' });
    client2.emit('queue:join', { gameType: 'cricket' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    // --- TOSS ---
    const tossResultPromise = new Promise((resolve) => client1.on('cricket:toss-result', resolve));
    client1.emit('cricket:toss-choice', { matchId, number: 3, call: 'odd' });
    client2.emit('cricket:toss-choice', { matchId, number: 2 });
    const tossResult = await tossResultPromise;
    expect(tossResult.winnerSessionId).toBe(s1.sessionId);

    // Toss decision: s1 chooses to bat
    const decisionPromise = new Promise((resolve) => client1.on('cricket:toss-decision-made', resolve));
    client1.emit('cricket:toss-decision', { matchId, decision: 'bat' });
    const decisionResult = await decisionPromise;
    expect(decisionResult.battingSessionId).toBe(s1.sessionId);

    // --- INNINGS 1: Delivery 1 (Differ -> Runs) ---
    const d1ResultPromise = new Promise((resolve) => client1.on('cricket:delivery-result', resolve));
    client1.emit('cricket:delivery', { matchId, number: 6, ballIndex: 1 });
    client2.emit('cricket:delivery', { matchId, number: 3, ballIndex: 1 });
    const d1Result = await d1ResultPromise;
    expect(d1Result.deliveryRecord.runsScored).toBe(6);

    // --- INNINGS 1: Delivery 2 (Match -> Wicket!) ---
    const d2ResultPromise = new Promise((resolve) => client1.on('cricket:delivery-result', resolve));
    client1.emit('cricket:delivery', { matchId, number: 4, ballIndex: 2 });
    client2.emit('cricket:delivery', { matchId, number: 4, ballIndex: 2 });
    const d2Result = await d2ResultPromise;
    expect(d2Result.deliveryRecord.isWicket).toBe(true);
    expect(d2Result.isInningsOver).toBe(true);
    expect(d2Result.matchResult.target).toBe(7);

    // --- INNINGS 2: Delivery 1 (s2 hits 6, reaches 6, target 7 not reached yet) ---
    const d3ResultPromise = new Promise((resolve) => client1.once('cricket:delivery-result', resolve));
    client2.emit('cricket:delivery', { matchId, number: 6, ballIndex: 1 });
    client1.emit('cricket:delivery', { matchId, number: 2, ballIndex: 1 });
    const d3Result = await d3ResultPromise;
    expect(d3Result.deliveryRecord.runsScored).toBe(6);

    // --- INNINGS 2: Delivery 2 (s2 hits 2, reaches 8 >= target 7 -> s2 WINS!) ---
    const d4ResultPromise = new Promise((resolve) => client1.once('cricket:delivery-result', resolve));
    const matchEndedPromise = new Promise((resolve) => client1.once('match:ended', resolve));

    client2.emit('cricket:delivery', { matchId, number: 2, ballIndex: 2 });
    client1.emit('cricket:delivery', { matchId, number: 1, ballIndex: 2 });

    const [d4Result, matchEnded] = await Promise.all([d4ResultPromise, matchEndedPromise]);
    expect(d4Result.isMatchOver).toBe(true);
    expect(matchEnded.winnerNickname).toBe(s2.nickname);
  }, 15000);
});
