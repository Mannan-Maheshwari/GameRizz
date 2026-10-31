import { z } from 'zod';

const PROFANITY_LIST = [
  'admin', 'moderator', 'system', 'root', 'gamerizz',
  'nigger', 'faggot', 'cunt', 'bitch', 'whore', 'slut', 'penis', 'vagina'
];

export const createSessionSchema = z.object({
  confirmedAdult: z.boolean().refine(val => val === true, {
    message: 'You must confirm that you are 18 or older.'
  })
});

export const updateNicknameSchema = z.object({
  nickname: z.string()
    .trim()
    .min(3, 'Nickname must be at least 3 characters.')
    .max(20, 'Nickname cannot exceed 20 characters.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nickname can only contain letters, numbers, hyphens, and underscores.')
    .refine(val => {
      const lower = val.toLowerCase();
      return !PROFANITY_LIST.some(word => lower.includes(word));
    }, {
      message: 'Nickname contains reserved or prohibited terms.'
    })
});
