import React, { useState } from 'react';
import { Flag, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { socketService } from '../../services/socket';
import { storage } from '../../services/storage';

const REPORT_CATEGORIES = [
  { id: 'harassment', label: 'Harassment or abusive behavior' },
  { id: 'sexual_content', label: 'Sexual or inappropriate content' },
  { id: 'hate_speech', label: 'Hate speech or discriminatory behavior' },
  { id: 'spam', label: 'Spam or scams' },
  { id: 'threats', label: 'Threats or unsafe behavior' },
  { id: 'other', label: 'Other violation' }
];

export default function ReportModal({ isOpen, onClose, matchId, opponentNickname, opponentSessionId, onReportSubmitted }) {
  const [category, setCategory] = useState('harassment');
  const [reporterNote, setReporterNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!matchId) return;

    setIsSubmitting(true);
    setError(null);

    // Automatically add to local blocklist (FR-066, FR-072)
    if (opponentSessionId) {
      storage.addToBlocklist(opponentSessionId);
    }

    if (socketService.socket) {
      socketService.socket.emit('moderation:report', {
        matchId,
        category,
        reporterNote: reporterNote.trim()
      });
    }

    setIsSubmitting(false);
    if (onReportSubmitted) {
      onReportSubmitted();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/95 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Report Stranger</h3>
            <p className="text-xs text-slate-400">Matched with {opponentNickname || 'Stranger'}</p>
          </div>
        </div>

        {/* Warning Disclosure (FR-065, FR-066) */}
        <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Submitting a report will <strong>immediately terminate this match</strong> and permanently block this stranger from future matchmaking with you.
          </span>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-950 border border-rose-500/50 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for report
            </label>
            <div className="flex flex-col gap-1.5">
              {REPORT_CATEGORIES.map((cat) => (
                <label
                  key={cat.id}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${category === cat.id ? 'bg-[#ff007f]/20 border-[#ff007f]/60 text-white shadow-[0_0_10px_#ff007f25]' : 'bg-[#070709] border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'}`}
                >
                  <input
                    type="radio"
                    name="reportCategory"
                    value={cat.id}
                    checked={category === cat.id}
                    onChange={(e) => setCategory(e.target.value)}
                    className="accent-[#ff007f]"
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Optional note for moderators
            </label>
            <textarea
              value={reporterNote}
              onChange={(e) => setReporterNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Provide context or details about the incident..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5"
            >
              <Flag size={14} />
              <span>Submit & End Match</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
