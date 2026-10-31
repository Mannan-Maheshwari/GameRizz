import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { createApp } from '../app.js';
import { initializeSocketServer } from '../sockets/socketServer.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { matchmakingService } from '../services/matchmaking/matchmakingService.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';

describe('Phase 3: Matchmaking Engine & Queues', () => {
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

  it('Pairs two users in the same queue and emits match:found to both (FR-011, FR-013, FR-019)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    const matchFoundPromise1 = new Promise((resolve) => client1.once('match:found', resolve));
    const matchFoundPromise2 = new Promise((resolve) => client2.once('match:found', resolve));

    // Client 1 joins 'rps'
    client1.emit('queue:join', { gameType: 'rps' });
    // Client 2 joins 'rps'
    client2.emit('queue:join', { gameType: 'rps' });

    const [matchData1, matchData2] = await Promise.all([matchFoundPromise1, matchFoundPromise2]);

    expect(matchData1.matchId).toBeDefined();
    expect(matchData1.matchId).toBe(matchData2.matchId);
    expect(matchData1.gameType).toBe('rps');
    expect(matchData1.opponentNickname).toBe(s2.nickname);
    expect(matchData2.opponentNickname).toBe(s1.nickname);

    const activeMatch = matchLifecycleService.getMatch(matchData1.matchId);
    expect(activeMatch).toBeDefined();
    expect(activeMatch.status).toBe('active');
  });

  it('Queue cancellation prevents later pairing (FR-018)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    // Client 1 joins and cancels
    client1.emit('queue:join', { gameType: 'rps' });
    const cancelPromise = new Promise((resolve) => client1.once('queue:cancelled', resolve));
    client1.emit('queue:cancel');
    await cancelPromise;

    // Client 2 joins 'rps' - Client 1 should NOT be matched
    let client1Matched = false;
    client1.on('match:found', () => { client1Matched = true; });

    client2.emit('queue:join', { gameType: 'rps' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(client1Matched).toBe(false);
    expect(matchmakingService.getQueueStatus('rps').waitersCount).toBe(1);
  });

  it('Does NOT pair mutually blocked players (FR-075)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    let matched = false;
    client1.on('match:found', () => { matched = true; });
    client2.on('match:found', () => { matched = true; });

    // Client 1 joins with Client 2's sessionId in blocklist
    client1.emit('queue:join', { gameType: 'rps', clientBlocklist: [s2.sessionId] });
    client2.emit('queue:join', { gameType: 'rps' });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(matched).toBe(false);
    expect(matchmakingService.getQueueStatus('rps').waitersCount).toBe(2);
  });

  it('Offers and executes atomic queue switch to alternative game (FR-016)', async () => {
    const s1 = sessionManager.createSession(); // Waits in cricket
    const s2 = sessionManager.createSession(); // Joins rps, gets offered cricket

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    // Client 1 joins cricket queue
    client1.emit('queue:join', { gameType: 'cricket' });

    const switchOfferPromise = new Promise((resolve) => client2.once('queue:switch-offer', resolve));
    const matchFoundPromise1 = new Promise((resolve) => client1.once('match:found', resolve));
    const matchFoundPromise2 = new Promise((resolve) => client2.once('match:found', resolve));

    // Client 2 joins rps queue
    client2.emit('queue:join', { gameType: 'rps' });

    const offer = await switchOfferPromise;
    expect(offer.proposedGame).toBe('cricket');

    // Client 2 accepts switch to cricket
    client2.emit('queue:switch-respond', { accept: true });

    const [match1, match2] = await Promise.all([matchFoundPromise1, matchFoundPromise2]);
    expect(match1.matchId).toBe(match2.matchId);
    expect(match1.gameType).toBe('cricket');
  });

  it('Disconnect cleanup removes player from queue (FR-021, FR-105)', async () => {
    const s1 = sessionManager.createSession();
    const client1 = await createConnectedClientSocket(s1);

    client1.emit('queue:join', { gameType: 'rps' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(matchmakingService.getQueueStatus('rps').waitersCount).toBe(1);

    // Disconnect client 1
    client1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(matchmakingService.getQueueStatus('rps').waitersCount).toBe(0);
  });
});
