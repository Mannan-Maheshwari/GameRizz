import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { createApp } from '../app.js';
import { initializeSocketServer } from '../sockets/socketServer.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';
import { moderationService } from '../services/moderation/moderationService.js';
import { env } from '../config/environment.js';

describe('Phase 7: Reporting, Moderation & Admin Security', () => {
  let app;
  let server;
  let io;
  let serverPort;
  const clients = [];

  beforeEach(async () => {
    sessionManager.resetForTesting();
    matchLifecycleService.resetForTesting();
    moderationService.resetForTesting();

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

  it('Creates a moderation ticket, terminates active match, and rejects duplicate report (FR-063 - FR-067)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const match = matchLifecycleService.createMatch('rps', s1, s2);

    expect(match.status).toBe('active');

    // Submit report via REST API
    const res = await request(app)
      .post('/api/reports')
      .set('x-session-id', s1.sessionId)
      .set('x-session-secret', s1.sessionSecret)
      .send({
        matchId: match.matchId,
        category: 'harassment',
        reporterNote: 'Using abusive language in chat.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticketId).toBeDefined();
    expect(res.body.data.isDuplicate).toBe(false);

    // Verify active match was terminated immediately (FR-066)
    const updatedMatch = matchLifecycleService.getMatch(match.matchId);
    expect(updatedMatch.status).toBe('ended');
    expect(updatedMatch.endReason).toBe('reported');

    // Duplicate submission for the same match & reporter (FR-067)
    const dupRes = await request(app)
      .post('/api/reports')
      .set('x-session-id', s1.sessionId)
      .set('x-session-secret', s1.sessionSecret)
      .send({
        matchId: match.matchId,
        category: 'harassment'
      });

    expect(dupRes.status).toBe(201);
    expect(dupRes.body.data.isDuplicate).toBe(true);
    expect(dupRes.body.data.ticketId).toBe(res.body.data.ticketId);
  });

  it('Rejects report from an outsider not in the match (FR-095)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const outsider = sessionManager.createSession();
    const match = matchLifecycleService.createMatch('rps', s1, s2);

    const res = await request(app)
      .post('/api/reports')
      .set('x-session-id', outsider.sessionId)
      .set('x-session-secret', outsider.sessionSecret)
      .send({
        matchId: match.matchId,
        category: 'spam'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('UNAUTHORIZED_REPORT');
  });

  it('Submits report over Socket.IO and emits match:ended to both participants (FR-066)', async () => {
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();

    const client1 = await createConnectedClientSocket(s1);
    const client2 = await createConnectedClientSocket(s2);

    // Match them via queue
    const matchFoundPromise = new Promise((resolve) => client1.once('match:found', resolve));
    client1.emit('queue:join', { gameType: 'rps' });
    client2.emit('queue:join', { gameType: 'rps' });
    const matchData = await matchFoundPromise;
    const matchId = matchData.matchId;

    // Both players listen for match:ended
    const matchEndedPromise1 = new Promise((resolve) => client1.once('match:ended', resolve));
    const matchEndedPromise2 = new Promise((resolve) => client2.once('match:ended', resolve));
    const reportResultPromise = new Promise((resolve) => client1.once('moderation:report-result', resolve));

    client1.emit('moderation:report', {
      matchId,
      category: 'threats',
      reporterNote: 'Unsafe behavior'
    });

    const [reportResult, matchEnded1, matchEnded2] = await Promise.all([
      reportResultPromise,
      matchEndedPromise1,
      matchEndedPromise2
    ]);

    expect(reportResult.success).toBe(true);
    expect(reportResult.ticketId).toBeDefined();
    expect(matchEnded1.reason).toBe('reported');
    expect(matchEnded2.reason).toBe('reported');

    // Verify match state ended on server
    expect(matchLifecycleService.getMatch(matchId).status).toBe('ended');
  }, 15000);

  it('Enforces admin authentication and rejects unauthorized access (FR-081, FR-082)', async () => {
    // Attempt to access admin routes without credentials
    const unauth = await request(app).get('/api/admin/reports');
    expect(unauth.status).toBe(401);
    expect(unauth.body.error.code).toBe('UNAUTHORIZED');

    // Attempt login with invalid credentials
    const badLogin = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    // Valid admin login
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    const token = loginRes.body.data.token;
    expect(token).toBeDefined();

    // Access admin routes with valid bearer token
    const reportsRes = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${token}`);
    expect(reportsRes.status).toBe(200);
    expect(Array.isArray(reportsRes.body.data.tickets)).toBe(true);
  });

  it('Supports admin ticket review, decision resolution, and audit trail (FR-087, FR-088, FR-089)', async () => {
    // Create a ticket
    const s1 = sessionManager.createSession();
    const s2 = sessionManager.createSession();
    const match = matchLifecycleService.createMatch('rps', s1, s2);
    const createRes = await moderationService.createTicket({
      matchId: match.matchId,
      category: 'hate_speech',
      reporterSessionId: s1.sessionId,
      reportedSessionId: s2.sessionId,
      reporterNickname: s1.nickname,
      reportedNickname: s2.nickname,
      reporterNote: 'Offensive language'
    });

    const ticketId = createRes.ticket.ticketId;

    // Login as admin
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
    const token = loginRes.body.data.token;

    // Admin updates ticket decision
    const updateRes = await request(app)
      .patch(`/api/admin/reports/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'action_taken',
        decision: 'issued_warning',
        decisionReason: 'Violation confirmed upon review.'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.ticket.status).toBe('action_taken');
    expect(updateRes.body.data.ticket.decision).toBe('issued_warning');

    // Check audit logs
    const auditRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.data.auditLogs;
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].targetId).toBe(ticketId);
    expect(logs[0].adminUsername).toBe(env.ADMIN_USERNAME);
  });

  it('Issues enforcement ban and allows admin reversal (FR-070, FR-074)', async () => {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
    const token = loginRes.body.data.token;

    const targetSessionId = 'bad_actor_session_123';

    // Issue temporary ban
    const banRes = await request(app)
      .post('/api/admin/enforcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetSessionId,
        type: 'temporary_ban',
        reason: 'Severe abuse',
        durationHours: 48
      });

    expect(banRes.status).toBe(200);
    const enforcementId = banRes.body.data.enforcement.enforcementId;
    expect(moderationService.isBanned(targetSessionId)).toBe(true);

    // Reverse ban
    const revRes = await request(app)
      .post(`/api/admin/enforcements/${enforcementId}/reverse`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Appeal accepted after review' });

    expect(revRes.status).toBe(200);
    expect(revRes.body.data.enforcement.reversedAt).toBeDefined();
    expect(moderationService.isBanned(targetSessionId)).toBe(false);
  });
});
