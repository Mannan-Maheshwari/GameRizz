import { storage } from './storage';

const API_BASE = '/api';

/**
 * Robust API client with automatic session header injection and graceful fallback
 */
export async function apiRequest(endpoint, options = {}) {
  const session = storage.getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (session?.sessionId) {
    headers['x-session-id'] = session.sessionId;
  }
  if (session?.sessionSecret) {
    headers['x-session-secret'] = session.sessionSecret;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the Gamerizz server. Please ensure the backend is running.'
      }
    };
  }
}

export const api = {
  async getHealth() {
    return apiRequest('/health');
  },

  async getGames() {
    return apiRequest('/games');
  },

  async createSession(confirmedAdult = true) {
    return apiRequest('/session', {
      method: 'POST',
      body: JSON.stringify({ confirmedAdult })
    });
  },

  async updateNickname(nickname) {
    return apiRequest('/session/nickname', {
      method: 'PATCH',
      body: JSON.stringify({ nickname })
    });
  },

  async getSession() {
    return apiRequest('/session/me');
  },

  async submitReport(matchId, category, reporterNote) {
    return apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify({ matchId, category, reporterNote })
    });
  }
};
