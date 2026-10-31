import { Server } from 'socket.io';
import { env } from '../config/environment.js';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { socketAuthSchema } from '../validators/socketValidator.js';
import { registerMatchmakingHandlers } from './handlers/matchmakingHandlers.js';
import { registerRpsHandlers } from './handlers/rpsHandlers.js';
import { registerCricketHandlers } from './handlers/cricketHandlers.js';
import { registerChatHandlers } from './handlers/chatHandlers.js';
import { registerModerationHandlers } from './handlers/moderationHandlers.js';
import { matchmakingService } from '../services/matchmaking/matchmakingService.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';

export function initializeSocketServer(httpServer) {
  const clientOrigin = new URL(env.CLIENT_ORIGIN);
  const allowedOrigins = [...new Set([
    env.CLIENT_ORIGIN,
    `${clientOrigin.protocol}//localhost:${clientOrigin.port || (clientOrigin.protocol === 'https:' ? '443' : '80')}`,
    `${clientOrigin.protocol}//127.0.0.1:${clientOrigin.port || (clientOrigin.protocol === 'https:' ? '443' : '80')}`
  ])];

  const corsOriginCheck = (origin, callback) => {
    // In development, allow local network IPs (e.g. testing on mobile over Wi-Fi)
    if (!origin || env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origin not allowed by Socket.IO CORS'), false);
  };

  const io = new Server(httpServer, {
    cors: {
      origin: corsOriginCheck,
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000
  });

  // Socket Authentication Middleware (FR-099, FR-100)
  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const parse = socketAuthSchema.safeParse(auth);

    if (!parse.success) {
      const err = new Error('Authentication required: missing or invalid sessionId/sessionSecret');
      err.data = { code: 'AUTH_REQUIRED' };
      return next(err);
    }

    const { sessionId, sessionSecret } = parse.data;
    const session = sessionManager.validateSessionSecret(sessionId, sessionSecret);

    if (!session) {
      const err = new Error('Invalid or expired session');
      err.data = { code: 'INVALID_SESSION' };
      return next(err);
    }

    socket.sessionId = sessionId;
    socket.session = session;
    next();
  });

  io.on('connection', (socket) => {
    const session = sessionManager.bindSocket(socket.sessionId, socket.id);

    // Rejoin active match room and update socketId if in an ongoing match
    if (session?.matchId) {
      const match = matchLifecycleService.getMatch(session.matchId);
      if (match && match.status === 'active') {
        socket.join(`match:${session.matchId}`);
        const p = match.players.find(pl => pl.sessionId === socket.sessionId);
        if (p) p.socketId = socket.id;
      }
    }

    // Confirm session is ready
    socket.emit('session:ready', {
      sessionId: session.sessionId,
      nickname: session.nickname,
      status: session.status,
      matchId: session.matchId
    });

    // Connection status broadcast
    socket.emit('connection:status', { status: 'connected' });

    // Handle session resumption
    socket.on('session:resume', (payload) => {
      const parse = socketAuthSchema.safeParse(payload);
      if (!parse.success) {
        return socket.emit('session:error', { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
      }
      const s = sessionManager.validateSessionSecret(parse.data.sessionId, parse.data.sessionSecret);
      if (!s) {
        return socket.emit('session:error', { code: 'SESSION_EXPIRED', message: 'Session expired or not found.' });
      }
      socket.sessionId = s.sessionId;
      socket.session = s;
      sessionManager.bindSocket(s.sessionId, socket.id);

      if (s.matchId) {
        const match = matchLifecycleService.getMatch(s.matchId);
        if (match && match.status === 'active') {
          socket.join(`match:${s.matchId}`);
          const p = match.players.find(pl => pl.sessionId === s.sessionId);
          if (p) p.socketId = socket.id;
        }
      }

      socket.emit('session:ready', {
        sessionId: s.sessionId,
        nickname: s.nickname,
        status: s.status,
        matchId: s.matchId
      });
    });

    // Register Matchmaking Handlers
    registerMatchmakingHandlers(io, socket);

    // Register RPS Game Handlers
    registerRpsHandlers(io, socket);

    // Register Hand Cricket Handlers
    registerCricketHandlers(io, socket);

    // Register Ephemeral Chat Handlers
    registerChatHandlers(io, socket);

    // Register Moderation Handlers
    registerModerationHandlers(io, socket);

    // Handle Disconnect (FR-021, FR-050, FR-105)
    socket.on('disconnect', (reason) => {
      sessionManager.unbindSocket(socket.id, env.RECONNECT_GRACE_PERIOD_SECONDS);
      
      // Cleanup from matchmaking queue immediately
      matchmakingService.handleDisconnect(socket.id);

      // If in active match, notify opponent
      const match = matchLifecycleService.getMatchBySession(socket.sessionId);
      if (match && match.status === 'active') {
        const roomName = `match:${match.matchId}`;
        io.to(roomName).emit('opponent:disconnected', {
          matchId: match.matchId,
          gracePeriodSeconds: env.RECONNECT_GRACE_PERIOD_SECONDS
        });
      }
    });
  });

  return io;
}
