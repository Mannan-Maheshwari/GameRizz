import React from 'react';
import { Play, Zap, MessageSquare, Lock, Sparkles } from 'lucide-react';

export default function GuestLanding({ onStart, onOpenLegal }) {
  return (
    <div className="landing-hero-container">
      <div className="hero-badge">
        <Sparkles size={14} className="text-[#ff007f] animate-pulse" />
        <span>Instant 18+ Browser Gaming with Strangers</span>
      </div>

      <h1 className="hero-title">
        Meet Strangers. <br />
        <span className="text-gradient">Play Real Games.</span>
      </h1>

      <p className="hero-subtitle">
        Jump straight into casual multiplayer duels — Rock Paper Scissors and Hand Cricket — 
        with live text chat and zero accounts. Anonymous by default, instant, and 100% free.
      </p>

      <div className="hero-cta-group">
        <button
          onClick={onStart}
          className="btn btn-primary btn-hero group cursor-pointer"
          id="landing-play-button"
        >
          <Play size={22} fill="currentColor" className="transition-transform group-hover:scale-110" />
          <span>Play Now as Guest</span>
        </button>
        <span className="cta-note">No sign up or credit card required • Instant guest matchmaking</span>
      </div>

      <div className="hero-features-grid">
        <div className="feature-card glass-panel hover:border-[#ff007f]/50">
          <div className="feature-icon text-[#ff007f] bg-[#ff007f]/10 border border-[#ff007f]/30">
            <Zap size={24} />
          </div>
          <h3>Zero Registration</h3>
          <p>Get a unique nickname automatically and enter the lobby in one click. No emails, no passwords.</p>
        </div>

        <div className="feature-card glass-panel hover:border-[#ccff00]/50">
          <div className="feature-icon text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/30">
            <MessageSquare size={24} />
          </div>
          <h3>Ephemeral Text Chat</h3>
          <p>Live text chat alongside your game. No webcams, no audio, and conversations are never stored.</p>
        </div>

        <div className="feature-card glass-panel hover:border-[#ff007f]/50">
          <div className="feature-icon text-[#ff007f] bg-[#ff007f]/10 border border-[#ff007f]/30">
            <Lock size={24} />
          </div>
          <h3>Safe & Server-Authoritative</h3>
          <p>Strict server-enforced rules prevent cheating. Instant skip, report, and mutual block controls.</p>
        </div>
      </div>
    </div>
  );
}
