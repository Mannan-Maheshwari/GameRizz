import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { createApp } from '../app.js';
import { initializeSocketServer } from '../sockets/socketServer.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { matchmakingService } from '../services/matchmaking/matchmakingService.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';

describe('Phase 6: Ephemeral Text Chat & Reactions', () => {
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

  it('Delivers chat messages in sequential order with metadata between matched strangers (FR-053, FR-056)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    // Match them
    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    client1.on('chat:error', (err) => console.error('CLIENT1 CHAT ERR:', err));
    client2.on('chat:error', (err) => console.error('CLIENT2 CHAT ERR:', err));

    // Send first message from client1
    const msg1Promise = new Promise((resolve) => client2.once('chat:message', resolve));
    client1.emit('chat:send', { matchId, text: 'Hello stranger! Good luck!' });
    const msg1 = await msg1Promise;

    expect(msg1.senderSessionId).toBe(s1.sessionId);
    expect(msg1.senderNickname).toBe(s1.nickname);
    expect(msg1.text).toBe('Hello stranger! Good luck!');
    expect(msg1.seq).toBe(1);
    expect(msg1.timestamp).toBeDefined();

    // Send second message from client2
    const msg2Promise = new Promise((resolve) => client1.once('chat:message', resolve));
    client2.emit('chat:send', { matchId, text: 'Thanks! Let’s have fun! 🚀' });
    const msg2 = await msg2Promise;

    expect(msg2.senderSessionId).toBe(s2.sessionId);
    expect(msg2.senderNickname).toBe(s2.nickname);
    expect(msg2.text).toBe('Thanks! Let’s have fun! 🚀');
    expect(msg2.seq).toBe(2);
  }, 15000);

  it('Rejects messages exceeding 500 characters (FR-054)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    const oversizedText = 'a'.repeat(501);
    const errorPromise = new Promise((resolve) => client1.once('chat:error', resolve));
    client1.emit('chat:send', { matchId, text: oversizedText });
    const err = await errorPromise;

    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toContain('500 characters');
  }, 15000);

  it('Enforces chat rate limiting on rapid burst (>5 messages in 5 seconds) (FR-054)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    // Send 5 rapid messages (all allowed)
    for (let i = 1; i <= 5; i++) {
      client1.emit('chat:send', { matchId, text: `Spam #${i}` });
    }

    // 6th message should be rate limited
    const rateLimitPromise = new Promise((resolve) => client1.once('chat:error', resolve));
    client1.emit('chat:send', { matchId, text: 'Burst breaker #6' });
    const err = await rateLimitPromise;

    expect(err.code).toBe('CHAT_RATE_LIMITED');
  }, 15000);

  it('Delivers predefined reactions between players (FR-058)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    const reactionPromise = new Promise((resolve) => client2.once('chat:reaction', resolve));
    client1.emit('chat:reaction-send', { matchId, reaction: '🎉' });
    const reaction = await reactionPromise;

    expect(reaction.senderSessionId).toBe(s1.sessionId);
    expect(reaction.reaction).toBe('🎉');
    expect(reaction.timestamp).toBeDefined();
  }, 15000);

  it('Rejects chat messages after match ends or from outsiders (FR-059, FR-062)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const s3 = sessionManager.createSession(); // outsider

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);
    const client3 = await createConnectedClientSocket(s3);

    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    // Outsider attempts to send message to match
    const outsiderErrPromise = new Promise((resolve) => client3.once('chat:error', resolve));
    client3.emit('chat:send', { matchId, text: 'Hacking in!' });
    const outsiderErr = await outsiderErrPromise;
    expect(outsiderErr.code).toBe('UNAUTHORIZED_CHAT');

    // End match
    matchLifecycleService.endMatch(matchId, 'left');

    // Participant attempts to chat in ended match
    const endedErrPromise = new Promise((resolve) => client1.once('chat:error', resolve));
    client1.emit('chat:send', { matchId, text: 'Can anyone hear me?' });
    const endedErr = await endedErrPromise;
    expect(endedErr.code).toBe('MATCH_NOT_ACTIVE');
  }, 15000);
});
