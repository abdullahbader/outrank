import { z } from 'zod';

const serial = z.number().int().nonnegative();

/** What a phone may send. `join` is not here: joining goes through POST /games/:id/join. */
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('remove_player'), playerId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('set_categories'), categories: z.array(z.string().min(1).max(40)).min(1).max(30) }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('confirm'), rank: z.number().int(), turnSerial: serial }),
  z.object({ type: z.literal('reject'), reason: z.enum(['incorrect', 'already_claimed', 'pass']), turnSerial: serial }),
  z.object({ type: z.literal('skip_turn'), turnSerial: serial }),
  z.object({ type: z.literal('end_turn'), turnSerial: serial }),
  z.object({ type: z.literal('activate_wild'), turnSerial: serial }),
  z.object({ type: z.literal('activate_streak'), turnSerial: serial }),
  z.object({ type: z.literal('void_attempt'), attemptId: z.string().min(1).max(64), replayTurn: z.boolean() }),
  z.object({ type: z.literal('end_question') }),
  z.object({ type: z.literal('next_question') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('end_game') }),
]);

export const actionMessage = z.object({
  gameId: z.string().min(1).max(64),
  clientActionId: z.string().min(8).max(80),
  action: actionSchema,
});

export const ANSWER_SECONDS = [0, 15, 30, 45, 60] as const;
export const createGameBody = z.object({
  categories: z.array(z.string().min(1).max(40)).max(30).default([]),
  answerSeconds: z.number().int().refine((n) => (ANSWER_SECONDS as readonly number[]).includes(n)).optional(),
});
export const joinBody = z.object({ name: z.string().min(1).max(40) });
export const recoverBody = z.object({ recoveryCode: z.string().min(4).max(20) });
export const deviceBody = z.object({
  displayName: z.string().trim().min(1).max(20).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  locale: z.enum(['en', 'ar']).optional(),
});
export const botsBody = z.object({ count: z.number().int().min(1).max(15) });
