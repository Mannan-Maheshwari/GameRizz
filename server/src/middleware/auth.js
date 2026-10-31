import { sessionManager } from '../services/sessions/sessionManager.js';

export function requireGuestSession(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  const sessionSecret = req.headers['x-session-secret'];

  if (!sessionId || !sessionSecret) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED_SESSION',
        message: 'Valid session credentials are required.'
      }
    });
  }

  const session = sessionManager.validateSessionSecret(sessionId, sessionSecret);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Session has expired or credentials are invalid.'
      }
    });
  }

  req.session = session;
  next();
}
