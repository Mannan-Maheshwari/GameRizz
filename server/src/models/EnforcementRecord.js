import mongoose from 'mongoose';

const EnforcementRecordSchema = new mongoose.Schema({
  enforcementId: { type: String, required: true, unique: true, index: true },
  targetSessionId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['temporary_ban', 'permanent_ban'],
    required: true
  },
  reason: { type: String, required: true },
  issuedBy: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null, index: true },
  reversedAt: { type: Date, default: null },
  reversedBy: { type: String, default: null },
  reversalReason: { type: String, default: null }
});

export const EnforcementRecord = mongoose.models.EnforcementRecord || mongoose.model('EnforcementRecord', EnforcementRecordSchema);
