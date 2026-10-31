import express from 'express';
import { isDatabaseReady } from '../config/database.js';
import { sessionManager } from '../services/sessions/sessionManager.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/ready', (req, res) => {
  const dbReady = isDatabaseReady();
  const stats = sessionManager.getActiveStats();

  // If database is not connected, respond with status 503 per FR-097 & Section 13.1
  const statusCode = dbReady ? 200 : 503;

  res.status(statusCode).json({
    success: dbReady,
    data: {
      status: dbReady ? 'ready' : 'degraded',
      database: dbReady ? 'connected' : 'disconnected',
      activeSessions: stats.activeSessions
    }
  });
});

export default router;
