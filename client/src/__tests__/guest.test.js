import { describe, it, expect, beforeEach } from 'vitest';
import { validateNickname } from '../utils/nickname';
import { storage } from '../services/storage';

describe('Phase 1: Nickname Validation (FR-004, FR-006, FR-007)', () => {
  it('accepts valid nicknames within 3-20 characters', () => {
    const res = validateNickname('PixelFox482');
    expect(res.valid).toBe(true);
    expect(res.value).toBe('PixelFox482');
    expect(res.error).toBeNull();
  });

  it('trims whitespace and accepts valid trimmed strings', () => {
    const res = validateNickname('   CyberKnight   ');
    expect(res.valid).toBe(true);
    expect(res.value).toBe('CyberKnight');
  });

  it('rejects nicknames shorter than 3 characters', () => {
    const res = validateNickname('ab');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('at least 3 characters');
  });

  it('rejects nicknames longer than 20 characters', () => {
    const res = validateNickname('Supercalifragilisticexpialidocious');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('cannot exceed 20 characters');
  });

  it('rejects special characters, markup, and spaces inside', () => {
    const res1 = validateNickname('<script>');
    expect(res1.valid).toBe(false);

    const res2 = validateNickname('John Doe');
    expect(res2.valid).toBe(false);

    const res3 = validateNickname('Hello@World!');
    expect(res3.valid).toBe(false);
  });

  it('rejects vulgar and reserved terms', () => {
    const res = validateNickname('admin_user');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('reserved or prohibited');
  });
});

describe('Phase 1: Local Storage Service (FR-003, FR-072)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves age confirmation state', () => {
    expect(storage.isAgeConfirmed()).toBe(false);
    storage.setAgeConfirmed(true);
    expect(storage.isAgeConfirmed()).toBe(true);
  });

  it('stores and retrieves session credentials and nickname', () => {
    storage.setSession('sess_123', 'sec_456', 'PixelFox482');
    const session = storage.getSession();
    expect(session.sessionId).toBe('sess_123');
    expect(session.sessionSecret).toBe('sec_456');
    expect(session.nickname).toBe('PixelFox482');
  });

  it('manages anonymous client-side blocklist', () => {
    expect(storage.getBlocklist()).toEqual([]);
    storage.addToBlocklist('opponent_789');
    expect(storage.getBlocklist()).toEqual(['opponent_789']);

    // Idempotent addition
    storage.addToBlocklist('opponent_789');
    expect(storage.getBlocklist()).toEqual(['opponent_789']);
  });
});
