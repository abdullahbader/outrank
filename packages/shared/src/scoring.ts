// The one and only scoring table (brief §5B). Every screen reads points from here via the server.

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const POINTS: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 20, 11: -11, 12: -12,
};

export function isValidRank(rank: unknown): rank is number {
  return typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= 12;
}

export function basePoints(rank: number): number {
  if (!isValidRank(rank)) throw new Error(`Invalid rank ${rank}`);
  return POINTS[rank];
}

export function pointsFor(rank: number, multiplier: number): number {
  return basePoints(rank) * multiplier;
}

/** Rotate after a completed question: the first player moves to the end (brief §5E). */
export function rotate<T>(order: readonly T[]): T[] {
  if (order.length < 2) return [...order];
  return [...order.slice(1), order[0]];
}
