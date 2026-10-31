import React from 'react';
import { User, Edit2, ShieldCheck, AlertTriangle } from 'lucide-react';
import GameSelector from '../features/games/GameSelector';

export default function LobbyPage({
  nickname,
  onEditNickname,
  selectedGame,
  onSelectGame,
  onStartMatchmaking,
  queueWaiters,
  connectionError
}) {
  return (
    <div className="lobby-page-container">
      {connectionError && (
        <div className="connection-error-banner glass-panel">
          <AlertTriangle size={18} className="text-amber-400" />
          <span>{connectionError}</span>
        </div>
      )}

      {/* Guest Status Banner */}
      <div className="lobby-profile-card glass-panel border-l-4 border-l-[#ff007f]">
        <div className="profile-identity">
          <div className="profile-avatar bg-[#ff007f]/15 border border-[#ff007f]/40">
            <User size={24} className="text-[#ff007f]" />
          </div>
          <div className="profile-info">
            <span className="profile-badge text-[#ccff00]">Guest Session</span>
            <div className="profile-name-row">
              <h2 className="profile-nickname">{nickname}</h2>
              <button
                onClick={onEditNickname}
                className="btn-edit-badge hover:border-[#ccff00] hover:text-[#ccff00]"
                title="Change Nickname"
                id="lobby-edit-nickname-btn"
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </button>
            </div>
          </div>
        </div>

        <div className="profile-tip">
          <ShieldCheck size={16} className="text-[#ccff00]" />
          <span>Anonymous by default. Your nickname is shown to your opponent.</span>
        </div>
      </div>

      {/* Game Selector */}
      <GameSelector
        selectedGame={selectedGame}
        onSelectGame={onSelectGame}
        onStartMatchmaking={onStartMatchmaking}
        queueWaiters={queueWaiters}
      />
    </div>
  );
}
