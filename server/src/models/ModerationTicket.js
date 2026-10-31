import mongoose from 'mongoose';

const ModerationTicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true, index: true },
  matchId: { type: String, required: true, index: true },
  category: {
    type: String,
    enum: ['harassment', 'sexual_content', 'hate_speech', 'spam', 'threats', 'other'],
    required: true
  },
  reporterSessionId: { type: String, required: true },
  reportedSessionId: { type: String, required: true, index: true },
  reporterNickname: { type: String, default: 'Anonymous' },
  reportedNickname: { type: String, default: 'Anonymous' },
  reporterNote: { type: String, default: '', maxlength: 500 },
  status: {
    type: String,
    enum: ['open', 'under_review', 'action_taken', 'no_violation_found', 'resolved'],
    default: 'open',
    index: true
  },
  decision: { type: String, default: null },
  decisionReason: { type: String, default: null },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  retentionUntil: { type: Date, index: true }
});

export const ModerationTicket = mongoose.models.ModerationTicket || mongoose.model('ModerationTicket', ModerationTicketSchema);
