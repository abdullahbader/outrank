import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DirectionRoot, useApp } from '../app-context';
import { color, radius, space } from '../theme';
import { Avatar, CountUp, IconButton, ltr, Row, Txt } from '../ui';
import type { LiveView } from '../useGame';
import { people } from './helpers';

/** Always on the gameplay screen: positions, totals, last-question change, cards left. */
export function LeaderStrip({ view }: { view: LiveView }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const p = people(view);
  const target = view.targetScore;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('game.leaderboard')} style={styles.strip}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space(2) }}>
          <Txt v="label" faint>{t('game.leaderboard')} · {t('game.target', { n: target })}</Txt>
          <Row gap={1}><Txt v="small" color={color.accent}>{t('game.seeAll')}</Txt><Feather name="chevron-up" size={16} color={color.accent} /></Row>
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {view.leaderboard.map((r) => (
            <View key={r.id} style={[styles.pill, r.id === view.me?.playerId ? { borderColor: color.accent } : null]}>
              <Txt v="small" faint>#{r.position}</Txt>
              <Avatar name={r.name} tint={p.tint(r.id)} size={24} dim={view.online[r.id] === false} />
              <Txt v="small" numberOfLines={1} style={{ maxWidth: 84 }}>{r.name}</Txt>
              <CountUp value={r.score} style={{ fontSize: 15 }} />
              {r.lastDelta ? <Txt v="small" color={r.lastDelta > 0 ? color.good : color.bad}>{ltr(r.lastDelta > 0 ? `+${r.lastDelta}` : r.lastDelta)}</Txt> : null}
            </View>
          ))}
        </ScrollView>
      </Pressable>
      <LeaderModal view={view} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function LeaderTable({ view }: { view: LiveView }) {
  const { t } = useApp();
  const p = people(view);
  const target = view.targetScore;
  const max = Math.max(target, ...view.leaderboard.map((r) => r.score));
  return (
    <View>
      {view.leaderboard.map((r) => (
        <View key={r.id} style={styles.row}>
          <Txt v="number" faint style={{ width: 28 }}>{r.position}</Txt>
          <Avatar name={r.name} tint={p.tint(r.id)} size={36} dim={view.online[r.id] === false} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt numberOfLines={1} style={{ flex: 1 }}>{r.name}{r.id === view.me?.playerId ? ` · ${t('common.you')}` : ''}</Txt>
              <CountUp value={r.score} style={{ fontSize: 18 }} />
            </Row>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, (r.score / max) * 100))}%`, backgroundColor: r.score >= target ? color.gold : color.accent }]} />
            </View>
            <Row gap={2}>
              <CardDot label={t('cards.wild')} tint={color.wild} used={r.wild === 'used'} armed={r.wild === 'armed'} />
              <CardDot label={t('cards.streak')} tint={color.streak} used={r.streak === 'used'} />
              {r.lastDelta ? <Txt v="small" color={r.lastDelta > 0 ? color.good : color.bad}>{ltr(r.lastDelta > 0 ? `+${r.lastDelta}` : r.lastDelta)}</Txt> : null}
              {view.online[r.id] === false ? <Txt v="small" faint>· {t('game.offline')}</Txt> : null}
            </Row>
          </View>
        </View>
      ))}
    </View>
  );
}

function CardDot({ label, tint, used, armed }: { label: string; tint: string; used: boolean; armed?: boolean }) {
  return (
    <View style={[styles.dot, { borderColor: tint, backgroundColor: armed ? tint : 'transparent', opacity: used ? 0.35 : 1 }]}>
      <Txt v="small" color={armed ? color.accentInk : tint} style={{ fontSize: 11, lineHeight: 14, textDecorationLine: used ? 'line-through' : 'none' }}>{label}</Txt>
    </View>
  );
}

function LeaderModal({ view, open, onClose }: { view: LiveView; open: boolean; onClose: () => void }) {
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <DirectionRoot>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space(4) }]}>
          <Row style={{ justifyContent: 'space-between', marginBottom: space(3) }}>
            <Txt v="h2">{t('game.leaderboard')}</Txt>
            <IconButton icon="x" label={t('common.close')} onPress={onClose} />
          </Row>
          <ScrollView><LeaderTable view={view} /></ScrollView>
        </View>
      </DirectionRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: color.bgRaised, borderTopWidth: 1, borderTopColor: color.line, paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(3) },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 40, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: color.line },
  track: { height: 6, borderRadius: 3, backgroundColor: color.surface2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  dot: { paddingHorizontal: 8, borderRadius: radius.pill, borderWidth: 1 },
  backdrop: { flex: 1, backgroundColor: '#17122F66' },
  sheet: { maxHeight: '80%', backgroundColor: color.bgRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(4), borderTopWidth: 1, borderColor: color.line },
});
