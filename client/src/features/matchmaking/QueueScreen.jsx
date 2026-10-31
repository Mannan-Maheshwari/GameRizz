import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Shield, Globe2, Radio, Sparkles } from 'lucide-react';

const ROAMING_MESSAGES = [
  'Scanning worldwide matchmaking pool...',
  'Looking for players with low latency...',
  'Verifying anonymous session keys...',
  'Pinging random stranger across regions...',
  'Preparing ephemeral battleground...'
];

export default function QueueScreen({
  selectedGame,
  queueStatus,
  switchOffer,
  onCancelQueue,
  onRespondSwitchOffer,
  matchFoundData
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [roamingIndex, setRoamingIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Roaming status ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setRoamingIndex(i => (i + 1) % ROAMING_MESSAGES.length);
    }, 3800);
    return () => clearInterval(ticker);
  }, []);

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const gameNames = {
    rps: 'Rock Paper Scissors',
    cricket: 'Hand Cricket'
  };

  const gameIcons = {
    rps: '✂️',
    cricket: '🏏'
  };

  const gameSubtitles = {
    rps: 'Best of 3 Quick Duel',
    cricket: '3 Overs (18 Balls) Innings'
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-6 px-3 sm:px-6 w-full max-w-4xl mx-auto">
      <div className="queue-box w-full max-w-xl p-5 sm:p-8 md:p-10 rounded-3xl border border-[#ff007f]/40 bg-[#0e0f15]/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(255,0,127,0.2)] flex flex-col items-center text-center relative overflow-hidden transition-all">
        {/* Top laser beam accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff007f] to-transparent shadow-[0_0_15px_#ff007f]" />

        {matchFoundData ? (
          /* Match Found State */
          <div className="py-8 px-4 flex flex-col items-center animate-fade-in w-full">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-[#ccff00]/20 border-2 border-[#ccff00] flex items-center justify-center text-5xl shadow-[0_0_35px_#ccff0080] animate-bounce">
                🎉
              </div>
              <div className="absolute -inset-3 rounded-full border border-[#ccff00]/40 animate-ping pointer-events-none" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#ccff00] font-bold mb-2">
              Challenger Connected
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Match Found!
            </h2>
            <div className="px-5 py-2.5 rounded-full bg-[#070709] border border-zinc-800 text-base sm:text-lg text-zinc-200 mb-6 shadow-inner">
              Opponent: <span className="font-extrabold text-[#ccff00] ml-1">{matchFoundData.opponentNickname}</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[#ff007f] font-semibold animate-pulse">
              <Sparkles size={16} />
              <span>Entering the arena...</span>
            </div>
          </div>
        ) : (
          /* Waiting in Queue State */
          <div className="w-full flex flex-col items-center">
            {/* Cyber Radar Animation */}
            <div className="relative my-4 flex items-center justify-center">
              {/* Concentric Pulse Rings */}
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-[#ff007f]/20 bg-[#ff007f]/5 pulse-glow-ring flex items-center justify-center relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-[#ccff00]/30 border-dashed" />
                {/* Radar Sweep Line */}
                <div
                  className="radar-sweep-beam absolute inset-0 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, rgba(255, 0, 127, 0.4) 0deg, transparent 60deg, transparent 360deg)'
                  }}
                />
              </div>

              {/* Central Game Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0e0f15] border border-[#ff007f]/60 flex items-center justify-center text-3xl sm:text-4xl shadow-[0_0_25px_rgba(255,0,127,0.4)] z-10">
                  {gameIcons[selectedGame] || '🎮'}
                </div>
              </div>
            </div>

            {/* Pulsing Matchmaking Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff007f]/15 border border-[#ff007f]/40 text-[#ff80bf] text-xs font-semibold mt-3 mb-2 shadow-[0_0_15px_#ff007f25]">
              <Radio size={13} className="text-[#ccff00] animate-pulse" />
              <span>Matchmaking in progress</span>
            </div>

            {/* Game Heading & Subtitle */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 mb-1 tracking-tight">
              {gameNames[selectedGame] || 'Multiplayer Game'}
            </h2>
            <span className="text-xs text-zinc-400 font-medium mb-5">
              {gameSubtitles[selectedGame] || 'Instant Stranger Match'}
            </span>

            {/* Symmetrical Balanced Metrics Grid (Search Time, Mode, Pool) */}
            <div className="w-full grid grid-cols-3 gap-2 sm:gap-3 bg-[#070709] border border-zinc-800/90 rounded-2xl p-3 sm:p-4 mb-5 shadow-inner">
              <div className="flex flex-col items-center justify-center text-center p-1">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">
                  Time
                </span>
                <span className="text-base sm:text-xl font-mono font-black text-white tracking-wide">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center text-center p-1 border-x border-zinc-800/80">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">
                  Format
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#ff007f] truncate max-w-full">
                  {selectedGame === 'rps' ? 'Best of 3' : '3 Overs'}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center text-center p-1">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">
                  Region
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#ccff00] flex items-center gap-1">
                  <Globe2 size={12} className="hidden sm:inline" />
                  <span>Global</span>
                </span>
              </div>
            </div>

            {/* Roaming Ticker Status */}
            <div className="w-full py-2.5 px-4 mb-6 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-center gap-2 text-xs text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-ping" />
              <span className="font-mono text-zinc-300 font-medium transition-all duration-300">
                {queueStatus || ROAMING_MESSAGES[roamingIndex]}
              </span>
            </div>

            {/* Alternative Queue Switch Offer (FR-016) */}
            {switchOffer && (
              <div className="w-full mb-6 p-4 rounded-2xl bg-[#070709] border border-[#ccff00]/50 text-left animate-in fade-in slide-in-from-top-2 shadow-[0_0_20px_rgba(204,255,0,0.2)]">
                <div className="flex items-center gap-2 text-[#ccff00] font-bold text-sm mb-1.5">
                  <ArrowRightLeft size={16} />
                  <span>Alternative Game Available!</span>
                </div>
                <p className="text-xs text-zinc-300 mb-3.5 leading-relaxed">
                  Players are actively waiting in the <strong>{gameNames[switchOffer.proposedGame]}</strong> queue. Would you like to switch now for an instant match?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => onRespondSwitchOffer(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8e600] text-[#070709] font-extrabold text-xs transition-all shadow-[0_0_15px_#ccff0060] cursor-pointer"
                    id="accept-switch-btn"
                  >
                    Switch to {gameNames[switchOffer.proposedGame]}
                  </button>
                  <button
                    onClick={() => onRespondSwitchOffer(false)}
                    className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                    id="decline-switch-btn"
                  >
                    Stay in {gameNames[selectedGame]}
                  </button>
                </div>
              </div>
            )}

            {/* Cancel Button */}
            <button
              onClick={onCancelQueue}
              className="w-full py-3.5 px-6 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-[#ff007f]/60 text-zinc-200 hover:text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99]"
              id="cancel-queue-button"
            >
              <X size={16} className="text-[#ff007f]" />
              <span>Cancel Search & Return to Lobby</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
