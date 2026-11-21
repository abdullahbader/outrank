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
  // Turns go round the table repeatedly; show each player's most recent result in this question.
  return r.participants.map((id) => {
    const last = [...r.attempts].reverse().find((a) => a.playerId === id && !a.voided);
    const current = !r.finished && r.turn?.playerId === id;
    const status = current ? 'current' : !last ? 'waiting' : last.outcome === 'correct' && !last.cancelledByStreak ? 'scored' : 'missed';
    const points = r.attempts.filter((a) => a.playerId === id && !a.voided && a.outcome === 'correct' && !a.cancelledByStreak).reduce((n, a) => n + a.points, 0);
    return { id, status: status as 'scored' | 'missed' | 'current' | 'waiting', points };
  });
}
