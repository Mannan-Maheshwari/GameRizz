import { io } from 'socket.io-client';
import { storage } from './storage';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.currentAuth = null;
    this.sessionId = null;
  }

  connect(sessionId, sessionSecret) {
    if (this.socket?.connected && this.currentAuth?.sessionId === sessionId) {
      this.sessionId = sessionId;
      if (this.socket) this.socket.sessionId = sessionId;
      return this.socket;
    }

    this.disconnect();
    this.sessionId = sessionId;
    this.currentAuth = { sessionId, sessionSecret };

    // Polling first is more reliable through the Vite dev proxy.
    this.socket = io({
      path: '/socket.io',
      auth: {
        sessionId,
        sessionSecret
      },
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000
    });

    this.socket.sessionId = sessionId;

    this.socket.on('connect', () => {
      this.emitInternal('connection:status', 'connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.emitInternal('connection:status', 'disconnected');
    });

    this.socket.on('connect_error', (error) => {
      const code = error?.data?.code;
      this.emitInternal('connection:status', 'error');
      if (code === 'INVALID_SESSION' || code === 'AUTH_REQUIRED') {
        this.socket.io.reconnection(false);
        this.emitInternal('session:invalid', { code, message: error.message });
      }
    });

    // Update sessionId if confirmed by server
    this.socket.on('session:ready', (data) => {
      if (data?.sessionId) {
        this.sessionId = data.sessionId;
        if (this.socket) this.socket.sessionId = data.sessionId;
      }
      this.emitInternal('session:ready', data);
    });

    // Catch-all listener: forward ANY server event to registered listeners
    if (typeof this.socket.onAny === 'function') {
      this.socket.onAny((event, ...args) => {
        if (event !== 'session:ready') {
          this.emitInternal(event, args[0], ...args.slice(1));
        }
      });
    }

    // Attach existing registered listeners to this socket
    for (const event of this.listeners.keys()) {
      if (!this.socket.hasListeners?.(event)) {
        this.socket.on(event, (...args) => {
          this.emitInternal(event, args[0], ...args.slice(1));
        });
      }
    }

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentAuth = null;
  }

  joinQueue(gameType, clientBlocklist = []) {
    if (this.socket) {
      this.socket.emit('queue:join', { gameType, clientBlocklist });
    }
  }

  cancelQueue() {
    if (this.socket) {
      this.socket.emit('queue:cancel', {});
    }
  }

  respondQueueSwitch(accept) {
    if (this.socket) {
      this.socket.emit('queue:switch-respond', { accept });
    }
  }

  skipMatch(matchId) {
    if (this.socket) {
      this.socket.emit('match:skip', { matchId });
    }
  }

  leaveMatch(matchId) {
    if (this.socket) {
      this.socket.emit('match:leave', { matchId });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      if (this.socket && typeof this.socket.on === 'function') {
        this.socket.on(event, (...args) => {
          this.emitInternal(event, args[0], ...args.slice(1));
        });
      }
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emitInternal(event, data, ...extra) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data, ...extra);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      }
    }
  }
}

export const socketService = new SocketService();
