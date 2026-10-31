import React, { useState } from 'react';
import { FastForward, LogOut, Flag, MessageSquare, Gamepad2, Shield } from 'lucide-react';
import RpsArena from '../games/rps/RpsArena';
import CricketArena from '../games/cricket/CricketArena';
import ChatPanel from '../chat/ChatPanel';

export default function ActiveMatchLayout({
  activeMatch,
  onSkipMatch,
  onLeaveMatch,
  onOpenReport,
  onMatchOver
}) {
  const [activeTab, setActiveTab] = useState('game'); // 'game' | 'chat' (for mobile viewport)

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] w-full max-w-7xl mx-auto rounded-2xl border border-zinc-800 bg-[#070709]/90 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black">
      {/* Match Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800 bg-[#0e0f15]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff007f]/15 border border-[#ff007f]/40 flex items-center justify-center text-lg shadow-[0_0_10px_#ff007f30]">
            {activeMatch.gameType === 'rps' ? '✂️' : '🏏'}
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-zinc-400">Matched With</span>
            <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span>{activeMatch.opponentNickname}</span>
              <span className="w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00]" title="Connected" />
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mobile view tab toggler */}
          <div className="flex md:hidden bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 mr-2">
            <button
              onClick={() => setActiveTab('game')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${activeTab === 'game' ? 'bg-[#ff007f] text-white shadow-sm' : 'text-zinc-400'}`}
            >
              <Gamepad2 size={14} />
              <span>Game</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${activeTab === 'chat' ? 'bg-[#ff007f] text-white shadow-sm' : 'text-zinc-400'}`}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </button>
          </div>

          <button
            onClick={onSkipMatch}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
            title="End match and seek another stranger"
            id="match-skip-btn"
          >
            <FastForward size={14} />
            <span className="hidden sm:inline">Skip</span>
          </button>

          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors"
            title="Report abusive stranger and terminate match"
            id="match-report-btn"
          >
            <Flag size={14} />
            <span className="hidden sm:inline">Report</span>
          </button>

          <button
            onClick={onLeaveMatch}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            title="Leave match and return to lobby"
            id="match-leave-btn"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Split Panels (60% Game / 40% Chat on desktop, toggled on mobile) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Game Panel (~60% width) */}
        <div className={`flex-1 md:flex-[3] h-full overflow-y-auto border-r border-slate-800/80 ${activeTab === 'game' ? 'block' : 'hidden md:block'}`}>
          {activeMatch.gameType === 'rps' ? (
            <RpsArena
              matchId={activeMatch.matchId}
              opponentNickname={activeMatch.opponentNickname}
              onMatchOver={onMatchOver}
            />
          ) : (
            <CricketArena
              matchId={activeMatch.matchId}
              opponentNickname={activeMatch.opponentNickname}
              onMatchOver={onMatchOver}
            />
          )}
        </div>

        {/* Chat Panel (~40% width) */}
        <div className={`flex-1 md:flex-[2] h-full flex flex-col ${activeTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          <ChatPanel
            matchId={activeMatch.matchId}
            opponentNickname={activeMatch.opponentNickname}
          />
        </div>
      </div>
    </div>
  );
}
