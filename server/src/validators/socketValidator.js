import { z } from 'zod';

export const socketAuthSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  sessionSecret: z.string().min(1, 'sessionSecret is required')
});

export const queueJoinSchema = z.object({
  gameType: z.enum(['rps', 'cricket'], {
    errorMap: () => ({ message: 'gameType must be "rps" or "cricket"' })
  }),
  clientBlocklist: z.array(z.string()).optional().default([])
});

export const queueSwitchRespondSchema = z.object({
  accept: z.boolean()
});

export const chatSendSchema = z.object({
  matchId: z.string().min(1),
  text: z.string().trim().min(1).max(500, 'Message cannot exceed 500 characters.')
});

export const chatReactionSchema = z.object({
  matchId: z.string().min(1),
  reaction: z.enum(['👍', '😂', '🎉', '😮', '🔥', '👏'])
});

export const rpsMoveSchema = z.object({
  matchId: z.string().min(1),
  move: z.enum(['rock', 'paper', 'scissors'])
});

export const cricketTossSchema = z.object({
  matchId: z.string().min(1),
  call: z.enum(['odd', 'even']).optional(),
  number: z.number().int().min(1).max(6)
});

export const cricketTossDecisionSchema = z.object({
  matchId: z.string().min(1),
  decision: z.enum(['bat', 'bowl'])
});

export const cricketDeliverySchema = z.object({
  matchId: z.string().min(1),
  number: z.number().int().min(1).max(6),
  ballIndex: z.number().int().optional()
});

export const moderationReportSchema = z.object({
  matchId: z.string().min(1),
  category: z.enum([
    'harassment',
    'sexual_content',
    'hate_speech',
    'spam',
    'threats',
    'other'
  ]),
  reporterNote: z.string().max(300).optional().default('')
});

export const moderationBlockSchema = z.object({
  targetSessionId: z.string().min(1)
});
