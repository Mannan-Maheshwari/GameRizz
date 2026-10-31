import { matchLifecycleService } from '../../services/matches/matchLifecycleService.js';
import { chatSendSchema, chatReactionSchema } from '../../validators/socketValidator.js';
import crypto from 'crypto';

// In-memory sliding window trackers for socket chat (FR-054, FR-062)
const messageTimestamps = new Map(); // sessionId -> number[]
const reactionTimestamps = new Map(); // sessionId -> number[]
const matchSequenceCounters = new Map(); // matchId -> seq number

function checkRateLimit(map, sessionId, maxBurst = 5, windowMs = 5000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (map.get(sessionId) || []).filter(t => t > windowStart);

  if (timestamps.length >= maxBurst) {
    return false;
  }

  timestamps.push(now);
  map.set(sessionId, timestamps);
  return true;
}

export function registerChatHandlers(io, socket) {
  // Chat Message Submission (FR-053 - FR-057, FR-059, FR-060)
  socket.on('chat:send', (payload) => {
    const parse = chatSendSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('chat:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid chat message payload.'
      });
    }

    const { matchId, text } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);

    // Chat available ONLY during active matches (FR-059)
    if (!match || match.status !== 'active') {
      return socket.emit('chat:error', {
        code: 'MATCH_NOT_ACTIVE',
        message: 'Chat is only available during an active match.'
      });
    }

    // Verify session belongs to match (FR-062)
    if (!match.playerSessionIds.includes(socket.sessionId)) {
      return socket.emit('chat:error', {
        code: 'UNAUTHORIZED_CHAT',
        message: 'You are not a participant in this match.'
      });
    }

    // Rate Limit: Max 5 messages in 5 seconds (FR-054)
    if (!checkRateLimit(messageTimestamps, socket.sessionId, 5, 5000)) {
      return socket.emit('chat:error', {
        code: 'CHAT_RATE_LIMITED',
        message: 'Too many messages sent. Please slow down.'
      });
    }

    // Monotonic sequence numbering per match (FR-056)
    const currentSeq = (matchSequenceCounters.get(matchId) || 0) + 1;
    matchSequenceCounters.set(matchId, currentSeq);

    const senderPlayer = match.players.find(p => p.sessionId === socket.sessionId);
    const messageId = `msg_${crypto.randomBytes(6).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const roomName = `match:${matchId}`;
    io.to(roomName).emit('chat:message', {
      matchId,
      messageId,
      senderSessionId: socket.sessionId,
      senderNickname: senderPlayer?.nickname || 'Stranger',
      text, // Safely handled on client as plain text (FR-055)
      seq: currentSeq,
      timestamp
    });
  });

  // Predefined Reactions Submission (FR-058)
  socket.on('chat:reaction-send', (payload) => {
    const parse = chatReactionSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('chat:error', {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message || 'Invalid reaction payload.'
      });
    }

    const { matchId, reaction } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);

    if (!match || match.status !== 'active') {
      return socket.emit('chat:error', {
        code: 'MATCH_NOT_ACTIVE',
        message: 'Reactions are only available during an active match.'
      });
    }

    if (!match.playerSessionIds.includes(socket.sessionId)) {
      return socket.emit('chat:error', {
        code: 'UNAUTHORIZED_CHAT',
        message: 'You are not a participant in this match.'
      });
    }

    // Rate Limit: Max 5 reactions in 5 seconds (FR-058)
    if (!checkRateLimit(reactionTimestamps, socket.sessionId, 5, 5000)) {
      return socket.emit('chat:error', {
        code: 'REACTION_RATE_LIMITED',
        message: 'Too many reactions sent. Please slow down.'
      });
    }

    const senderPlayer = match.players.find(p => p.sessionId === socket.sessionId);
    const timestamp = new Date().toISOString();

    const roomName = `match:${matchId}`;
    io.to(roomName).emit('chat:reaction', {
      matchId,
      senderSessionId: socket.sessionId,
      senderNickname: senderPlayer?.nickname || 'Stranger',
      reaction,
      timestamp
    });
  });
}
