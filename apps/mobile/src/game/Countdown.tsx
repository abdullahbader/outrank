import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../icons';
import { color, radius } from '../theme';
import { Txt } from '../ui';
import type { LiveView } from '../useGame';

/** Seconds left on the game's countdown, using the server's clock (same on every phone). */
export function useSecondsLeft(view: LiveView, kind?: 'answer' | 'streak' | 'next'): number | null {
  const tm = view.timer;
  const [now, setNow] = useState(Date.now());
  const active = !!tm && (!kind || tm.kind === kind);
  useEffect(() => {
    if (!active || tm?.deadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active, tm?.deadline]);
  if (!tm || !active) return null;
  if (tm.deadline == null) return Math.ceil((tm.remainingMs ?? 0) / 1000); // paused: frozen
  const offset = view.clockOffset ?? 0;
  const total = Math.ceil(tm.totalMs / 1000);
  return Math.min(total, Math.max(0, Math.ceil((tm.deadline - (now + offset)) / 1000)));
}

export const timeTint = (secs: number) => (secs <= 5 ? color.bad : secs <= 10 ? color.gold : color.accent);

/** A pill with a clock and the seconds left; turns gold, then red, near the end. */
export function CountdownPill({ view, kind, big, light }: { view: LiveView; kind?: 'answer' | 'streak' | 'next'; big?: boolean; light?: boolean }) {
  const secs = useSecondsLeft(view, kind);
  if (secs === null) return null;
  const tint = light ? '#FFFFFF' : timeTint(secs);
  const fill = light ? (secs <= 5 ? color.bad : '#FFFFFF33') : tint + '1F';
  return (
    <View accessibilityRole="timer" accessibilityLabel={`${secs}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: big ? 12 : 9, height: big ? 46 : 30, borderRadius: radius.pill, backgroundColor: fill, borderWidth: light ? 0 : 1, borderColor: tint }}>
      <Icon name="timer-outline" size={big ? 22 : 15} color={tint} />
      <Txt v="number" color={tint} style={{ fontSize: big ? 22 : 14, lineHeight: big ? 28 : 18, minWidth: big ? 28 : 18, textAlign: 'center' }}>{secs}</Txt>
    </View>
  );
}

/** A thin bar that empties as time runs out. */
export function CountdownBar({ view, kind }: { view: LiveView; kind?: 'answer' | 'streak' | 'next' }) {
  const secs = useSecondsLeft(view, kind);
  if (secs === null) return null;
  const total = Math.max(1, Math.ceil((view.timer?.totalMs ?? 1000) / 1000));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: color.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, (secs / total) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: timeTint(secs) }} />
    </View>
  );
}
