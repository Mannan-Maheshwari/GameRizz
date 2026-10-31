import React, { useState } from 'react';
import { X, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { validateNickname } from '../../utils/nickname';

export default function NicknameModal({ currentNickname, onSave, onClose }) {
  const [nickname, setNickname] = useState(currentNickname || '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRandomize = () => {
    const prefixes = ['Pixel', 'Cyber', 'Neon', 'Shadow', 'Quantum', 'Glitch', 'Turbo', 'Cosmic', 'Solar', 'Vortex'];
    const animals = ['Fox', 'Wolf', 'Hawk', 'Tiger', 'Viper', 'Falcon', 'Panda', 'Drake', 'Otter', 'Lynx'];
    const randomNum = Math.floor(100 + Math.random() * 900);
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const a = animals[Math.floor(Math.random() * animals.length)];
    const generated = `${p}${a}${randomNum}`;
    setNickname(generated);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateNickname(nickname);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onSave(validation.value);
    setLoading(false);

    if (result && !result.success) {
      setError(result.error?.message || 'Nickname is already taken. Please choose another.');
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>Edit Nickname</h2>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="nickname-form">
          <p className="modal-description">
            Your nickname is displayed to strangers during matchmaking and matches. It must be 3-20 characters long.
          </p>

          <div className="input-group">
            <label htmlFor="nickname-input">Display Nickname</label>
            <div className="input-with-action">
              <input
                id="nickname-input"
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={20}
                placeholder="Enter unique nickname"
                autoFocus
              />
              <button
                type="button"
                onClick={handleRandomize}
                className="btn-input-action"
                title="Generate Random Nickname"
                id="randomize-nickname-btn"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {error && (
            <div className="input-error-row">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !nickname.trim()}
              id="save-nickname-btn"
            >
              {loading ? 'Checking...' : 'Save Nickname'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
