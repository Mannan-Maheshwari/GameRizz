import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Clock, Shield, Award, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { socketService } from '../../../services/socket';

export default function CricketArena({ matchId, opponentNickname, onMatchOver }) {
  // Phase: 'TOSS_WAITING' | 'TOSS_DECISION' | 'INNINGS_1' | 'INNINGS_BREAK' | 'INNINGS_2' | 'SUPER_OVER_1' | 'SUPER_OVER_2' | 'MATCH_OVER'
  const [phase, setPhase] = useState('TOSS_WAITING');
  const [role, setRole] = useState(null); // 'bat' | 'bowl' | null
  const [tossState, setTossState] = useState(null);
  const [currentInnings, setCurrentInnings] = useState({
    runs: 0,
    wickets: 0,
    balls: 0,
    oversFormatted: '0.0',
    target: null,
    timeline: []
  });
  const [scorecard, setScorecard] = useState({
    innings1: { runs: 0, wickets: 0, oversFormatted: '0.0' },
    innings2: { runs: 0, wickets: 0, oversFormatted: '0.0', target: null }
  });

  const [myTossCall, setMyTossCall] = useState('odd'); // 'odd' | 'even'
  const [myMove, setMyMove] = useState(null);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [deliveryBanner, setDeliveryBanner] = useState(null);
  const [tossBanner, setTossBanner] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Initial state fetch & listeners
  useEffect(() => {
    if (socketService.socket) {
      socketService.socket.emit('cricket:get-state', { matchId });
    }

    const unsubState = socketService.on('cricket:state', (state) => {
      if (state.matchId === matchId) {
        setPhase(state.phase);
        setRole(state.role);
        setTossState(state.toss);
        setCurrentInnings(state.currentInnings);
        setScorecard(state.scorecard);
        setMyMove(state.myMoveSubmitted ? (myMove || 'locked') : null);
        setOpponentSubmitted(state.opponentSubmitted);

        if (state.timeoutAt) {
          const rem = Math.max(0, Math.ceil((state.timeoutAt - Date.now()) / 1000));
          setTimeRemaining(rem);
        }
      }
    });

    const unsubTossResult = socketService.on('cricket:toss-result', (data) => {
      setTossBanner(data);
      setTimeout(() => setTossBanner(null), 4000);
    });

    const unsubTossDecision = socketService.on('cricket:toss-decision-made', (data) => {
      setMyMove(null);
      setOpponentSubmitted(false);
    });

    const unsubOpponentSub = socketService.on('cricket:opponent-submitted', () => {
      setOpponentSubmitted(true);
    });

    const unsubAccepted = socketService.on('cricket:delivery-accepted', (data) => {
      setMyMove(data.number);
    });

    const unsubDeliveryResult = socketService.on('cricket:delivery-result', (data) => {
      setDeliveryBanner(data.deliveryRecord);
      setTimeout(() => {
        setDeliveryBanner(null);
        setMyMove(null);
        setOpponentSubmitted(false);
      }, 3000);
    });

    const unsubMatchResult = socketService.on('cricket:match-result', (result) => {
      if (result.winnerNickname && result.winnerNickname !== opponentNickname) {
        try {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        } catch {}
      }
      if (onMatchOver) {
        onMatchOver(result);
      }
    });

    const unsubError = socketService.on('cricket:error', (err) => {
      setErrorMsg(err.message || 'Action failed.');
      setTimeout(() => setErrorMsg(null), 4000);
    });

    return () => {
      unsubState();
      unsubTossResult();
      unsubTossDecision();
      unsubOpponentSub();
      unsubAccepted();
      unsubDeliveryResult();
      unsubMatchResult();
      unsubError();
    };
  }, [matchId, opponentNickname]);

  // Turn timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, currentInnings.balls]);

  const handleTossChoice = (number) => {
    setMyMove(number);
    socketService.socket.emit('cricket:toss-choice', {
      matchId,
      number,
      call: tossState?.isCaller ? myTossCall : undefined
    });
  };

  const handleTossDecision = (decision) => {
    socketService.socket.emit('cricket:toss-decision', { matchId, decision });
  };

  const handleDeliveryMove = (number) => {
    if (myMove) return;
    setMyMove(number);
    socketService.socket.emit('cricket:delivery', {
      matchId,
      number,
      ballIndex: currentInnings.balls + 1
    });
  };

  const numbers = [1, 2, 3, 4, 5, 6];

  return (
    <div className="flex flex-col h-full items-center justify-between p-4 sm:p-6 select-none relative">
      {/* Top Header / Scorecard */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 shadow-lg">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            {phase.startsWith('SUPER_OVER') ? '⚡ Super Over' : phase === 'INNINGS_2' ? 'Innings 2 (Chase)' : phase === 'INNINGS_1' ? 'Innings 1' : 'Toss'}
          </span>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{role === 'bat' ? '🏏 Batting' : role === 'bowl' ? '⚾ Bowling' : 'Determining Toss'}</span>
            {currentInnings.target && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Target: {currentInnings.target}
              </span>
            )}
          </h3>
        </div>

        {/* Live Score Display */}
        {['INNINGS_1', 'INNINGS_2', 'SUPER_OVER_1', 'SUPER_OVER_2'].includes(phase) && (
          <div className="flex items-center gap-4 bg-[#070709] border border-zinc-800 px-4 py-2 rounded-xl">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-[#ff007f]">Score</span>
              <span className="block text-2xl font-mono font-black text-white">
                {currentInnings.runs}/{currentInnings.wickets}
              </span>
            </div>
            <span className="text-zinc-600 font-bold">|</span>
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-[#ccff00]">Overs</span>
              <span className="block text-xl font-mono font-bold text-zinc-200">
                {currentInnings.oversFormatted}
                <span className="text-xs text-zinc-500"> / 3.0</span>
              </span>
            </div>
          </div>
        )}

        {/* Turn Timer */}
        <div className="flex items-center gap-2">
          <Clock size={16} className={timeRemaining <= 5 ? 'text-[#ff007f] animate-pulse' : 'text-zinc-400'} />
          <span className={`font-mono text-lg font-bold ${timeRemaining <= 5 ? 'text-[#ff007f] animate-pulse' : 'text-zinc-200'}`}>
            {timeRemaining}s
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="w-full mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- TOSS PHASE --- */}
      {phase === 'TOSS_WAITING' && (
        <div className="flex flex-col items-center justify-center my-auto p-6 max-w-md w-full bg-[#0e0f15] border border-zinc-800 rounded-2xl text-center shadow-xl">
          <h4 className="text-base font-bold text-white mb-1">Odd or Even Toss</h4>
          <p className="text-xs text-zinc-400 mb-6">
            {tossState?.isCaller ? 'Choose Odd or Even, then pick your number (1-6).' : `${opponentNickname} is calling Odd/Even. Pick your number (1-6).`}
          </p>

          {tossState?.isCaller && (
            <div className="flex gap-3 mb-5">
              <button
                onClick={() => setMyTossCall('odd')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${myTossCall === 'odd' ? 'bg-[#ff007f] text-white shadow-[0_0_15px_#ff007f80]' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                Odd
              </button>
              <button
                onClick={() => setMyTossCall('even')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${myTossCall === 'even' ? 'bg-[#ff007f] text-white shadow-[0_0_15px_#ff007f80]' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                Even
              </button>
            </div>
          )}

          <div className="grid grid-cols-6 gap-2 w-full">
            {numbers.map((n) => (
              <button
                key={n}
                onClick={() => handleTossChoice(n)}
                disabled={!!myMove}
                className={`py-3 rounded-xl text-lg font-black font-mono transition-all ${myMove === n ? 'bg-[#ff007f] text-white shadow-[0_0_20px_#ff007f60] scale-105 border border-[#ff4d9e]' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="mt-4 text-xs text-zinc-400">
            {myMove ? 'Your toss number is locked in! Waiting for opponent...' : 'Select your number to toss.'}
          </div>
        </div>
      )}

      {/* --- TOSS DECISION PHASE --- */}
      {phase === 'TOSS_DECISION' && (
        <div className="flex flex-col items-center justify-center my-auto p-6 max-w-md w-full bg-[#0e0f15] border border-zinc-800 rounded-2xl text-center shadow-xl">
          <Award size={36} className="text-[#ccff00] mb-2" />
          <h4 className="text-base font-bold text-white mb-1">
            {tossState?.winnerNickname} Won the Toss!
          </h4>
          {tossState?.winnerSessionId === socketService.socket?.sessionId ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-xs text-zinc-300">What would you like to do first?</p>
              <div className="flex gap-4">
                <button
                  onClick={() => handleTossDecision('bat')}
                  className="px-5 py-2.5 rounded-xl bg-[#ff007f] hover:bg-[#ff2a8d] text-white font-bold text-sm shadow-[0_0_15px_#ff007f60] transition-all flex items-center gap-2"
                >
                  <span>🏏 Bat First</span>
                </button>
                <button
                  onClick={() => handleTossDecision('bowl')}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-sm transition-all flex items-center gap-2 hover:border-[#ccff00]/60"
                >
                  <span>⚾ Bowl First</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              Waiting for {tossState?.winnerNickname} to choose batting or bowling...
            </p>
          )}
        </div>
      )}

      {/* --- DELIVERY PLAYING PHASE --- */}
      {['INNINGS_1', 'INNINGS_2', 'SUPER_OVER_1', 'SUPER_OVER_2'].includes(phase) && (
        <div className="w-full flex-1 flex flex-col items-center justify-center my-2 max-w-2xl">
          {/* Opponent Status */}
          <div className="mb-4 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/70 border border-slate-800">
            <span className={`w-2.5 h-2.5 rounded-full ${opponentSubmitted ? 'bg-cyan-400 shadow-cyan-500/50 shadow-md' : 'bg-slate-600 animate-pulse'}`} />
            <span className="text-xs text-slate-300">
              {opponentSubmitted ? `${opponentNickname} has chosen their number!` : `${opponentNickname} is thinking...`}
            </span>
          </div>

          {/* Delivery Result Banner */}
          {deliveryBanner && (
            <div className={`w-full max-w-md p-4 rounded-2xl border text-center mb-4 transition-all duration-300 ${deliveryBanner.isWicket ? 'bg-rose-950/80 border-rose-500 text-rose-200' : 'bg-emerald-950/80 border-emerald-500 text-emerald-200'}`}>
              <div className="text-2xl font-black mb-1">
                {deliveryBanner.isWicket ? '🚨 WICKET! OUT!' : `+${deliveryBanner.runsScored} RUNS!`}
              </div>
              <div className="text-xs opacity-90 flex items-center justify-center gap-4">
                <span>Batter: {deliveryBanner.batterNumber}</span>
                <span>•</span>
                <span>Bowler: {deliveryBanner.bowlerNumber}</span>
              </div>
            </div>
          )}

          {/* Target Status in 2nd Innings */}
          {currentInnings.target && (
            <div className="text-center text-xs text-amber-300/90 mb-4 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full">
              {currentInnings.runs >= currentInnings.target ? 'Target reached!' : `Need ${currentInnings.target - currentInnings.runs} runs off ${18 - currentInnings.balls} balls to win`}
            </div>
          )}

          {/* Ball By Ball Mini-Timeline */}
          <div className="flex items-center gap-1.5 mb-6">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 mr-1 font-semibold">Over:</span>
            {currentInnings.timeline?.map((item, idx) => (
              <span
                key={idx}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold border ${item.isWicket ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-800 border-slate-700 text-white'}`}
              >
                {item.isWicket ? 'W' : item.runsScored}
              </span>
            ))}
          </div>

          {/* 1 to 6 Number Action Buttons */}
          <div className="w-full max-w-md">
            <span className="block text-center text-xs text-slate-400 mb-2">
              {role === 'bat' ? 'Pick a number to score runs (avoid matching bowler)' : 'Pick a number to take a wicket (match batter)'}
            </span>
            <div className="grid grid-cols-6 gap-2.5">
              {numbers.map((n) => (
                <button
                  key={n}
                  onClick={() => handleDeliveryMove(n)}
                  disabled={!!myMove}
                  className={`h-16 rounded-2xl flex flex-col items-center justify-center font-mono font-black text-xl transition-all duration-150 ${myMove === n ? 'bg-[#ff007f] text-white shadow-xl shadow-[#ff007f]/50 scale-105 border border-[#ff4d9e]' : 'bg-[#0e0f15] hover:bg-zinc-800 hover:border-[#ccff00]/60 text-white border border-zinc-800 active:scale-95'}`}
                >
                  <span>{n}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
