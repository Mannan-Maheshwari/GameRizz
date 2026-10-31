const STORAGE_KEYS = {
  SESSION_ID: 'gamerizz_session_id',
  SESSION_SECRET: 'gamerizz_session_secret',
  NICKNAME: 'gamerizz_nickname',
  AGE_CONFIRMED: 'gamerizz_age_confirmed',
  BLOCKLIST: 'gamerizz_client_blocklist'
};

export const storage = {
  getSession() {
    try {
      const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      const sessionSecret = localStorage.getItem(STORAGE_KEYS.SESSION_SECRET);
      const nickname = localStorage.getItem(STORAGE_KEYS.NICKNAME);
      const ageConfirmed = localStorage.getItem(STORAGE_KEYS.AGE_CONFIRMED) === 'true';

      if (sessionId && sessionSecret && nickname) {
        return { sessionId, sessionSecret, nickname, ageConfirmed };
      }
      return null;
    } catch {
      return null;
    }
  },

  setSession(sessionId, sessionSecret, nickname) {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSION_SECRET, sessionSecret);
      localStorage.setItem(STORAGE_KEYS.NICKNAME, nickname);
    } catch (e) {
      console.warn('Unable to persist session to localStorage', e);
    }
  },

  setNickname(nickname) {
    try {
      localStorage.setItem(STORAGE_KEYS.NICKNAME, nickname);
    } catch (e) {
      console.warn('Unable to persist nickname to localStorage', e);
    }
  },

  setAgeConfirmed(confirmed) {
    try {
      localStorage.setItem(STORAGE_KEYS.AGE_CONFIRMED, confirmed ? 'true' : 'false');
    } catch (e) {
      console.warn('Unable to persist age confirmation', e);
    }
  },

  isAgeConfirmed() {
    try {
      return localStorage.getItem(STORAGE_KEYS.AGE_CONFIRMED) === 'true';
    } catch {
      return false;
    }
  },

  getBlocklist() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BLOCKLIST);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addToBlocklist(pseudonymOrSessionId) {
    try {
      const current = this.getBlocklist();
      if (!current.includes(pseudonymOrSessionId)) {
        current.push(pseudonymOrSessionId);
        localStorage.setItem(STORAGE_KEYS.BLOCKLIST, JSON.stringify(current));
      }
      return current;
    } catch {
      return [];
    }
  },

  clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.SESSION_SECRET);
      localStorage.removeItem(STORAGE_KEYS.NICKNAME);
    } catch (e) {
      console.warn('Failed clearing session', e);
    }
  }
};
