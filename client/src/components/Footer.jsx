import React from 'react';
import { ShieldAlert, Lock, HeartHandshake } from 'lucide-react';

export default function Footer({ onOpenLegal, onOpenAdmin }) {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        <div className="privacy-badge-notice">
          <Lock size={15} className="privacy-icon" />
          <span>
            <strong>Zero Chat History:</strong> Conversations are strictly transient and never saved to a database.
          </span>
        </div>

        <div className="footer-links">
          <button onClick={() => onOpenLegal('terms')} className="footer-link">Terms of Service</button>
          <span className="footer-divider">•</span>
          <button onClick={() => onOpenLegal('privacy')} className="footer-link">Privacy Notice</button>
          <span className="footer-divider">•</span>
          <button onClick={() => onOpenLegal('guidelines')} className="footer-link">Community Guidelines</button>
          <span className="footer-divider">•</span>
          <button onClick={() => onOpenLegal('support')} className="footer-link">Report Problem / Help</button>
          {onOpenAdmin && (
            <>
              <span className="footer-divider">•</span>
              <button onClick={onOpenAdmin} className="footer-link text-slate-500 hover:text-slate-300">Admin</button>
            </>
          )}
        </div>

        <p className="footer-disclaimer">
          Gamerizz is an adults-only (18+) casual multiplayer gaming platform. We do not use webcams or store messages.
        </p>
      </div>
    </footer>
  );
}
