import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  auditId: { type: String, required: true, unique: true, index: true },
  adminUsername: { type: String, required: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true }
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
