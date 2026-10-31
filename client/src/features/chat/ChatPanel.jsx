import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, AlertCircle, Smile } from 'lucide-react';
import { socketService } from '../../services/socket';
import { storage } from '../../services/storage';

const PREDEFINED_REACTIONS = ['👍', '😂', '🎉', '😮', '🔥', '👏'];

export default function ChatPanel({ matchId, opponentNickname }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [activeReactions, setActiveReactions] = useState([]);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [lastClickedEmoji, setLastClickedEmoji] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket event listeners for chat and reactions
  useEffect(() => {
    const unsubMessage = socketService.on('chat:message', (msg) => {
      if (msg.matchId === matchId) {
        setMessages((prev) => {
          if (prev.some(m => m.messageId && m.messageId === msg.messageId)) {
            return prev;
          }
          return [...prev, msg];
        });
      }
    });

    const unsubReaction = socketService.on('chat:reaction', (rx) => {
      if (rx.matchId === matchId) {
        const id = Date.now() + Math.random();
        const leftPercent = 15 + Math.floor(Math.random() * 65);
        setActiveReactions((prev) => [...prev, { id, leftPercent, ...rx }]);
        setTimeout(() => {
          setActiveReactions((prev) => prev.filter((r) => r.id !== id));
        }, 2800);
      }
    });

    const unsubError = socketService.on('chat:error', (err) => {
      setRateLimitError(err.message || 'Chat error occurred.');
      setTimeout(() => setRateLimitError(null), 4000);
    });

    return () => {
      unsubMessage();
      unsubReaction();
      unsubError();
    };
  }, [matchId]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;

    if (socketService.socket) {
      socketService.socket.emit('chat:send', {
        matchId,
        text: trimmed
      });
    }

    setText('');
  };

  const handleSendReaction = (reaction) => {
    // Visual press feedback
    setLastClickedEmoji(reaction);
    setTimeout(() => setLastClickedEmoji(null), 300);

    // Emit to server
    if (socketService.socket) {
      socketService.socket.emit('chat:reaction-send', {
        matchId,
        reaction
      });
    }

    // Immediate optimistic local animation for responsive feel
    const id = Date.now() + Math.random();
    const leftPercent = 20 + Math.floor(Math.random() * 60);
    const myNick = storage.getSession()?.nickname || 'You';
    setActiveReactions((prev) => [...prev, { id, leftPercent, reaction, senderNickname: myNick, isMe: true }]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2800);
  };

  const handleInsertEmoji = (emoji) => {
    setText((prev) => (prev.length < 498 ? prev + emoji : prev));
  };

  const mySessionId = socketService.sessionId || socketService.socket?.sessionId || storage.getSession()?.sessionId;

  return (
    <div className="flex flex-col h-full bg-[#070709] relative overflow-hidden">
      {/* Chat Header */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-zinc-800 bg-[#0e0f15] flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <MessageSquare size={13} className="text-[#ccff00]" />
          <span className="font-bold text-white truncate max-w-[130px] sm:max-w-none">Chat with {opponentNickname}</span>
        </span>
        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
          <span>🔒</span>
          <span className="hidden sm:inline">Ephemeral Chat</span>
        </span>
      </div>

      {/* Floating Reaction Animations (FR-058) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        {activeReactions.map((rx) => (
          <div
            key={rx.id}
            style={{ left: `${rx.leftPercent}%`, bottom: '70px' }}
            className="absolute reaction-float-bubble flex items-center gap-1.5 bg-[#0e0f15]/95 border border-[#ff007f]/50 rounded-full px-3 py-1 shadow-[0_0_20px_rgba(255,0,127,0.4)] backdrop-blur-md"
          >
            <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(255,0,127,0.5)]">{rx.reaction}</span>
            <span className="text-[10px] text-zinc-300 font-bold max-w-[80px] truncate">{rx.senderNickname}</span>
          </div>
        ))}
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto flex flex-col gap-2.5">
        <div className="self-center my-1 py-1 px-3.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-400 text-center font-medium shadow-sm">
          👋 Say hi! Chats disappear when the match ends.
        </div>

        {messages.map((m) => {
          const isMe = m.senderSessionId === mySessionId;
          const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={m.messageId || m.seq || Math.random()}
              className={`flex flex-col max-w-[85%] sm:max-w-[78%] ${isMe ? 'self-end items-end' : 'self-start items-start'} animate-in fade-in`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-0.5 px-1">
                <span className={`font-bold ${isMe ? 'text-[#ff66b2]' : 'text-[#ccff00]'}`}>{isMe ? 'You' : m.senderNickname}</span>
                <span>•</span>
                <span className="font-mono text-zinc-400">{time}</span>
              </div>
              <div
                className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  isMe
                    ? 'bg-gradient-to-r from-[#ff007f] to-[#e6006e] text-white rounded-tr-xs shadow-md shadow-[#ff007f]/25 font-medium'
                    : 'bg-[#12141c] text-zinc-100 border border-zinc-800 rounded-tl-xs shadow-md'
                }`}
              >
                {/* Safe plain text rendering (FR-055) */}
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Rate limit banner */}
      {rateLimitError && (
        <div className="mx-3 my-1 p-2 bg-rose-950/90 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{rateLimitError}</span>
        </div>
      )}

      {/* Interactive Quick Reaction Bar (FR-058) */}
      <div className="px-2 sm:px-3 py-1.5 border-t border-zinc-800/80 bg-[#0a0b10] flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider pl-1 hidden sm:inline">
          React:
        </span>
        <div className="flex items-center gap-1 sm:gap-2 justify-around flex-1 sm:flex-initial">
          {PREDEFINED_REACTIONS.map((emoji) => {
            const isClicked = lastClickedEmoji === emoji;
            return (
              <button
                key={emoji}
                onClick={() => handleSendReaction(emoji)}
                type="button"
                className={`transition-all duration-150 p-1.5 text-lg sm:text-xl rounded-xl select-none cursor-pointer flex items-center justify-center hover:bg-zinc-800/80 active:scale-125 ${
                  isClicked ? 'scale-135 bg-[#ff007f]/20 shadow-[0_0_15px_#ff007f]' : 'hover:scale-115'
                }`}
                title={`Send ${emoji} Reaction (Double-click to insert in text)`}
                onDoubleClick={() => handleInsertEmoji(emoji)}
              >
                <span>{emoji}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input bar */}
      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t border-zinc-800 bg-[#0e0f15] flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Type a message..."
            className="w-full bg-[#070709] border border-zinc-700/80 focus:border-[#ccff00] rounded-xl pl-3 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {text.length > 350 && (
            <span className="absolute right-2 top-2.5 text-[10px] font-mono text-zinc-500">
              {500 - text.length}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2.5 rounded-xl bg-[#ff007f] hover:bg-[#ff2a8d] disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold shadow-lg shadow-[#ff007f]/30 disabled:shadow-none transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          title="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
