import type { LiveView } from '../useGame';
import { avatarColor } from '../theme';

export function people(view: LiveView) {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  return {
    name: (id: string | null | undefined) => (id ? names.get(id) ?? '?' : '?'),
    tint: (id: string) => avatarColor(id),
    list: (ids: string[], sep = ', ') => ids.map((id) => names.get(id) ?? '?').join(sep),
  };
}

export const isHost = (v: LiveView) => v.role === 'host';

/** Turn state of each participant in the current question. */
export function turnStates(view: LiveView) {
  const r = view.round;
  if (!r) return [];
  return r.participants.map((id, i) => {
    const mine = r.attempts.filter((a) => a.playerId === id && !a.voided);
    const scored = mine.some((a) => a.outcome === 'correct' && !a.cancelledByStreak);
    const status = r.finished || i < r.turnIndex ? (scored ? 'scored' : 'missed') : i === r.turnIndex ? 'current' : 'waiting';
    return { id, status: status as 'scored' | 'missed' | 'current' | 'waiting' };
  });
}
