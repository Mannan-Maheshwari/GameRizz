import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Clock, ShieldCheck, Trophy, Sparkles, AlertCircle } from 'lucide-react';
import { socketService } from '../../../services/socket';
import { storage } from '../../../services/storage';

export default function RpsArena({ matchId, opponentNickname, onMatchOver }) {
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ myScore: 0, opponentScore: 0 });
  const [myMove, setMyMove] = useState(null);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [roundBanner, setRoundBanner] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const getMySessionId = () => {
    return socketService.sessionId || socketService.socket?.sessionId || storage.getSession()?.sessionId;
  };

  // Request authoritative state on mount
  useEffect(() => {
    if (socketService.socket) {
      socketService.socket.emit('rps:get-state', { matchId });
    }

    const unsubState = socketService.on('rps:state', (state) => {
      if (state.matchId === matchId) {
        setRound(state.round);
        setScores(state.scores);
        setMyMove(state.myMoveSubmitted ? (myMove || 'locked') : null);
        setOpponentSubmitted(state.opponentSubmitted);
        if (!state.myMoveSubmitted) {
          setIsSubmitting(false);
        }

        if (state.timeoutAt) {
          const rem = Math.max(0, Math.ceil((state.timeoutAt - Date.now()) / 1000));
          setTimeRemaining(rem);
        }
      }
    });

    const unsubOpponentSub = socketService.on('rps:opponent-submitted', (data) => {
      if (data.matchId === matchId) {
        setOpponentSubmitted(true);
      }
    });

    const unsubAccepted = socketService.on('rps:move-accepted', (data) => {
      setMyMove(data.move);
      setIsSubmitting(false);
    });

    const unsubRoundResult = socketService.on('rps:round-result', (result) => {
      const data = result.roundData;
      setRoundBanner(data);
      setIsSubmitting(false);

      setTimeout(() => {
        setRoundBanner(null);
        setMyMove(null);
        setOpponentSubmitted(false);
      }, 3500);
    });

    const unsubMatchResult = socketService.on('rps:match-result', (result) => {
      setIsSubmitting(false);
      if (result.winnerNickname && result.winnerNickname !== opponentNickname) {
        // Player won! Trigger confetti
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff007f', '#ccff00', '#ffffff', '#ff2a8d']
          });
        } catch (e) {
          // ignore if canvas not supported
        }
      }

      setTimeout(() => {
        if (onMatchOver) {
          onMatchOver(result);
        }
      }, 2000);
    });

    const unsubErr = socketService.on('rps:error', (err) => {
      setErrorMsg(err.message || 'An error occurred during RPS duel');
      setIsSubmitting(false);
      setTimeout(() => setErrorMsg(null), 3500);
    });

    // Local turn countdown timer
    const timerInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      unsubState?.();
      unsubOpponentSub?.();
      unsubAccepted?.();
      unsubRoundResult?.();
      unsubMatchResult?.();
      unsubErr?.();
      clearInterval(timerInterval);
    };
  }, [matchId, opponentNickname, onMatchOver]);

  const handleMakeMove = (move) => {
    if (myMove || isSubmitting) return;
    setIsSubmitting(true);
    if (socketService.socket) {
      socketService.socket.emit('rps:move', { matchId, move, round });
    }
  };

  const moveCards = [
    { id: 'rock', name: 'Rock', emoji: '🪨', beats: 'Scissors' },
    { id: 'paper', name: 'Paper', emoji: '📄', beats: 'Rock' },
    { id: 'scissors', name: 'Scissors', emoji: '✂️', beats: 'Paper' }
  ];

  const mySessionId = getMySessionId();

  return (
    <div className="flex flex-col h-full items-center justify-between p-3 sm:p-6 select-none relative bg-[#070709] overflow-y-auto">
      {/* Top Match Bar */}
      <div className="w-full flex items-center justify-between bg-[#0e0f15] border border-zinc-800 rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-lg">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-400 font-semibold block">Format</span>
          <h3 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2">
            <span>Round {round}</span>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-[#ff007f]/20 text-[#ff66b2] border border-[#ff007f]/40 font-semibold">
              Best of 3
            </span>
          </h3>
        </div>

        {/* Score Board */}
        <div className="flex items-center gap-2 sm:gap-4 bg-[#070709] border border-zinc-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl">
          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#ff007f]">You</span>
            <span className="block text-lg sm:text-2xl font-mono font-black text-white">{scores.myScore}</span>
          </div>
          <span className="text-zinc-600 font-bold">:</span>
          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#ccff00] truncate max-w-[65px] sm:max-w-none">{opponentNickname}</span>
            <span className="block text-lg sm:text-2xl font-mono font-black text-white">{scores.opponentScore}</span>
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Clock size={15} className={timeRemaining <= 5 ? 'text-[#ff007f] animate-pulse' : 'text-zinc-400'} />
          <span className={`font-mono text-base sm:text-lg font-bold ${timeRemaining <= 5 ? 'text-[#ff007f] animate-pulse' : 'text-zinc-200'}`}>
            {timeRemaining}s
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="w-full mt-2.5 p-2.5 sm:p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Opponent Status Indicator */}
      <div className="my-3 sm:my-6 flex items-center gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#0e0f15] border border-zinc-800">
        <span className={`w-2.5 h-2.5 rounded-full ${opponentSubmitted ? 'bg-[#ccff00] shadow-[0_0_12px_#ccff00]' : 'bg-zinc-600 animate-pulse'}`} />
        <span className="text-xs text-zinc-300">
          {opponentSubmitted ? `${opponentNickname} has locked in their move!` : `${opponentNickname} is thinking...`}
        </span>
      </div>

      {/* Center Action Arena: 3 Move Cards */}
      <div className="w-full max-w-xl grid grid-cols-3 gap-2.5 sm:gap-4 my-auto">
        {moveCards.map((card) => {
          const isSelected = myMove === card.id;
          const disabled = !!myMove || isSubmitting;

          return (
            <button
              key={card.id}
              onClick={() => handleMakeMove(card.id)}
              disabled={disabled}
              id={`rps-btn-${card.id}`}
              className={`flex flex-col items-center justify-center p-3 sm:p-6 rounded-2xl border transition-all duration-200 relative group cursor-pointer
                ${isSelected
                  ? 'border-[#ff007f] bg-[#ff007f]/20 shadow-[0_0_30px_#ff007f50] scale-105'
                  : disabled
                  ? 'border-zinc-800/60 bg-[#0e0f15]/40 opacity-40 cursor-not-allowed'
                  : 'border-zinc-800 bg-[#0e0f15] hover:border-[#ccff00]/60 hover:bg-[#151722] hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(0,0,0,0.8),0_0_15px_#ccff0025]'
                }`}
            >
              <span className="text-3xl sm:text-5xl md:text-6xl mb-1.5 sm:mb-3 filter drop-shadow transition-transform group-hover:scale-110">
                {card.emoji}
              </span>
              <span className="font-extrabold text-xs sm:text-base text-white">
                {card.name}
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5 hidden sm:block">
                Beats {card.beats}
              </span>

              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#ff007f] text-white flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-[0_0_10px_#ff007f]">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Footer */}
      <div className="w-full text-center mt-3 sm:mt-6 py-2">
        {myMove ? (
          <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#ff007f]/15 border border-[#ff007f]/40 text-[#ff80bf] text-xs sm:text-sm font-semibold shadow-[0_0_15px_#ff007f25]">
            <ShieldCheck size={16} />
            <span>Move locked in! Waiting for round outcome...</span>
          </div>
        ) : (
          <span className="text-zinc-400 text-xs font-medium">
            Tap a card to make your secret move. First to 2 wins takes the match.
          </span>
        )}
      </div>

      {/* Round Reveal Popup Banner */}
      {roundBanner && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 sm:p-6 z-20 animate-fade-in">
          <div className="w-full max-w-sm p-5 sm:p-6 rounded-2xl border border-[#ff007f]/50 bg-[#0e0f15] shadow-2xl flex flex-col items-center text-center shadow-[0_0_40px_rgba(255,0,127,0.3)]">
            <h4 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-3">Round {roundBanner.round} Result</h4>
            
            <div className="flex items-center justify-center gap-6 my-4">
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl mb-1 filter drop-shadow-[0_0_10px_#ff007f]">
                  {roundBanner.moves?.[mySessionId] === 'rock' ? '🪨' :
                   roundBanner.moves?.[mySessionId] === 'paper' ? '📄' :
                   roundBanner.moves?.[mySessionId] === 'scissors' ? '✂️' : '⏱️'}
                </span>
                <span className="text-xs text-[#ff007f] font-bold">You</span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-zinc-500">VS</span>
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl mb-1 filter drop-shadow-[0_0_10px_#ccff00]">
                  {(() => {
                    const opp = Object.entries(roundBanner.moves || {}).find(([id]) => id !== mySessionId);
                    const move = opp ? opp[1] : null;
                    return move === 'rock' ? '🪨' : move === 'paper' ? '📄' : move === 'scissors' ? '✂️' : '⏱️';
                  })()}
                </span>
                <span className="text-xs text-[#ccff00] font-bold truncate max-w-[80px]">{opponentNickname}</span>
              </div>
            </div>

            <div className={`text-lg sm:text-xl font-extrabold my-2 ${
              roundBanner.isTie ? 'text-amber-400' :
              roundBanner.winnerNickname !== opponentNickname ? 'text-[#ccff00] filter drop-shadow-[0_0_8px_#ccff00]' : 'text-[#ff007f]'
            }`}>
              {roundBanner.isTie ? "It's a Tie Round!" :
               roundBanner.winnerNickname !== opponentNickname ? 'You Won This Round! 🎉' :
               `${opponentNickname} Won This Round!`}
            </div>

            <p className="text-xs text-zinc-400 mt-2">
              Next round starting in a moment...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
