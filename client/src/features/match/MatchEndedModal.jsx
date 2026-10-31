import React from 'react';
import { RefreshCw, Home, ShieldOff, Flag } from 'lucide-react';

export default function MatchEndedModal({
  matchResult,
  opponentNickname,
  onFindAnother,
  onReturnLobby,
  onReport,
  onBlock
}) {
  const isWinner = matchResult?.winnerNickname && matchResult.winnerNickname !== opponentNickname;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl border border-[#ff007f]/40 bg-[#0e0f15] shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 shadow-[0_0_50px_rgba(255,0,127,0.3)]">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 border-2 shadow-xl ${
          isWinner ? 'bg-[#ccff00]/20 border-[#ccff00] shadow-[0_0_25px_#ccff0060] text-[#ccff00]' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
        }`}>
          {isWinner ? '🏆' : '⚔️'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
          {isWinner ? 'Victory!' : `${matchResult?.winnerNickname || 'Opponent'} Won`}
        </h2>
        
        <p className="text-sm text-zinc-300 mb-6">
          {isWinner
            ? `Congratulations! You bested ${opponentNickname} in casual battle.`
            : `Good game! ${opponentNickname} claimed the contest.`}
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3 mb-6">
          <button
            onClick={onFindAnother}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#ff007f] via-[#ff2a8d] to-[#ccff00] hover:brightness-110 text-white font-black text-sm shadow-[0_0_25px_#ff007f60] flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
            id="find-another-player-btn"
          >
            <RefreshCw size={17} />
            <span>Find Another Challenger</span>
          </button>

          <button
            onClick={onReturnLobby}
            className="w-full py-2.5 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
            id="match-ended-return-lobby-btn"
          >
            <Home size={16} />
            <span>Return to Lobby</span>
          </button>
        </div>

        {/* Post-match Moderation Actions */}
        <div className="w-full pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <button
            onClick={onBlock}
            className="hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            id="post-match-block-btn"
          >
            <ShieldOff size={13} />
            <span>Block Player</span>
          </button>

          <button
            onClick={onReport}
            className="hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            id="post-match-report-btn"
          >
            <Flag size={13} />
            <span>Report Conduct</span>
          </button>
        </div>
      </div>
    </div>
  );
}
