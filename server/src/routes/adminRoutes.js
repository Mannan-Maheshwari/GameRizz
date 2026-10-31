import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/environment.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { moderationService } from '../services/moderation/moderationService.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Brute-force protection for admin login (FR-085)
const adminLoginLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Too many admin login attempts. Please wait 1 minute.'
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Admin Login (FR-083, FR-084, FR-085)
router.post('/admin/login', adminLoginLimiter, (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Username and password are required.' }
    });
  }

  const { username, password } = parse.data;

  // Constant-time check / string match
  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid admin credentials.' }
    });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    env.ADMIN_JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      token,
      admin: { username, role: 'admin' }
    }
  });
});

// Admin Logout
router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Session Check
router.get('/admin/session', adminAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      admin: req.admin
    }
  });
});

// Get Tickets with optional filters (FR-086, FR-091)
router.get('/admin/reports', adminAuth, async (req, res) => {
  const { status, category } = req.query;
  const tickets = await moderationService.getTickets({ status, category });
  res.json({
    success: true,
    data: { tickets }
  });
});

// Get Single Ticket (FR-087)
router.get('/admin/reports/:id', adminAuth, async (req, res) => {
  const ticket = await moderationService.getTicketById(req.params.id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Moderation ticket not found.' }
    });
  }
  res.json({
    success: true,
    data: { ticket }
  });
});

// Update Ticket Decision (FR-068, FR-069, FR-088)
router.patch('/admin/reports/:id', adminAuth, async (req, res) => {
  const { status, decision, decisionReason } = req.body;
  const updated = await moderationService.updateTicket(req.params.id, {
    status,
    decision,
    decisionReason,
    adminUsername: req.admin.username
  });

  if (!updated) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Moderation ticket not found.' }
    });
  }

  res.json({
    success: true,
    data: { ticket: updated }
  });
});

// Issue Enforcement (FR-074, FR-088)
router.post('/admin/enforcements', adminAuth, async (req, res) => {
  const { targetSessionId, type, reason, durationHours } = req.body;
  if (!targetSessionId || !reason) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'targetSessionId and reason are required.' }
    });
  }

  const enforcement = await moderationService.issueEnforcement({
    targetSessionId,
    type,
    reason,
    durationHours,
    adminUsername: req.admin.username
  });

  res.json({
    success: true,
    data: { enforcement }
  });
});

// Reverse Enforcement (FR-070, FR-088)
router.post('/admin/enforcements/:id/reverse', adminAuth, async (req, res) => {
  const { reason } = req.body;
  const reversed = await moderationService.reverseEnforcement(req.params.id, {
    reason,
    adminUsername: req.admin.username
  });

  if (!reversed) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Enforcement record not found.' }
    });
  }

  res.json({
    success: true,
    data: { enforcement: reversed }
  });
});

// Get Audit Logs (FR-089)
router.get('/admin/audit-logs', adminAuth, (req, res) => {
  const logs = moderationService.getAuditLogs();
  res.json({
    success: true,
    data: { auditLogs: logs }
  });
});

export default router;
