import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useApp, useLocalized } from '../app-context';
import { color, radius, rankColor, space } from '../theme';
import { Avatar, ltr, Pop, Row, Txt } from '../ui';
import type { LiveView } from '../useGame';
import { people } from './helpers';

const pts = (n: number) => ltr(n > 0 ? `+${n}` : `${n}`);

/**
 * The 12 ranked answers. Host: every answer visible, unclaimed ones are one-tap buttons (no
 * confirmation dialog, brief §10F). Players: only claimed answers are visible.
 */
export function Board({ view, onPick, disabled }: { view: LiveView; onPick?: (rank: number) => void; disabled?: boolean }) {
  const { t } = useApp();
  const L = useLocalized();
  const p = people(view);
  const round = view.round!;
  const host = view.role === 'host';
  return (
    <View style={{ gap: space(2) }}>
      {round.slots.map((s) => {
        const claimed = !!s.claimedBy;
        const tappable = host && !claimed && !!onPick && !disabled && !round.finished;
        const tint = rankColor(s.rank);
        const text = s.text ? L(s.text) : null;
        return (
          <Pressable
            key={s.rank}
            disabled={!tappable}
            onPress={() => onPick?.(s.rank)}
            accessibilityRole={tappable ? 'button' : 'text'}
            accessibilityLabel={`#${s.rank} ${text ?? t('game.hidden')} ${pts(s.points)}`}
            style={({ pressed }) => [
              styles.slot,
              claimed ? { backgroundColor: color.surface2, borderColor: tint + '88' } : null,
              host && !claimed && !round.finished ? { borderColor: color.line, borderStyle: 'dashed' } : null,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={[styles.rank, { backgroundColor: claimed || round.finished ? tint : 'transparent', borderColor: tint }]}>
              <Txt v="number" color={claimed || round.finished ? color.accentInk : tint} style={{ fontSize: 15 }}>{s.rank}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              {text ? (
                <Pop trigger={s.claimedBy}>
                  <Txt numberOfLines={2} color={claimed || host ? color.text : color.textDim} style={!claimed && round.finished ? { opacity: 0.6 } : null}>{text}</Txt>
                </Pop>
              ) : (
                <Row gap={1}><Feather name="lock" size={13} color={color.textFaint} /><Txt v="small" faint>{t('game.hidden')}</Txt></Row>
              )}
              {host && !claimed && s.aliases?.length ? <Txt v="small" faint numberOfLines={1}>{s.aliases.join(' · ')}</Txt> : null}
              {s.valueNote && (claimed || host || round.finished) ? <Txt v="small" faint numberOfLines={1}>{ltr(s.valueNote)}</Txt> : null}
            </View>
            {claimed ? <Avatar name={p.name(s.claimedBy)} tint={p.tint(s.claimedBy!)} size={28} /> : round.finished ? <Txt v="small" faint>{t('results.unclaimed')}</Txt> : null}
            <Txt v="number" color={tint} style={{ minWidth: 40, textAlign: 'right', fontSize: 15 }}>{pts(s.points)}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surface },
  rank: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
