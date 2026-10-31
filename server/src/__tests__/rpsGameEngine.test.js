import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { createApp } from '../app.js';
import { initializeSocketServer } from '../sockets/socketServer.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { matchmakingService } from '../services/matchmaking/matchmakingService.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';
import { RpsGameEngine } from '../services/games/rpsGameEngine.js';

describe('Phase 4: Rock Paper Scissors Game Engine Unit Tests', () => {
  const p1 = { sessionId: 'player1', nickname: 'NinjaFox', socketId: 'sock1' };
  const p2 = { sessionId: 'player2', nickname: 'CyberWolf', socketId: 'sock2' };

  it('Resolves all 9 combinations and ties correctly (FR-030)', () => {
    const engine = new RpsGameEngine('test_match', [p1, p2]);

    // Rock defeats Scissors
    expect(engine.determineWinner('rock', 'scissors')).toBe('player1');
    expect(engine.determineWinner('scissors', 'rock')).toBe('player2');

    // Scissors defeats Paper
    expect(engine.determineWinner('scissors', 'paper')).toBe('player1');
    expect(engine.determineWinner('paper', 'scissors')).toBe('player2');

    // Paper defeats Rock
    expect(engine.determineWinner('paper', 'rock')).toBe('player1');
    expect(engine.determineWinner('rock', 'paper')).toBe('player2');

    // Identical moves result in a tied round
    expect(engine.determineWinner('rock', 'rock')).toBe('tie');
    expect(engine.determineWinner('paper', 'paper')).toBe('tie');
    expect(engine.determineWinner('scissors', 'scissors')).toBe('tie');

    engine.destroy();
  });

  it('Enforces best of three format: first to 2 round wins takes match (FR-028, FR-035)', () => {
    const engine = new RpsGameEngine('test_match', [p1, p2]);

    // Round 1: Rock vs Scissors -> Player 1 wins
    const r1 = engine.submitMove('player1', 'rock');
    expect(r1.isRoundResolved).toBe(false);
    const r1Resolved = engine.submitMove('player2', 'scissors');
    expect(r1Resolved.isRoundResolved).toBe(true);
    expect(r1Resolved.roundResult.isMatchOver).toBe(false);
    expect(engine.scores['player1']).toBe(1);
    expect(engine.scores['player2']).toBe(0);
    expect(engine.round).toBe(2);

    // Round 2: Rock vs Rock -> Tie (does not increment scores)
    engine.submitMove('player1', 'rock');
    const r2Resolved = engine.submitMove('player2', 'rock');
    expect(r2Resolved.isRoundResolved).toBe(true);
    expect(r2Resolved.roundResult.isMatchOver).toBe(false);
    expect(r2Resolved.roundResult.roundData.isTie).toBe(true);
    expect(engine.scores['player1']).toBe(1);
    expect(engine.scores['player2']).toBe(0);
    expect(engine.round).toBe(3);

    // Round 3: Paper vs Rock -> Player 1 wins round 2 -> Wins match!
    engine.submitMove('player1', 'paper');
    const r3Resolved = engine.submitMove('player2', 'rock');
    expect(r3Resolved.isRoundResolved).toBe(true);
    expect(r3Resolved.roundResult.isMatchOver).toBe(true);
    expect(r3Resolved.roundResult.matchWinnerSessionId).toBe('player1');
    expect(r3Resolved.roundResult.matchWinnerNickname).toBe('NinjaFox');
    expect(engine.status).toBe('MATCH_OVER');

    // Reject moves after match over (FR-035)
    const postMatch = engine.submitMove('player1', 'rock');
    expect(postMatch.success).toBe(false);
    expect(postMatch.error.code).toBe('MATCH_OVER');

    engine.destroy();
  });

  it('Rejects duplicate moves and stale round numbers (FR-032, FR-052)', () => {
    const engine = new RpsGameEngine('test_match', [p1, p2]);

    // Submit move
    const m1 = engine.submitMove('player1', 'rock', 1);
    expect(m1.success).toBe(true);

    // Duplicate move
    const mDuplicate = engine.submitMove('player1', 'paper', 1);
    expect(mDuplicate.success).toBe(false);
    expect(mDuplicate.error.code).toBe('MOVE_ALREADY_SUBMITTED');

    // Stale round number
    const mStale = engine.submitMove('player2', 'paper', 99);
    expect(mStale.success).toBe(false);
    expect(mStale.error.code).toBe('STALE_ROUND');

    engine.destroy();
  });

  it('Resolves move timeout by awarding round to the submitting player (FR-033)', () => {
    const engine = new RpsGameEngine('test_match', [p1, p2]);

    // Player 1 submitted 'scissors', Player 2 did not submit
    engine.submitMove('player1', 'scissors');

    // Simulate timeout
    engine.handleTimeout();

    expect(engine.roundHistory.length).toBe(1);
    const round1 = engine.roundHistory[0];
    expect(round1.isTimeout).toBe(true);
    expect(round1.winnerSessionId).toBe('player1');
    expect(engine.scores['player1']).toBe(1);

    engine.destroy();
  });
});

describe('Phase 4: Rock Paper Scissors Socket Integration', () => {
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
      if (c && c.connected) c.disconnect();
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

  it('Executes full two-player RPS match over Socket.IO to 2-0 completion', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    client1.on('rps:error', (err) => console.error('Client1 RPS Error:', err));
    client2.on('rps:error', (err) => console.error('Client2 RPS Error:', err));

    // --- ROUND 1 ---
    const round1ResultPromise = new Promise((resolve) => client1.once('rps:round-result', resolve));

    client1.emit('rps:move', { matchId, move: 'rock', round: 1 });
    client2.emit('rps:move', { matchId, move: 'scissors', round: 1 });

    const round1Result = await round1ResultPromise;
    expect(round1Result.roundData.round).toBe(1);
    expect(round1Result.roundData.winnerSessionId).toBe(s1.sessionId);
    expect(round1Result.isMatchOver).toBe(false);

    // --- ROUND 2 ---
    const round2ResultPromise = new Promise((resolve) => client1.once('rps:round-result', resolve));
    const matchResultPromise = new Promise((resolve) => client1.once('rps:match-result', resolve));

    client1.emit('rps:move', { matchId, move: 'paper', round: 2 });
    client2.emit('rps:move', { matchId, move: 'rock', round: 2 });

    const [round2Result, matchResult] = await Promise.all([round2ResultPromise, matchResultPromise]);

    expect(round2Result.roundData.winnerSessionId).toBe(s1.sessionId);
    expect(round2Result.isMatchOver).toBe(true);
    expect(matchResult.winnerSessionId).toBe(s1.sessionId);
    expect(matchResult.winnerNickname).toBe(s1.nickname);

    // Verify server authoritative match is ended
    const activeMatch = matchLifecycleService.getMatch(matchId);
    expect(activeMatch.status).toBe('ended');
    expect(activeMatch.endReason).toBe('completed');
  }, 15000);
});
