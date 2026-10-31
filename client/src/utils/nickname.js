/**
 * Client-side nickname validation utility
 */
export function validateNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, error: 'Nickname is required.' };
  }

  const trimmed = nickname.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Nickname must be at least 3 characters.' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Nickname cannot exceed 20 characters.' };
  }

  // Only allow alphanumeric characters, underscores, and hyphens (safe plain text)
  const safeRegex = /^[a-zA-Z0-9_-]+$/;
  if (!safeRegex.test(trimmed)) {
    return { valid: false, error: 'Nickname can only contain letters, numbers, hyphens, and underscores.' };
  }

  // Basic client-side vulgarity blacklist
  const profanityList = ['admin', 'moderator', 'system', 'root', 'gamerizz', 'nigger', 'faggot', 'cunt', 'bitch'];
  const lower = trimmed.toLowerCase();
  if (profanityList.some(bad => lower.includes(bad))) {
    return { valid: false, error: 'This nickname contains reserved or prohibited terms.' };
  }

  return { valid: true, error: null, value: trimmed };
}
