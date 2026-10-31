import express from 'express';
import { z } from 'zod';
import { moderationService } from '../services/moderation/moderationService.js';
import { matchLifecycleService } from '../services/matches/matchLifecycleService.js';
import { sessionManager } from '../services/sessions/sessionManager.js';

const router = express.Router();

const reportSchema = z.object({
  matchId: z.string().min(1),
  category: z.enum(['harassment', 'sexual_content', 'hate_speech', 'spam', 'threats', 'other']),
  reporterNote: z.string().max(300).optional().default('')
});

// POST /api/reports — Report abusive stranger and terminate match (FR-063 - FR-066)
router.post('/reports', async (req, res) => {
  const parse = reportSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message || 'Invalid report body.' }
    });
  }

  const sessionId = req.headers['x-session-id'];
  const sessionSecret = req.headers['x-session-secret'];

  if (!sessionId || !sessionSecret) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Session headers required.' }
    });
  }

  const session = sessionManager.validateSessionSecret(sessionId, sessionSecret);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SESSION', message: 'Invalid session credentials.' }
    });
  }

  const { matchId, category, reporterNote } = parse.data;
  const match = matchLifecycleService.getMatch(matchId);

  if (!match || !match.playerSessionIds.includes(sessionId)) {
    return res.status(403).json({
      success: false,
      error: { code: 'UNAUTHORIZED_REPORT', message: 'You are not a participant in this match.' }
    });
  }

  const opponent = matchLifecycleService.getOpponent(matchId, sessionId);

  const result = await moderationService.createTicket({
    matchId,
    category,
    reporterSessionId: sessionId,
    reportedSessionId: opponent?.sessionId || 'unknown',
    reporterNickname: session.nickname,
    reportedNickname: opponent?.nickname || 'Reported',
    reporterNote
  });

  res.status(201).json({
    success: true,
    data: {
      ticketId: result.ticket.ticketId,
      isDuplicate: result.isDuplicate,
      status: result.ticket.status
    }
  });
});

export default router;
