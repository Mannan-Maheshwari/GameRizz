import express from 'express';
import { sessionManager } from '../services/sessions/sessionManager.js';
import { requireGuestSession } from '../middleware/auth.js';
import { createSessionSchema, updateNicknameSchema } from '../validators/sessionValidator.js';

const router = express.Router();

router.post('/session', (req, res, next) => {
  try {
    const parse = createSessionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parse.error.errors[0]?.message || 'Invalid session payload.'
        }
      });
    }

    const sessionData = sessionManager.createSession();
    return res.status(201).json({
      success: true,
      data: sessionData
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/session/nickname', requireGuestSession, (req, res, next) => {
  try {
    const parse = updateNicknameSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NICKNAME',
          message: parse.error.errors[0]?.message || 'Invalid nickname format.'
        }
      });
    }

    const result = sessionManager.updateNickname(req.session.sessionId, parse.data.nickname);
    if (!result.success) {
      return res.status(result.error.code === 'NICKNAME_TAKEN' ? 409 : 400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      data: {
        nickname: result.nickname
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/session/me', requireGuestSession, (req, res) => {
  const session = req.session;
  return res.json({
    success: true,
    data: {
      sessionId: session.sessionId,
      nickname: session.nickname,
      status: session.status,
      selectedGame: session.selectedGame,
      matchId: session.matchId,
      createdAt: session.createdAt
    }
  });
});

export default router;
