import React from 'react';
import { Play, Users, Info } from 'lucide-react';

export default function GameSelector({ selectedGame, onSelectGame, onStartMatchmaking, queueWaiters = {} }) {
  const games = [
    {
      id: 'rps',
      title: 'Rock Paper Scissors',
      subtitle: 'Best of 3 Rounds',
      badge: 'Classic Duel',
      icon: '✂️',
      description: 'The definitive mind game. 20-second turn timers, hidden move submissions, and sudden-death excitement.',
      rules: [
        'First to 2 wins takes the match',
        'Tied rounds do not award points',
        'Rock beats Scissors, Scissors beats Paper, Paper beats Rock'
      ],
      themeColor: '#ff007f'
    },
    {
      id: 'cricket',
      title: 'Hand Cricket',
      subtitle: '3 Overs (18 Balls) Per Innings',
      badge: 'Street Strategy',
      icon: '🏏',
      description: 'The beloved schoolyard game! Odd/even toss, hidden 1-6 choices, batting, bowling, wickets, and super-overs.',
      rules: [
        'Odd / Even toss decides who bats first',
        'Choose 1 to 6. Same numbers = OUT! Different numbers = Runs added',
        '3 overs (18 legal deliveries) per innings. Super-over tie breakers'
      ],
      themeColor: '#ccff00'
    }
  ];

  return (
    <div className="game-selector-container">
      <div className="game-selector-header">
        <h2 className="section-title">Select a Game</h2>
        <p className="section-subtitle">Choose your battleground and get matched with a stranger worldwide</p>
      </div>

      <div className="games-grid">
        {games.map((game) => {
          const isSelected = selectedGame === game.id;
          const waiters = queueWaiters[game.id] || 0;

          return (
            <div
              key={game.id}
              className={`game-card glass-panel ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectGame(game.id)}
              id={`game-card-${game.id}`}
              style={{
                borderColor: isSelected ? game.themeColor : undefined,
                boxShadow: isSelected
                  ? `0 0 0 2px ${game.themeColor}, 0 15px 35px rgba(0,0,0,0.85), 0 0 25px ${game.themeColor}55`
                  : undefined
              }}
            >
              <div className="game-card-top">
                <div className="game-card-icon">{game.icon}</div>
                <div className="game-badge-group">
                  <span
                    className="game-badge"
                    style={{
                      borderColor: `${game.themeColor}60`,
                      color: game.themeColor,
                      backgroundColor: `${game.themeColor}18`,
                      boxShadow: `0 0 10px ${game.themeColor}30`
                    }}
                  >
                    {game.badge}
                  </span>
                  <div className="waiters-indicator" title="Active players in queue">
                    <Users size={13} style={{ color: '#ccff00' }} />
                    <span style={{ color: '#ccff00' }}>{waiters > 0 ? `${waiters} waiting` : 'Ready to match'}</span>
                  </div>
                </div>
              </div>

              <div className="game-card-body">
                <h3 className="game-card-title">{game.title}</h3>
                <span className="game-card-subtitle" style={{ color: game.themeColor }}>
                  {game.subtitle}
                </span>
                <p className="game-card-description">{game.description}</p>

                <div className="game-card-rules">
                  <div className="rules-heading">
                    <Info size={14} style={{ color: '#ccff00' }} />
                    <span>Quick Rules</span>
                  </div>
                  <ul>
                    {game.rules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="game-card-footer">
                <button
                  type="button"
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'} btn-block`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectGame(game.id);
                    onStartMatchmaking(game.id);
                  }}
                  id={`play-button-${game.id}`}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Play {game.title}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
