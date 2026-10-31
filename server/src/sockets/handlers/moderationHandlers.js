import { matchLifecycleService } from '../../services/matches/matchLifecycleService.js';
import { moderationService } from '../../services/moderation/moderationService.js';
import { moderationReportSchema, moderationBlockSchema } from '../../validators/socketValidator.js';

export function registerModerationHandlers(io, socket) {
  // Submit a report for the current match (FR-063 - FR-067)
  socket.on('moderation:report', async (payload) => {
    const parse = moderationReportSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('moderation:report-result', {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message || 'Invalid report payload.' }
      });
    }

    const { matchId, category, reporterNote } = parse.data;
    const match = matchLifecycleService.getMatch(matchId);

    // Verify session belongs to match (FR-066, FR-100)
    if (!match || !match.playerSessionIds.includes(socket.sessionId)) {
      return socket.emit('moderation:report-result', {
        success: false,
        error: { code: 'UNAUTHORIZED_REPORT', message: 'You are not a participant in this match.' }
      });
    }

    const opponent = matchLifecycleService.getOpponent(matchId, socket.sessionId);
    const reporter = match.players.find(p => p.sessionId === socket.sessionId);

    // Create ticket & terminate match atomically (FR-066)
    const result = await moderationService.createTicket({
      matchId,
      category,
      reporterSessionId: socket.sessionId,
      reportedSessionId: opponent?.sessionId || 'unknown',
      reporterNickname: reporter?.nickname || 'Reporter',
      reportedNickname: opponent?.nickname || 'Reported',
      reporterNote: reporterNote || ''
    });

    // Confirm ticket creation to reporter (FR-066)
    socket.emit('moderation:report-result', {
      success: true,
      ticketId: result.ticket.ticketId,
      isDuplicate: result.isDuplicate
    });

    // Notify room that match has ended due to a report
    const roomName = `match:${matchId}`;
    io.to(roomName).emit('match:ended', {
      matchId,
      reason: 'reported'
    });
  });

  // Request personal block confirmation (FR-071, FR-072)
  socket.on('moderation:block', (payload) => {
    const parse = moderationBlockSchema.safeParse(payload);
    if (!parse.success) {
      return socket.emit('moderation:block-result', {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Target sessionId is required.' }
      });
    }

    socket.emit('moderation:block-result', {
      success: true,
      targetSessionId: parse.data.targetSessionId
    });
  });
}
