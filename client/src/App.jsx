import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import LegalModal from './components/LegalModal';
import GuestLanding from './features/guest/GuestLanding';
import AgeGateModal from './features/guest/AgeGateModal';
import NicknameModal from './features/guest/NicknameModal';
import LobbyPage from './pages/LobbyPage';
import QueueScreen from './features/matchmaking/QueueScreen';
import ActiveMatchLayout from './features/match/ActiveMatchLayout';
import MatchEndedModal from './features/match/MatchEndedModal';
import ReportModal from './features/moderation/ReportModal';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PageTransition from './components/PageTransition';
import { storage } from './services/storage';
import { api } from './services/api';
import { socketService } from './services/socket';

export default function App() {
  // Navigation & View state: 'landing' | 'lobby' | 'queue' | 'match'
  const [currentView, setCurrentView] = useState('landing');
  
  // Guest Session state
  const [session, setSession] = useState(null);
  const [nickname, setNickname] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [selectedGame, setSelectedGame] = useState('rps'); // 'rps' | 'cricket'
  
  // Matchmaking & Match State
  const [queueStatus, setQueueStatus] = useState('Searching for challenger...');
  const [switchOffer, setSwitchOffer] = useState(null);
  const [matchFoundData, setMatchFoundData] = useState(null);
  const [activeMatch, setActiveMatch] = useState(null);
  const [endedMatchResult, setEndedMatchResult] = useState(null);
  
  // Modals state
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [legalModalType, setLegalModalType] = useState(null);
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [connectionError, setConnectionError] = useState(null);
  const [queueWaiters, setQueueWaiters] = useState({ rps: 0, cricket: 0 });

  // Load existing session and age confirmation on initial mount.
  // Server sessions are in-memory, so a stored browser session is revalidated first.
  useEffect(() => {
    const confirmed = storage.isAgeConfirmed();
    setIsAgeConfirmed(confirmed);
    if (!confirmed) return;

    let cancelled = false;

    (async () => {
      let existing = storage.getSession();
      if (existing) {
        const me = await api.getSession();
        if (!me?.success) {
          storage.clearSession();
          existing = null;
        }
      }

      if (!existing) {
        const created = await api.createSession(true);
        if (!created?.success) {
          setConnectionError('Unable to connect to game server. Retrying...');
          return;
        }
        const { sessionId, sessionSecret, nickname: sNick } = created.data;
        storage.setSession(sessionId, sessionSecret, sNick);
        existing = { sessionId, sessionSecret, nickname: sNick };
      }

      if (cancelled || !existing) return;
      setSession(existing);
      setNickname(existing.nickname);
      setCurrentView('lobby');
      socketService.connect(existing.sessionId, existing.sessionSecret);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    const unsubConn = socketService.on('connection:status', (status) => {
      setConnectionStatus(status);
      if (status === 'error') {
        setConnectionError('Unable to connect to game server. Retrying...');
      } else {
        setConnectionError(null);
      }
    });

    const unsubInvalid = socketService.on('session:invalid', () => {
      storage.clearSession();
      socketService.disconnect();
      initGuestSession();
    });

    const unsubJoined = socketService.on('queue:joined', () => {
      setQueueStatus('Waiting for a player to connect...');
      setSwitchOffer(null);
    });

    const unsubCancelled = socketService.on('queue:cancelled', () => {
      setCurrentView('lobby');
      setSwitchOffer(null);
      setMatchFoundData(null);
    });

    const unsubOffer = socketService.on('queue:switch-offer', (offer) => {
      setSwitchOffer(offer);
    });

    const unsubSwitchResult = socketService.on('queue:switch-result', (result) => {
      if (result.success) {
        setSelectedGame(result.gameType);
        setSwitchOffer(null);
        setQueueStatus(`Switched to ${result.gameType === 'rps' ? 'Rock Paper Scissors' : 'Hand Cricket'}. Waiting...`);
      }
    });

    const unsubMatchFound = socketService.on('match:found', (data) => {
      setMatchFoundData(data);
      setTimeout(() => {
        setActiveMatch(data);
        setCurrentView('match');
      }, 1500);
    });

    const unsubMatchEnded = socketService.on('match:ended', (data) => {
      // If match ended without a completed modal result (e.g. skipped or opponent left)
      if (data.reason === 'skipped') {
        if (data.skippedBy === session?.sessionId) {
          // Re-queue initiator immediately (FR-023)
          handleStartMatchmaking(selectedGame);
        } else {
          setActiveMatch(null);
          setCurrentView('lobby');
        }
      } else if (data.reason === 'opponent_left' || data.reason === 'left') {
        setActiveMatch(null);
        setCurrentView('lobby');
      }
    });

    return () => {
      unsubConn();
      unsubInvalid();
      unsubJoined();
      unsubCancelled();
      unsubOffer();
      unsubSwitchResult();
      unsubMatchFound();
      unsubMatchEnded();
    };
  }, [session, selectedGame]);

  // Entry flow handler
  const handleStartGuestFlow = () => {
    if (!isAgeConfirmed) {
      setShowAgeGate(true);
    } else if (!session) {
      initGuestSession();
    } else {
      setCurrentView('lobby');
    }
  };

  // Initialize guest session via API
  const initGuestSession = async () => {
    const res = await api.createSession(true);
    if (res?.success) {
      const { sessionId, sessionSecret, nickname: sNick } = res.data;
      storage.setSession(sessionId, sessionSecret, sNick);
      setSession({ sessionId, sessionSecret, nickname: sNick });
      setNickname(sNick);
      setCurrentView('lobby');
      setConnectionError(null);
      socketService.connect(sessionId, sessionSecret);
      return;
    }

    setConnectionError(res?.error?.message || 'Unable to connect to game server. Retrying...');
  };

  // Age confirmed
  const handleAgeConfirmed = () => {
    setIsAgeConfirmed(true);
    storage.setAgeConfirmed(true);
    setShowAgeGate(false);
    initGuestSession();
  };

  // Nickname update
  const handleUpdateNickname = async (newNickname) => {
    const res = await api.updateNickname(newNickname);
    if (res && res.success) {
      setNickname(res.data.nickname);
      storage.setNickname(res.data.nickname);
      return { success: true };
    } else if (res?.error) {
      return { success: false, error: res.error };
    }

    setNickname(newNickname);
    storage.setNickname(newNickname);
    return { success: true };
  };

  // Start Matchmaking (FR-011)
  const handleStartMatchmaking = (gameId) => {
    setSelectedGame(gameId);
    if (!session) {
      handleStartGuestFlow();
      return;
    }
    setEndedMatchResult(null);
    setMatchFoundData(null);
    setSwitchOffer(null);
    setCurrentView('queue');
    socketService.joinQueue(gameId, storage.getBlocklist());
  };

  // Cancel Queue (FR-018)
  const handleCancelQueue = () => {
    socketService.cancelQueue();
    setCurrentView('lobby');
  };

  // Respond to switch offer (FR-016)
  const handleRespondSwitchOffer = (accept) => {
    socketService.respondQueueSwitch(accept);
    if (!accept) {
      setSwitchOffer(null);
    }
  };

  // Skip Match (FR-023: Initiator is re-queued for another stranger)
  const handleSkipMatch = () => {
    if (activeMatch) {
      socketService.skipMatch(activeMatch.matchId);
      handleStartMatchmaking(selectedGame);
    }
  };

  // Leave Match (FR-024: Returns to lobby)
  const handleLeaveMatch = () => {
    if (activeMatch) {
      socketService.leaveMatch(activeMatch.matchId);
      setActiveMatch(null);
      setCurrentView('lobby');
    }
  };

  // Match completed
  const handleMatchOver = (result) => {
    setEndedMatchResult(result);
  };

  const handlePostMatchBlock = () => {
    if (activeMatch) {
      storage.addToBlocklist(activeMatch.opponentNickname);
      alert(`${activeMatch.opponentNickname} has been blocked from your local matches.`);
    }
  };

  return (
    <div className="app-layout">
      <Header
        nickname={nickname}
        onEditNickname={() => setShowNicknameModal(true)}
        onOpenLegal={setLegalModalType}
        connectionStatus={connectionStatus}
      />

      <main className="main-content">
        <PageTransition transitionKey={currentView}>
          {currentView === 'landing' ? (
            <GuestLanding
              onStart={handleStartGuestFlow}
              onOpenLegal={setLegalModalType}
            />
          ) : currentView === 'lobby' ? (
            <LobbyPage
              nickname={nickname}
              onEditNickname={() => setShowNicknameModal(true)}
              selectedGame={selectedGame}
              onSelectGame={setSelectedGame}
              onStartMatchmaking={handleStartMatchmaking}
              queueWaiters={queueWaiters}
              connectionError={connectionError}
            />
          ) : currentView === 'queue' ? (
            <QueueScreen
              selectedGame={selectedGame}
              queueStatus={queueStatus}
              switchOffer={switchOffer}
              onCancelQueue={handleCancelQueue}
              onRespondSwitchOffer={handleRespondSwitchOffer}
              matchFoundData={matchFoundData}
            />
          ) : currentView === 'match' && activeMatch ? (
            <ActiveMatchLayout
              activeMatch={activeMatch}
              onSkipMatch={handleSkipMatch}
              onLeaveMatch={handleLeaveMatch}
              onOpenReport={() => setShowReportModal(true)}
              onMatchOver={handleMatchOver}
            />
          ) : currentView === 'admin' ? (
            <AdminDashboardPage onReturnToLobby={() => setCurrentView('lobby')} />
          ) : null}
        </PageTransition>
      </main>

      {currentView !== 'admin' && (
        <Footer
          onOpenLegal={setLegalModalType}
          onOpenAdmin={() => setCurrentView('admin')}
        />
      )}

      {/* Match Ended Modal (Screen F) */}
      {endedMatchResult && (
        <MatchEndedModal
          matchResult={endedMatchResult}
          opponentNickname={activeMatch?.opponentNickname || 'Opponent'}
          onFindAnother={() => handleStartMatchmaking(selectedGame)}
          onReturnLobby={() => {
            setEndedMatchResult(null);
            setActiveMatch(null);
            setCurrentView('lobby');
          }}
          onReport={() => setShowReportModal(true)}
          onBlock={handlePostMatchBlock}
        />
      )}

      {/* Report Modal (Screen E / F) (FR-063 - FR-067) */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        matchId={activeMatch?.matchId}
        opponentNickname={activeMatch?.opponentNickname}
        opponentSessionId={activeMatch?.playerSessionIds?.find(id => id !== session?.sessionId)}
        onReportSubmitted={() => {
          setActiveMatch(null);
          setCurrentView('lobby');
        }}
      />

      {/* Modals */}
      {showAgeGate && (
        <AgeGateModal
          onConfirm={handleAgeConfirmed}
          onOpenLegal={setLegalModalType}
        />
      )}

      {showNicknameModal && (
        <NicknameModal
          currentNickname={nickname}
          onSave={handleUpdateNickname}
          onClose={() => setShowNicknameModal(false)}
        />
      )}

      {legalModalType && (
        <LegalModal
          modalType={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
      )}
    </div>
  );
}
