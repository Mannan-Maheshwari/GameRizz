import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { createApp } from '../app.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { initializeSocketServer } from '../sockets/socketServer.js';

describe('Phase 2: Backend Foundation & Real-Time Connections', () => {
  let app;
  let server;
  let io;
  let serverPort;

  beforeEach(() => {
    sessionManager.resetForTesting();
  });

  afterAll(async () => {
    if (io) io.close();
    if (server) await new Promise(resolve => server.close(resolve));
  });

  it('Health endpoint returns 200 with uptime (FR-097)', async () => {
    app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('Games endpoint returns supported games (FR-008)', async () => {
    app = createApp();
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.map(g => g.id)).toContain('rps');
    expect(res.body.data.map(g => g.id)).toContain('cricket');
  });

  it('Creates an anonymous guest session with valid adult confirmation (FR-002, FR-003, FR-004)', async () => {
    app = createApp();
    
    // Missing adult confirmation
    const badRes = await request(app).post('/api/session').send({});
    expect(badRes.status).toBe(400);
    expect(badRes.body.success).toBe(false);

    // Valid adult confirmation
    const goodRes = await request(app).post('/api/session').send({ confirmedAdult: true });
    expect(goodRes.status).toBe(201);
    expect(goodRes.body.success).toBe(true);
    expect(goodRes.body.data.sessionId).toBeDefined();
    expect(goodRes.body.data.sessionSecret).toBeDefined();
    expect(goodRes.body.data.nickname).toBeDefined();
  });

  it('Allows changing nickname with uniqueness and validation enforcement (FR-005, FR-006, FR-007)', async () => {
    app = createApp();
    const s1 = (await request(app).post('/api/session').send({ confirmedAdult: true })).body.data;
    const s2 = (await request(app).post('/api/session').send({ confirmedAdult: true })).body.data;

    // Change s1 nickname to "CyberFox"
    const patch1 = await request(app)
      .patch('/api/session/nickname')
      .set('x-session-id', s1.sessionId)
      .set('x-session-secret', s1.sessionSecret)
      .send({ nickname: 'CyberFox' });

    expect(patch1.status).toBe(200);
    expect(patch1.body.data.nickname).toBe('CyberFox');

    // Attempting to change s2 nickname to "cyberfox" (case-insensitive collision check)
    const patchCollision = await request(app)
      .patch('/api/session/nickname')
      .set('x-session-id', s2.sessionId)
      .set('x-session-secret', s2.sessionSecret)
      .send({ nickname: 'cyberfox' });

    expect(patchCollision.status).toBe(409);
    expect(patchCollision.body.error.code).toBe('NICKNAME_TAKEN');

    // Reject invalid characters
    const patchInvalid = await request(app)
      .patch('/api/session/nickname')
      .set('x-session-id', s2.sessionId)
      .set('x-session-secret', s2.sessionSecret)
      .send({ nickname: '<script>alert(1)</script>' });

    expect(patchInvalid.status).toBe(400);

    // Reject profanity
    const patchProfane = await request(app)
      .patch('/api/session/nickname')
      .set('x-session-id', s2.sessionId)
      .set('x-session-secret', s2.sessionSecret)
      .send({ nickname: 'bad_bitch_99' });

    expect(patchProfane.status).toBe(400);
  });

  it('Authenticates and connects Socket.IO with valid session credentials (FR-099, FR-100)', async () => {
    app = createApp();
    server = http.createServer(app);
    io = initializeSocketServer(server);

    await new Promise(resolve => server.listen(0, resolve));
    serverPort = server.address().port;

    const sessionRes = await request(app).post('/api/session').send({ confirmedAdult: true });
    const { sessionId, sessionSecret, nickname } = sessionRes.body.data;

    // 1. Connection with invalid credentials should fail
    const badClient = Client(`http://localhost:${serverPort}`, {
      auth: { sessionId: 'invalid-id', sessionSecret: 'invalid-secret' },
      transports: ['websocket'],
      autoConnect: true
    });

    const connectError = await new Promise((resolve) => {
      badClient.on('connect_error', (err) => resolve(err.message));
    });
    badClient.close();
    expect(connectError).toContain('Invalid or expired session');

    // 2. Connection with valid credentials should succeed and receive session:ready
    const goodClient = Client(`http://localhost:${serverPort}`, {
      auth: { sessionId, sessionSecret },
      transports: ['websocket'],
      autoConnect: true
    });

    const readyData = await new Promise((resolve) => {
      goodClient.on('session:ready', (data) => resolve(data));
    });

    expect(readyData.sessionId).toBe(sessionId);
    expect(readyData.nickname).toBe(nickname);
    expect(readyData.status).toBe('lobby');

    goodClient.close();
  });
});
