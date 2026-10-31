import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../../config/environment.js';
import { matchLifecycleService } from '../matches/matchLifecycleService.js';
import { ModerationTicket } from '../../models/ModerationTicket.js';
import { EnforcementRecord } from '../../models/EnforcementRecord.js';
import { AuditLog } from '../../models/AuditLog.js';

class ModerationService {
  constructor() {
    this.tickets = new Map(); // ticketId -> ticket
    this.enforcements = new Map(); // enforcementId -> enforcement
    this.auditLogs = [];
  }

  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Create a moderation ticket and terminate match (FR-064, FR-066, FR-067)
  async createTicket({ matchId, reporterSessionId, reportedSessionId, reporterNickname, reportedNickname, category, reporterNote = '' }) {
    // Idempotency: Check if reporter has already submitted a report for this match (FR-067)
    for (const ticket of this.tickets.values()) {
      if (ticket.matchId === matchId && ticket.reporterSessionId === reporterSessionId) {
        return { success: true, ticket, isDuplicate: true };
      }
    }

    const ticketId = `ticket_${crypto.randomUUID()}`;
    const now = new Date();
    const retentionUntil = new Date(now.getTime() + (env.TICKET_RETENTION_DAYS * 24 * 60 * 60 * 1000));

    const ticket = {
      ticketId,
      matchId,
      category,
      reporterSessionId,
      reportedSessionId,
      reporterNickname: reporterNickname || 'Stranger',
      reportedNickname: reportedNickname || 'Reported Player',
      reporterNote: reporterNote.trim(),
      status: 'open',
      decision: null,
      decisionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now.toISOString(),
      retentionUntil: retentionUntil.toISOString()
    };

    // Store in-memory
    this.tickets.set(ticketId, ticket);

    // Terminate match (FR-066)
    matchLifecycleService.endMatch(matchId, 'reported');

    // Persist to MongoDB if connected
    if (this.isDbConnected()) {
      try {
        await ModerationTicket.create({
          ...ticket,
          createdAt: now,
          retentionUntil
        });
      } catch (err) {
        console.error('Failed to persist moderation ticket to MongoDB:', err.message);
      }
    }

    return { success: true, ticket, isDuplicate: false };
  }

  // List tickets with filters (FR-086, FR-091)
  async getTickets({ status, category } = {}) {
    let result = Array.from(this.tickets.values());

    if (status) {
      result = result.filter(t => t.status === status);
    }
    if (category) {
      result = result.filter(t => t.category === category);
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return result;
  }

  // Get ticket detail (FR-087)
  async getTicketById(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (ticket) return ticket;

    if (this.isDbConnected()) {
      try {
        const doc = await ModerationTicket.findOne({ ticketId }).lean();
        if (doc) {
          this.tickets.set(doc.ticketId, doc);
          return doc;
        }
      } catch {}
    }
    return null;
  }

  // Update ticket status or resolution (FR-068, FR-069, FR-088)
  async updateTicket(ticketId, { status, decision, decisionReason, adminUsername }) {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) return null;

    if (status) ticket.status = status;
    if (decision) ticket.decision = decision;
    if (decisionReason) ticket.decisionReason = decisionReason;
    ticket.reviewedBy = adminUsername || 'admin';
    ticket.reviewedAt = new Date().toISOString();

    this.tickets.set(ticketId, ticket);

    if (this.isDbConnected()) {
      try {
        await ModerationTicket.updateOne({ ticketId }, { $set: ticket });
      } catch (err) {
        console.error('Failed to update ticket in DB:', err.message);
      }
    }

    // Record audit log (FR-089)
    await this.recordAudit({
      adminUsername: adminUsername || 'admin',
      action: `ticket_${status || 'updated'}`,
      targetType: 'ticket',
      targetId: ticketId,
      reason: decisionReason || decision || `Status changed to ${status}`
    });

    return ticket;
  }

  // Issue enforcement action (ban) (FR-074, FR-088)
  async issueEnforcement({ targetSessionId, type = 'temporary_ban', reason, durationHours = 24, adminUsername }) {
    const enforcementId = `enf_${crypto.randomUUID()}`;
    const now = new Date();
    const expiresAt = type === 'temporary_ban' ? new Date(now.getTime() + (durationHours * 60 * 60 * 1000)) : null;

    const record = {
      enforcementId,
      targetSessionId,
      type,
      reason,
      issuedBy: adminUsername || 'admin',
      issuedAt: now.toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      reversedAt: null,
      reversedBy: null,
      reversalReason: null
    };

    this.enforcements.set(enforcementId, record);

    if (this.isDbConnected()) {
      try {
        await EnforcementRecord.create({
          ...record,
          issuedAt: now,
          expiresAt
        });
      } catch (err) {
        console.error('Failed to persist enforcement to DB:', err.message);
      }
    }

    await this.recordAudit({
      adminUsername: adminUsername || 'admin',
      action: `issued_${type}`,
      targetType: 'enforcement',
      targetId: enforcementId,
      reason
    });

    return record;
  }

  // Reverse platform ban (FR-070, FR-088)
  async reverseEnforcement(enforcementId, { reason, adminUsername }) {
    const record = this.enforcements.get(enforcementId);
    if (!record) return null;

    const now = new Date().toISOString();
    record.reversedAt = now;
    record.reversedBy = adminUsername || 'admin';
    record.reversalReason = reason || 'Reversed by admin';

    this.enforcements.set(enforcementId, record);

    if (this.isDbConnected()) {
      try {
        await EnforcementRecord.updateOne({ enforcementId }, { $set: record });
      } catch (err) {
        console.error('Failed to update enforcement in DB:', err.message);
      }
    }

    await this.recordAudit({
      adminUsername: adminUsername || 'admin',
      action: 'reversed_enforcement',
      targetType: 'enforcement',
      targetId: enforcementId,
      reason: record.reversalReason
    });

    return record;
  }

  // Check if session is currently banned (FR-074, FR-075)
  isBanned(sessionId) {
    const now = Date.now();
    for (const enf of this.enforcements.values()) {
      if (enf.targetSessionId === sessionId && !enf.reversedAt) {
        if (!enf.expiresAt) return true; // permanent
        if (new Date(enf.expiresAt).getTime() > now) return true; // active temp ban
      }
    }
    return false;
  }

  // Record audit log (FR-089)
  async recordAudit({ adminUsername, action, targetType, targetId, reason }) {
    const auditId = `audit_${crypto.randomUUID()}`;
    const log = {
      auditId,
      adminUsername,
      action,
      targetType,
      targetId,
      reason: reason || '',
      timestamp: new Date().toISOString()
    };

    this.auditLogs.unshift(log);

    if (this.isDbConnected()) {
      try {
        await AuditLog.create(log);
      } catch (err) {
        console.error('Failed to persist audit log to DB:', err.message);
      }
    }

    return log;
  }

  getAuditLogs() {
    return this.auditLogs.slice(0, 100);
  }

  getEnforcements() {
    return Array.from(this.enforcements.values());
  }

  resetForTesting() {
    this.tickets.clear();
    this.enforcements.clear();
    this.auditLogs = [];
  }
}

export const moderationService = new ModerationService();
