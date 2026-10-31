import React from 'react';
import { X, ShieldCheck, Lock, BookOpen, LifeBuoy } from 'lucide-react';

export default function LegalModal({ modalType, onClose }) {
  if (!modalType) return null;

  const contentMap = {
    terms: {
      title: 'Terms of Service',
      icon: <ShieldCheck className="modal-icon text-[#ff007f]" />,
      body: (
        <>
          <p><strong>1. Age Requirement:</strong> Gamerizz is exclusively for individuals aged 18 and older. By using the platform, you represent and affirm that you are at least 18 years of age.</p>
          <p><strong>2. Code of Conduct:</strong> Users must treat opponents respectfully. Harassment, threats, sexual abuse, hate speech, spam, and non-consensual illicit behaviour are strictly forbidden.</p>
          <p><strong>3. Ephemeral Anonymous Service:</strong> Gamerizz does not provide persistent accounts or save conversations. Guest sessions are temporary and may expire upon disconnection.</p>
          <p><strong>4. Moderation & Bans:</strong> Violation of community standards results in immediate termination of matches, blocklisting, and potential platform-wide bans enforced by administrators.</p>
        </>
      )
    },
    privacy: {
      title: 'Privacy Notice',
      icon: <Lock className="modal-icon text-[#ccff00]" />,
      body: (
        <>
          <p><strong>1. Zero Conversation Storage:</strong> Ordinary chat messages, reactions, and moves exist purely in memory during your active match. Once a match ends, all messages are immediately discarded.</p>
          <p><strong>2. Anonymous Sessions:</strong> We do not ask for your real name, email, phone number, or social media accounts. You are identified only by an opaque session identifier and random nickname.</p>
          <p><strong>3. Moderation Exception:</strong> If a report is submitted, only report metadata (category, reporter pseudonym, reported pseudonym, timestamp) is retained to permit administrative review.</p>
          <p><strong>4. Local Blocking:</strong> Personal blocks are recorded in your browser local storage. Clearing your browser data will reset your personal blocklist.</p>
        </>
      )
    },
    guidelines: {
      title: 'Community Guidelines',
      icon: <BookOpen className="modal-icon text-amber-400" />,
      body: (
        <>
          <p><strong>Fair Play:</strong> Play games fairly. Do not stall or wait out timers deliberately.</p>
          <p><strong>Clean Conversation:</strong> Keep chat friendly and casual. Profanity and vulgar nicknames are blocked automatically.</p>
          <p><strong>Instant Reporting:</strong> If a stranger is abusive or makes you uncomfortable, click the Report button immediately. This ends the match instantly and blocks them from pairing with you again.</p>
        </>
      )
    },
    support: {
      title: 'Technical Help & Issue Reporting',
      icon: <LifeBuoy className="modal-icon text-[#ccff00]" />,
      body: (
        <>
          <p><strong>Connection Issues:</strong> Gamerizz uses real-time WebSockets. If you see "Connecting...", check your internet connection or reload the page.</p>
          <p><strong>Reporting Bugs:</strong> To report a bug or suggest improvements, please contact the Gamerizz technical development team via our repository issue tracker.</p>
          <p><strong>Supported Browsers:</strong> Modern versions of Chrome, Edge, Safari, and Firefox on both desktop and mobile.</p>
        </>
      )
    }
  };

  const current = contentMap[modalType] || contentMap.terms;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            {current.icon}
            <h2>{current.title}</h2>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body legal-text-flow">
          {current.body}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
