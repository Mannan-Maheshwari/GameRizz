import React from 'react';
import { Shield, Sparkles, Edit3, Wifi, WifiOff, HelpCircle } from 'lucide-react';

export default function Header({ nickname, onEditNickname, onOpenLegal, connectionStatus = 'connected' }) {
  return (
    <header className="header-container">
      <div className="header-content">
        <div className="logo-group">
          <div className="logo-icon-wrapper">
            <span className="logo-emoji">🎮</span>
          </div>
          <div className="logo-text-wrapper">
            <h1 className="logo-title">
              GAME<span className="logo-accent">RIZZ</span>
            </h1>
            <span className="logo-tagline">Play & Chat with Strangers</span>
          </div>
          <div className="adult-tag" title="18+ Adults Only Platform">
            <Shield size={12} />
            <span>18+</span>
          </div>
        </div>

        <div className="header-actions">
          {nickname && (
            <button
              onClick={onEditNickname}
              className="nickname-pill"
              title="Click to change your nickname"
              id="header-nickname-btn"
            >
              <span className="nickname-label">You:</span>
              <span className="nickname-val">{nickname}</span>
              <Edit3 size={14} className="nickname-edit-icon" />
            </button>
          )}

          <div
            className={`connection-pill ${connectionStatus}`}
            title={`Status: ${connectionStatus}`}
          >
            {connectionStatus === 'connected' ? (
              <>
                <span className="dot dot-online" />
                <span className="conn-text">Online</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <span className="dot dot-waiting" />
                <span className="conn-text">Connecting...</span>
              </>
            ) : (
              <>
                <span className="dot dot-offline" />
                <span className="conn-text">Offline</span>
              </>
            )}
          </div>

          <button
            onClick={() => onOpenLegal('guidelines')}
            className="header-icon-btn"
            title="Community Guidelines & Rules"
            id="header-guidelines-btn"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
