import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';

export default function AgeGateModal({ onConfirm, onOpenLegal }) {
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isChecked) {
      setError('You must confirm that you are 18 or older to play Gamerizz.');
      return;
    }
    onConfirm();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card glass-panel age-gate-card">
        <div className="age-gate-header">
          <div className="age-badge-icon">
            <ShieldAlert size={36} className="text-amber" />
          </div>
          <h2>Age Confirmation Required</h2>
          <p className="age-gate-subtitle">
            Gamerizz connects adult strangers for online casual games and live text chat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="age-gate-form">
          <div className="age-gate-terms-box">
            <p>
              Please note: Ordinary chat messages are ephemeral and not retained. We do not use webcams or audio. 
              By proceeding, you agree to our{' '}
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="inline-link"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="inline-link"
              >
                Privacy Notice
              </button>.
            </p>
          </div>

          <label className="checkbox-container">
            <input
              type="checkbox"
              id="age-confirmation-checkbox"
              checked={isChecked}
              onChange={(e) => {
                setIsChecked(e.target.checked);
                if (error) setError(null);
              }}
            />
            <span className="checkbox-text">
              I certify that I am <strong>18 years of age or older</strong> and agree to follow Community Guidelines.
            </span>
          </label>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="notice-clarification">
            <em>Notice: This confirmation records your statement of age and does not constitute third-party age verification.</em>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            id="confirm-age-button"
            disabled={!isChecked}
          >
            <span>Enter Lobby</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
