// Automatic question selection (brief §9B). Pure: the caller passes the random source.

export interface SelectableQuestion {
  id: string;
  categoryId: string;
}

/** Small seeded PRNG so selections can be reproduced in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Balanced selection: questions are taken from the chosen categories in turn (category order
 * reshuffled every pass), so no category dominates. No duplicates; order is random.
 * Returns at most `count` ids (fewer if the pool is smaller).
 */
export function selectQuestions(
  pool: readonly SelectableQuestion[],
  categories: readonly string[],
  count: number,
  rng: () => number,
): string[] {
  const wanted = new Set(categories);
  const byCategory = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const q of pool) {
    if (!wanted.has(q.categoryId) || seen.has(q.id)) continue;
    seen.add(q.id);
    const list = byCategory.get(q.categoryId) ?? [];
    list.push(q.id);
    byCategory.set(q.categoryId, list);
  }
  const lists = new Map([...byCategory].map(([k, v]) => [k, shuffle(v, rng)]));
  const out: string[] = [];
  while (out.length < count) {
    const open = shuffle([...lists.keys()].filter((k) => lists.get(k)!.length > 0).sort(), rng);
    if (!open.length) break;
    for (const k of open) {
      if (out.length >= count) break;
      out.push(lists.get(k)!.shift()!);
    }
  }
  return out;
}

/** How many ready questions the chosen categories offer (for the Create Game screen). */
export function countAvailable(pool: readonly SelectableQuestion[], categories: readonly string[]): number {
  const wanted = new Set(categories);
  return new Set(pool.filter((q) => wanted.has(q.categoryId)).map((q) => q.id)).size;
}
