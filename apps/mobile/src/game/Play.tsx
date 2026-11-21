import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DirectionRoot, useApp, useLocalized } from '../app-context';
import { color, radius, space } from '../theme';
import { Avatar, Banner, Button, Card, Gap, IconButton, ltr, Pulse, Row, Txt } from '../ui';
import type { ActResult, ActionInput, LiveView } from '../useGame';
import { Board } from './Board';
import { people, turnStates } from './helpers';
import { LeaderStrip } from './Leaderboard';

type Act = (a: ActionInput) => Promise<ActResult>;

export const buzz = (kind: 'turn' | 'good' | 'bad') => {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'turn') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.notificationAsync(kind === 'good' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  } catch {}
};

/** The main gameplay screen (brief §10E). Same information for everyone; controls by role. */
export function Play({ view, act, onError, categoryName }: { view: LiveView; act: Act; onError: (c: string) => void; categoryName: string }) {
  const insets = useSafeAreaInsets();
  const host = view.role === 'host';
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (a: ActionInput) => {
    if (busy) return;
    setBusy(true);
    const r = await act(a);
    setBusy(false);
    if (!r.ok) onError(r.error);
  };

  // A gentle buzz when it becomes this phone's turn.
  const wasMine = useRef(false);
  useEffect(() => {
    const mine = !!view.me?.isMyTurn;
    if (mine && !wasMine.current) buzz('turn');
    wasMine.current = mine;
  }, [view.me?.isMyTurn]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingTop: insets.top + space(3), paddingBottom: space(6) }}>
        <View style={styles.max}>
          <QuestionHeader view={view} categoryName={categoryName} onMenu={host ? () => setMenu(true) : undefined} />
          <Gap h={4} />
          <TurnStrip view={view} />
          <Gap h={4} />
          {host ? <HostControls view={view} run={run} busy={busy} /> : <PlayerPanel view={view} run={run} busy={busy} />}
          <Gap h={4} />
          <Board view={view} onPick={host ? (rank) => run({ type: 'confirm', rank, turnSerial: view.turnSerial }) : undefined} disabled={busy || !view.round?.turn || view.round.turn.awaitingStreakDecision || view.paused} />
          <Gap h={5} />
          <AnswerFeed view={view} run={run} />
        </View>
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom }}><LeaderStrip view={view} /></View>
      {host ? <HostMenu view={view} open={menu} onClose={() => setMenu(false)} run={run} /> : null}
    </View>
  );
}

export function QuestionHeader({ view, categoryName, onMenu }: { view: LiveView; categoryName: string; onMenu?: () => void }) {
  const { t } = useApp();
  const L = useLocalized();
  const p = people(view);
  const r = view.round!;
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={2} style={{ flex: 1, flexWrap: 'wrap' }}>
          <View style={[styles.tag, r.isTiebreak ? { backgroundColor: color.gold } : null]}>
            <Txt v="label" color={r.isTiebreak ? color.accentInk : color.textDim}>{r.isTiebreak ? t('game.tiebreak') : t('game.question', { n: r.number })}</Txt>
          </View>
          <View style={styles.tag}><Txt v="label" color={color.streak}>{categoryName}</Txt></View>
          {view.endgame.triggered && !r.isTiebreak ? <View style={[styles.tag, { backgroundColor: color.wild }]}><Txt v="label" color={color.accentInk}>{t('game.finalQuestion')}</Txt></View> : null}
        </Row>
        {onMenu ? <IconButton icon="more-vertical" label={t('game.menu')} onPress={onMenu} /> : null}
      </Row>
      <Gap h={3} />
      <Txt v="title">{L(r.title)}</Txt>
      {r.rankingBasis ? <Txt v="small" dim style={{ marginTop: space(1) }}>{L(r.rankingBasis)}{r.asOf ? ` · ${t('game.asOf', { date: r.asOf })}` : ''}</Txt> : null}
      {r.isTiebreak ? <Txt v="small" color={color.gold} style={{ marginTop: space(1) }}>{t('game.tiebreakPlayers', { names: p.list(r.participants) })}</Txt> : null}
    </View>
  );
}

function TurnStrip({ view }: { view: LiveView }) {
  const { t } = useApp();
  const p = people(view);
  const states = turnStates(view);
  const r = view.round!;
  const current = r.turn?.playerId ?? null;
  const nextId = r.participants[r.turnIndex + 1] ?? null;
  return (
    <Card style={{ padding: space(3) }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space(2) }}>
        <Txt v="h2" numberOfLines={1} style={{ flex: 1 }}>{current ? (current === view.me?.playerId ? t('game.yourTurn') : t('game.turn', { name: p.name(current) })) : t('game.done')}</Txt>
        <Txt v="small" faint>{t('game.claimed', { n: r.claimedCount })}</Txt>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2), paddingVertical: 2 }}>
        {states.map((s) => (
          <View key={s.id} style={{ alignItems: 'center', width: 52 }}>
            <View>
              <Avatar name={p.name(s.id)} tint={p.tint(s.id)} size={40} ring={s.status === 'current' ? color.accent : undefined} dim={s.status === 'scored' || s.status === 'missed'} />
              {s.status === 'scored' || s.status === 'missed' ? (
                <View style={[styles.badge, { backgroundColor: s.status === 'scored' ? color.good : color.bad }]}>
                  <Feather name={s.status === 'scored' ? 'check' : 'x'} size={10} color={color.accentInk} />
                </View>
              ) : null}
              {view.online[s.id] === false ? <View style={[styles.badge, { backgroundColor: color.textFaint, top: -2, bottom: undefined }]}><Feather name="wifi-off" size={9} color={color.bg} /></View> : null}
            </View>
            <Txt v="small" numberOfLines={1} dim={s.status !== 'current'} style={{ fontSize: 11, marginTop: 2 }}>{p.name(s.id)}</Txt>
          </View>
        ))}
      </ScrollView>
      {nextId ? <Txt v="small" faint style={{ marginTop: space(1) }}>{t('game.next', { name: p.name(nextId) })}</Txt> : null}
    </Card>
  );
}

function HostControls({ view, run, busy }: { view: LiveView; run: (a: ActionInput) => void; busy: boolean }) {
  const { t } = useApp();
  const p = people(view);
  const turn = view.round?.turn;
  if (!turn) return null;
  const name = p.name(turn.playerId);
  const wildOn = view.leaderboard.find((r) => r.id === turn.playerId)?.wild === 'armed';
  if (turn.awaitingStreakDecision) {
    return (
      <Card glow={color.streak}>
        <Txt>{t('game.streakOffered', { name })}</Txt>
        <Gap h={3} />
        <Button label={t('game.nextPlayer')} icon="skip-forward" kind="streak" busy={busy} onPress={() => run({ type: 'end_turn', turnSerial: view.turnSerial })} />
      </Card>
    );
  }
  return (
    <View>
      {turn.attemptNo === 2 ? <><Banner tone="info" icon="repeat" text={t('game.secondAttempt')} /><Gap h={2} /></> : null}
      {wildOn ? <><Banner tone="warn" icon="zap" text={`${name}: ${t('cards.wildOn')} (×${view.wildMultiplier})`} /><Gap h={2} /></> : null}
      <Txt v="small" dim>{t('game.tapRank')}</Txt>
      <Gap h={2} />
      <Row gap={2}>
        <Button label={t('game.wrong')} icon="x" kind="danger" style={{ flex: 1 }} busy={busy} onPress={() => run({ type: 'reject', reason: 'incorrect', turnSerial: view.turnSerial })} />
        <Button label={t('game.alreadyClaimed')} icon="copy" kind="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => run({ type: 'reject', reason: 'already_claimed', turnSerial: view.turnSerial })} />
      </Row>
      {view.online[turn.playerId] === false ? (
        <><Gap h={2} /><Button label={`${t('game.skip')} · ${name}`} icon="user-x" kind="ghost" size="sm" disabled={busy} onPress={() => run({ type: 'skip_turn', turnSerial: view.turnSerial })} /></>
      ) : null}
    </View>
  );
}

function PlayerPanel({ view, run, busy }: { view: LiveView; run: (a: ActionInput) => void; busy: boolean }) {
  const { t } = useApp();
  const me = view.me;
  if (!me) return null;
  const turn = view.round?.turn;
  const mine = me.isMyTurn && !!turn;
  return (
    <View>
      {mine ? (
        <Pulse active={!turn!.awaitingStreakDecision}>
          <Card glow={color.accent}>
            <Txt v="h2" color={color.accent}>
              {turn!.awaitingStreakDecision ? t('game.streakOfferedMe') : turn!.attemptNo === 2 ? t('game.secondAttemptMe') : t('game.yourTurn')}
            </Txt>
            {turn!.awaitingStreakDecision ? (
              <>
                <Gap h={3} />
                <Row gap={2}>
                  <Button label={t('game.useStreak')} icon="repeat" kind="streak" style={{ flex: 1 }} busy={busy} disabled={!me.canActivateStreak} onPress={() => run({ type: 'activate_streak', turnSerial: view.turnSerial })} />
                  <Button label={t('game.finishTurn')} kind="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => run({ type: 'end_turn', turnSerial: view.turnSerial })} />
                </Row>
              </>
            ) : null}
          </Card>
        </Pulse>
      ) : null}
      <Gap h={3} />
      <Row gap={3}>
        <GameCard
          title={t('cards.wild')} effect={t('cards.wildEffect')} tint={color.wild} icon="zap" state={me.wild}
          canUse={me.canActivateWild} busy={busy} onUse={() => run({ type: 'activate_wild', turnSerial: view.turnSerial })}
        />
        <GameCard
          title={t('cards.streak')} effect={t('cards.streakEffect')} tint={color.streak} icon="repeat" state={me.streak}
          canUse={me.canActivateStreak} busy={busy} onUse={() => run({ type: 'activate_streak', turnSerial: view.turnSerial })}
        />
      </Row>
    </View>
  );
}

function GameCard({ title, effect, tint, icon, state, canUse, onUse, busy }: {
  title: string; effect: string; tint: string; icon: 'zap' | 'repeat'; state: 'available' | 'armed' | 'used'; canUse: boolean; onUse: () => void; busy: boolean;
}) {
  const { t } = useApp();
  const used = state === 'used';
  const armed = state === 'armed';
  return (
    <View style={[styles.gameCard, { borderColor: tint, backgroundColor: armed ? tint : tint + '14', opacity: used ? 0.4 : 1 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Feather name={icon} size={22} color={armed ? color.accentInk : tint} />
        <Txt v="label" color={armed ? color.accentInk : tint}>{used ? t('cards.used') : armed ? t('cards.armed') : t('cards.available')}</Txt>
      </Row>
      <Txt v="h2" color={armed ? color.accentInk : color.text} style={{ marginTop: space(2) }}>{title}</Txt>
      <Txt v="small" color={armed ? color.accentInk : color.textDim} numberOfLines={3}>{effect}</Txt>
      {!used && !armed ? (
        <Pressable disabled={!canUse || busy} onPress={onUse} accessibilityRole="button" accessibilityLabel={`${t('cards.activate')} ${title}`}
          style={({ pressed }) => [styles.cardBtn, { backgroundColor: canUse ? tint : 'transparent', borderColor: tint, opacity: pressed ? 0.8 : 1 }]}>
          <Txt v="small" color={canUse ? color.accentInk : color.textFaint}>{canUse ? t('cards.activate') : t('cards.onlyYourTurn')}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Every answer of this question, newest first. The host can undo from here. */
export function AnswerFeed({ view, run }: { view: LiveView; run: (a: ActionInput) => void }) {
  const { t } = useApp();
  const L = useLocalized();
  const p = people(view);
  const [undo, setUndo] = useState<string | null>(null);
  const r = view.round!;
  const list = [...r.attempts].reverse();
  const latestValid = [...r.attempts].reverse().find((a) => !a.voided)?.id;
  if (!list.length) return null;
  const target = list.find((a) => a.id === undo);
  return (
    <View>
      {list.map((a) => {
        const tone = a.voided ? color.textFaint : a.outcome === 'correct' ? (a.cancelledByStreak ? color.bad : a.points < 0 ? color.bad : color.good) : color.bad;
        const label = a.outcome === 'correct'
          ? t('feed.correct', { name: p.name(a.playerId), rank: a.rank ?? '?', answer: a.text ? L(a.text) : '' })
          : a.outcome === 'skipped' ? t('feed.skipped', { name: p.name(a.playerId) })
          : a.outcome === 'already_claimed' ? t('feed.claimed', { name: p.name(a.playerId) })
          : t('feed.wrong', { name: p.name(a.playerId) });
        return (
          <Row key={a.id} gap={3} style={[styles.feedRow, a.voided ? { opacity: 0.45 } : null]}>
            <Avatar name={p.name(a.playerId)} tint={p.tint(a.playerId)} size={28} />
            <View style={{ flex: 1 }}>
              <Txt v="small" style={a.voided || a.cancelledByStreak ? { textDecorationLine: 'line-through' } : null} numberOfLines={2}>{label}</Txt>
              {a.usedWild || a.usedStreak ? (
                <Row gap={2}>
                  {a.usedWild ? <Txt v="small" color={color.wild}>{t('cards.wild')} {ltr(`×${a.multiplier}`)}</Txt> : null}
                  {a.usedStreak ? <Txt v="small" color={color.streak}>{t('cards.streak')}</Txt> : null}
                </Row>
              ) : null}
            </View>
            {a.outcome === 'correct' ? <Txt v="number" color={tone} style={{ fontSize: 15 }}>{ltr(a.points > 0 ? `+${a.points}` : a.points)}</Txt> : <Feather name="x" size={16} color={tone} />}
            {view.role === 'host' && !a.voided ? (
              <Pressable onPress={() => setUndo(a.id)} accessibilityRole="button" accessibilityLabel={t('game.undo')} hitSlop={8} style={styles.undo}>
                <Feather name="rotate-ccw" size={14} color={color.textDim} />
              </Pressable>
            ) : null}
          </Row>
        );
      })}
      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setUndo(null)}>
        <DirectionRoot>
          <Pressable style={styles.backdrop} onPress={() => setUndo(null)}>
            <Pressable style={styles.dialog} onPress={() => {}}>
              <Txt v="h2">{t('game.undoTitle', { name: target ? p.name(target.playerId) : '' })}</Txt>
              <Gap h={4} />
              {target && target.id === latestValid ? (
                <><Button label={t('game.undoReplay')} icon="rotate-ccw" onPress={() => { run({ type: 'void_attempt', attemptId: target.id, replayTurn: true }); setUndo(null); }} /><Gap h={2} /></>
              ) : null}
              <Button label={t('game.undoKeep')} kind="secondary" onPress={() => { if (target) run({ type: 'void_attempt', attemptId: target.id, replayTurn: false }); setUndo(null); }} />
              <Gap h={2} />
              <Button label={t('common.cancel')} kind="ghost" onPress={() => setUndo(null)} />
            </Pressable>
          </Pressable>
        </DirectionRoot>
      </Modal>
    </View>
  );
}

function HostMenu({ view, open, onClose, run }: { view: LiveView; open: boolean; onClose: () => void; run: (a: ActionInput) => void }) {
  const { t } = useApp();
  const [confirmEnd, setConfirmEnd] = useState(false);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <DirectionRoot>
        <Pressable style={styles.backdrop} onPress={() => { setConfirmEnd(false); onClose(); }}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Txt v="h2">{t('game.menu')}</Txt>
            <Gap h={4} />
            {view.paused
              ? <Button label={t('game.resume')} icon="play" onPress={() => { run({ type: 'resume' }); onClose(); }} />
              : <Button label={t('game.pause')} icon="pause" kind="secondary" onPress={() => { run({ type: 'pause' }); onClose(); }} />}
            <Gap h={2} />
            {view.round?.turn && !view.round.turn.awaitingStreakDecision ? (
              <><Button label={t('game.skip')} icon="user-x" kind="secondary" onPress={() => { run({ type: 'skip_turn', turnSerial: view.turnSerial }); onClose(); }} /><Gap h={2} /></>
            ) : null}
            {confirmEnd ? (
              <>
                <Txt v="small" dim>{t('game.endConfirm')}</Txt>
                <Gap h={2} />
                <Button label={t('game.end')} icon="flag" kind="danger" onPress={() => { run({ type: 'end_game' }); setConfirmEnd(false); onClose(); }} />
              </>
            ) : <Button label={t('game.end')} icon="flag" kind="ghost" onPress={() => setConfirmEnd(true)} />}
            <Gap h={2} />
            <Button label={t('common.close')} kind="ghost" onPress={() => { setConfirmEnd(false); onClose(); }} />
          </Pressable>
        </Pressable>
      </DirectionRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  max: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color.surface },
  badge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gameCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, padding: space(3), minHeight: 150 },
  cardBtn: { marginTop: 'auto', height: 34, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  feedRow: { paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: color.line },
  undo: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  backdrop: { flex: 1, backgroundColor: '#000b', alignItems: 'center', justifyContent: 'center', padding: space(4) },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: color.bgRaised, borderRadius: radius.xl, padding: space(5), borderWidth: 1, borderColor: color.line },
});
