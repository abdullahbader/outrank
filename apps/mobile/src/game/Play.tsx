import { Icon as Feather } from '../icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DirectionRoot, useApp, useLocalized } from '../app-context';
import { catStyle, color, inkOn, radius, rankColor as rankColorOf, space } from '../theme';
import { api } from '../api';
import { Avatar, Banner, Button, Card, Gap, Gradient, IconButton, IconPlate, ltr, Pulse, Row, Txt, useReducedMotion, CountUp } from '../ui';
import type { ActResult, ActionInput, LiveView } from '../useGame';
import { Board } from './Board';
import { CountdownBar, CountdownPill } from './Countdown';
import { useCountdownSound, useSoundSetting } from './sound';
import { has3D, Icon3D } from '../icons3d';
import { CategoryPhoto } from '../photos';
import { people, turnStates } from './helpers';

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
  const sound = useSoundSetting();
  useCountdownSound(view, sound.on);

  const run = async (a: ActionInput) => {
    if (busy) return;
    setBusy(true);
    const r = await act(a);
    setBusy(false);
    if (!r.ok) onError(r.error);
  };

  // A buzz and the answer pop-up when it becomes this phone's turn (again for a Streak extra answer).
  const myTurn = !!view.me?.isMyTurn;
  const answering = myTurn && !view.round?.turn?.awaitingStreakDecision;
  const attemptKey = answering ? `${view.turnSerial}` : '';
  const [popup, setPopup] = useState(false);
  const lastKey = useRef('');
  useEffect(() => {
    if (attemptKey && attemptKey !== lastKey.current) {
      if (!lastKey.current || view.round?.turn?.attemptNo === 1) buzz('turn');
      setPopup(true);
    }
    if (!attemptKey) setPopup(false);
    lastKey.current = attemptKey;
  }, [attemptKey]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {myTurn ? <MyTurnBar view={view} top={insets.top} onType={answering && !popup ? () => setPopup(true) : undefined} /> : null}
      <ScrollView contentContainerStyle={{ padding: space(4), paddingTop: myTurn ? space(4) : insets.top + space(3), paddingBottom: space(20) }}>
        <View style={styles.max}>
          <QuestionHeader view={view} categoryName={categoryName} onMenu={host ? () => setMenu(true) : undefined} sound={sound} />
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
      {host ? <HostMenu view={view} open={menu} onClose={() => setMenu(false)} run={run} /> : null}
      {popup && answering ? <AnswerPopup view={view} act={act} onError={onError} onHide={() => setPopup(false)} /> : null}
    </View>
  );
}

/** Pinned to the top for as long as it is your turn: impossible to miss. */
function MyTurnBar({ view, top, onType }: { view: LiveView; top: number; onType?: () => void }) {
  const { t } = useApp();
  const turn = view.round?.turn;
  const title = turn?.awaitingStreakDecision ? t('game.streakOfferedMe') : turn?.attemptNo === 2 ? t('game.secondAttempt') : t('game.yourTurnBig');
  const sub = turn?.awaitingStreakDecision ? '' : turn?.attemptNo === 2 ? t('game.secondAttemptMe') : t('game.yourTurnSub');
  return (
    <Pulse active={!turn?.awaitingStreakDecision}>
      <View style={[styles.turnBar, { paddingTop: top + space(3) }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <View style={styles.turnBarIcon}><Icon3D name="microphone" size={38} /></View>
        <View style={{ flex: 1 }}>
          <Txt v="title" color="#FFFFFF" style={{ fontSize: 24 }}>{title}</Txt>
          {sub ? <Txt v="small" color="#FFFFFFE6">{sub}</Txt> : null}
          {onType ? (
            <Pressable onPress={onType} accessibilityRole="button" style={styles.typeAgain}>
              <Feather name="pencil" size={14} color={color.accent} />
              <Txt v="small" color={color.accent}>{view.round?.turn?.typed ? t('answer.edit') : t('answer.open')}</Txt>
            </Pressable>
          ) : null}
        </View>
        <CountdownPill view={view} big light />
      </View>
    </Pulse>
  );
}

/**
 * Opens by itself when your turn starts: type the answer you are giving (and say it out loud).
 * The host sees it with the likely match and rules on it. You can change it until the host does.
 */
function AnswerPopup({ view, act, onError, onHide }: { view: LiveView; act: Act; onError: (c: string) => void; onHide: () => void }) {
  const { t, locale } = useApp();
  const reduced = useReducedMotion();
  const turn = view.round!.turn!;
  const [text, setText] = useState(turn.typed ?? '');
  const [busy, setBusy] = useState(false);
  const sent = !!turn.typed && turn.typed === text.trim();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!reduced) Animated.spring(v, { toValue: 1, friction: 7, tension: 80, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [v, reduced]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const me = view.players.find((p) => p.id === view.me?.playerId);

  const send = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const r = await act({ type: 'submit_answer', text: value, turnSerial: view.turnSerial });
    setBusy(false);
    if (!r.ok) onError(r.error);
  };

  return (
    <View style={styles.popupBack}>
      <Animated.View style={[styles.popupCard, { opacity: v, transform: [{ scale }] }]}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Row gap={3} style={{ flex: 1 }}>
            <Avatar name={me?.name ?? ''} tint={me?.color ?? color.accent} emoji={me?.emoji ?? undefined} size={52} ring={color.gold} />
            <View style={{ flex: 1 }}>
              <Txt v="title" color={color.accent}>{turn.attemptNo === 2 ? t('game.secondAttempt') : t('game.yourTurnBig')}</Txt>
              <Txt v="small" dim>{t('answer.hint')}</Txt>
            </View>
          </Row>
          <CountdownPill view={view} />
        </Row>
        <Gap h={4} />
        <TextInput
          value={text} onChangeText={(x) => setText(x.slice(0, 80))} autoFocus maxLength={80}
          placeholder={t('answer.placeholder')} placeholderTextColor={color.textFaint}
          onSubmitEditing={send} returnKeyType="send" accessibilityLabel={t('answer.placeholder')}
          style={[styles.answerInput, { textAlign: locale === 'ar' ? 'right' : 'left' }]}
        />
        <Gap h={3} />
        {sent ? (
          <Banner tone="good" icon="check-circle" text={t('answer.sent', { text: turn.typed ?? '' })} />
        ) : (
          <Button label={t('answer.send')} icon="send" size="lg" busy={busy} disabled={!text.trim()} onPress={send} />
        )}
        <Gap h={2} />
        <Button label={t('answer.hide')} kind="ghost" size="sm" onPress={onHide} />
      </Animated.View>
    </View>
  );
}

export function QuestionHeader({ view, categoryName, onMenu, sound }: { view: LiveView; categoryName: string; onMenu?: () => void; sound?: { on: boolean; toggle: () => void } }) {
  const { t } = useApp();
  const L = useLocalized();
  const p = people(view);
  const r = view.round!;
  const st = catStyle(r.categoryId);
  const me = view.me ? view.leaderboard.find((x) => x.id === view.me!.playerId) : null;
  return (
    <CategoryPhoto category={r.categoryId} radius={radius.xl} faded style={{ borderWidth: 1, borderColor: st.tint + '55', backgroundColor: color.surface }}>
      <View style={{ padding: space(4) }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={2} style={{ flex: 1, flexWrap: 'wrap' }}>
            <IconPlate icon={st.icon as never} img={r.categoryId} tint={st.tint} size={40} solid />
            <View style={[styles.tag, r.isTiebreak ? { backgroundColor: color.gold } : null]}>
              <Txt v="label" color={r.isTiebreak ? inkOn(color.gold) : color.text}>{r.isTiebreak ? t('game.tiebreak') : t('game.question', { n: r.number })}</Txt>
            </View>
            <View style={styles.tag}><Txt v="label" color={st.tint}>{categoryName}</Txt></View>
            {view.endgame.triggered && !r.isTiebreak ? <View style={[styles.tag, { backgroundColor: color.wild }]}><Txt v="label" color={color.accentInk}>{t('game.finalQuestion')}</Txt></View> : null}
          </Row>
          {me ? (
            <View style={styles.myScore}>
              <Txt v="small" faint style={{ fontSize: 11 }}>{t('common.you')}</Txt>
              <Txt v="number" color={color.accent}>{me.score}</Txt>
            </View>
          ) : null}
          {sound ? <IconButton icon={sound.on ? 'volume-high' : 'volume-off'} label={sound.on ? t('game.soundOff') : t('game.soundOn')} onPress={sound.toggle} tint={sound.on ? color.accent : color.textFaint} bg={color.bg + 'AA'} /> : null}
          {onMenu ? <IconButton icon="more-vertical" label={t('game.menu')} onPress={onMenu} /> : null}
        </Row>
        <Gap h={3} />
        <Txt v="title">{L(r.title)}</Txt>
        {r.rankingBasis ? <Txt v="small" dim style={{ marginTop: space(1) }}>{L(r.rankingBasis)}{r.asOf ? ` · ${t('game.asOf', { date: r.asOf })}` : ''}</Txt> : null}
        {r.isTiebreak ? <Txt v="small" color={color.gold} style={{ marginTop: space(1) }}>{t('game.tiebreakPlayers', { names: p.list(r.participants) })}</Txt> : null}
        <Gap h={3} />
        {/* ten segments: one per positive answer still to find */}
        <Row gap={1}>
          {Array.from({ length: 10 }, (_, i) => {
            const found = !!r.slots[i]?.claimedBy;
            return <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: found ? (i === 9 ? color.gold : st.tint) : color.surface2 }} />;
          })}
        </Row>
      </View>
    </CategoryPhoto>
  );
}

/** Small leaderboard position on top of a player's picture (gold for 1st). */
const MEDAL: Record<number, string> = { 1: '#E8C66A', 2: '#B8C4C9', 3: '#D49A6A' };

function RankBadge({ view, id }: { view: LiveView; id: string }) {
  const row = view.leaderboard.find((r) => r.id === id);
  if (!row) return null;
  const medal = MEDAL[row.position];
  return (
    <View style={[styles.rankBadge, { backgroundColor: medal ?? color.text }]} accessibilityLabel={`#${row.position}`}>
      <Txt v="number" color={medal ? inkOn(medal) : '#FFFFFF'} style={{ fontSize: 11, lineHeight: 14 }}>{row.position}</Txt>
    </View>
  );
}

/** Total points in a pill under the picture; a "+7" / "−11" floats up whenever it changes. */
function ScorePill({ view, id }: { view: LiveView; id: string }) {
  const reduced = useReducedMotion();
  const score = view.leaderboard.find((r) => r.id === id)?.score ?? 0;
  const prev = useRef(score);
  const [delta, setDelta] = useState<{ key: number; n: number } | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const d = score - prev.current;
    prev.current = score;
    if (!d) return;
    setDelta((old) => ({ key: (old?.key ?? 0) + 1, n: d }));
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: reduced ? 1200 : 1600, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(() => setDelta(null));
  }, [score, v, reduced]);
  const y = v.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -34] });
  const o = v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const tone = score < 0 ? color.bad : color.text;
  return (
    <View style={styles.scoreWrap}>
      <View style={[styles.scorePill, { borderColor: score < 0 ? color.bad : color.line }]}>
        <CountUp value={score} style={{ fontSize: 13, lineHeight: 16, color: tone }} />
      </View>
      {delta ? (
        <Animated.View pointerEvents="none" style={[styles.deltaFloat, { opacity: o, transform: [{ translateY: y }] }]}>
          <Txt v="number" color={delta.n > 0 ? color.good : color.bad} style={{ fontSize: 15, lineHeight: 18 }}>{ltr(delta.n > 0 ? `+${delta.n}` : `${delta.n}`)}</Txt>
        </Animated.View>
      ) : null}
    </View>
  );
}

function TurnStrip({ view }: { view: LiveView }) {
  const { t } = useApp();
  const p = people(view);
  const states = turnStates(view);
  const r = view.round!;
  const current = r.turn?.playerId ?? null;
  const nextId = r.nextPlayerId;
  return (
    <Card style={{ padding: space(3) }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space(2) }}>
        <Txt v="h2" numberOfLines={1} style={{ flex: 1 }}>{current ? (current === view.me?.playerId ? t('game.yourTurn') : t('game.turn', { name: p.name(current) })) : t('game.done')}</Txt>
        <CountdownPill view={view} />
      </Row>
      <CountdownBar view={view} />
      <Gap h={2} />
      <Txt v="small" faint style={{ marginBottom: space(1) }}>{t('game.positivesLeft', { n: r.positivesLeft })} · {t('game.lap', { n: r.lap })}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2), paddingVertical: 2 }}>
        {states.map((s) => (
          <View key={s.id} style={{ alignItems: 'center', width: 58 }}>
            <View style={{ alignItems: 'center' }}>
              <Avatar name={p.name(s.id)} tint={p.tint(s.id)} emoji={p.emoji(s.id)} size={46} ring={s.status === 'current' ? color.accent : undefined} dim={s.status === 'scored' || s.status === 'missed'} />
              <RankBadge view={view} id={s.id} />
              <ScorePill view={view} id={s.id} />
              {s.status === 'scored' || s.status === 'missed' ? (
                <View style={[styles.badge, { backgroundColor: s.status === 'scored' ? color.good : color.bad }]}>
                  <Feather name={s.status === 'scored' ? 'check' : 'x'} size={10} color={color.accentInk} />
                </View>
              ) : null}
              {view.online[s.id] === false ? <View style={[styles.badge, { backgroundColor: color.textFaint, top: -2, bottom: undefined }]}><Feather name="wifi-off" size={9} color={color.bg} /></View> : null}
            </View>
            <Txt v="small" numberOfLines={1} dim={s.status !== 'current'} style={{ fontSize: 11, marginTop: 4 }}>{p.name(s.id)}</Txt>
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
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt style={{ flex: 1 }}>{t('game.streakOffered', { name })}</Txt>
          <CountdownPill view={view} kind="streak" />
        </Row>
        <Gap h={3} />
        <Button label={t('game.nextPlayer')} icon="skip-forward" kind="streak" busy={busy} onPress={() => run({ type: 'end_turn', turnSerial: view.turnSerial })} />
        <Gap h={2} />
        <EndQuestion run={run} busy={busy} />
      </Card>
    );
  }
  return (
    <View>
      {turn.attemptNo === 2 ? <><Banner tone="info" icon="repeat" text={t('game.secondAttempt')} /><Gap h={2} /></> : null}
      {wildOn ? <><Banner tone="warn" icon="zap" text={`${name}: ${t('cards.wildOn')} (×${view.wildMultiplier})`} /><Gap h={2} /></> : null}
      {turn.typed ? <TypedCard view={view} run={run} busy={busy} /> : null}
      <Txt v="small" dim>{t('game.tapRank')}</Txt>
      <Gap h={2} />
      <Row gap={2}>
        <Button label={t('game.wrong')} icon="x" kind="danger" style={{ flex: 1 }} busy={busy} onPress={() => run({ type: 'reject', reason: 'incorrect', turnSerial: view.turnSerial })} />
        <Button label={t('game.pass')} icon="skip-forward" kind="streak" style={{ flex: 1 }} disabled={busy} onPress={() => run({ type: 'reject', reason: 'pass', turnSerial: view.turnSerial })} />
      </Row>
      {view.round!.claimedCount > 0 ? (
        <>
          <Gap h={2} />
          <Button label={t('game.alreadyClaimed')} icon="copy" kind="secondary" size="sm" disabled={busy} onPress={() => run({ type: 'reject', reason: 'already_claimed', turnSerial: view.turnSerial })} />
        </>
      ) : null}
      <Gap h={2} />
      <EndQuestion run={run} busy={busy} />
      {view.online[turn.playerId] === false ? (
        <><Gap h={2} /><Button label={`${t('game.skip')} · ${name}`} icon="user-x" kind="ghost" size="sm" disabled={busy} onPress={() => run({ type: 'skip_turn', turnSerial: view.turnSerial })} /></>
      ) : null}
    </View>
  );
}

/** The host can end (skip) the question at any time. Two taps, so it is never hit by accident. */
function EndQuestion({ run, busy }: { run: (a: ActionInput) => void; busy: boolean }) {
  const { t } = useApp();
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const id = setTimeout(() => setSure(false), 4000); return () => clearTimeout(id); }, [sure]);
  return (
    <Button
      label={sure ? t('game.endQuestionSure') : t('game.endQuestion')}
      icon="fast-forward" kind={sure ? 'gold' : 'ghost'} size="sm" disabled={busy}
      onPress={() => { if (sure) { setSure(false); run({ type: 'end_question' }); } else setSure(true); }}
    />
  );
}

/** Host: the answer the player typed, and a one-tap confirm when it matches one on the list. */
function TypedCard({ view, run, busy }: { view: LiveView; run: (a: ActionInput) => void; busy: boolean }) {
  const { t } = useApp();
  const L = useLocalized();
  const p = people(view);
  const r = view.round!;
  const turn = r.turn!;
  const slot = r.suggestedRank ? r.slots.find((x) => x.rank === r.suggestedRank) : null;
  return (
    <Card glow={color.gold} style={{ marginBottom: space(3) }}>
      <Row gap={2}>
        <Feather name="pencil" size={18} color={color.gold} />
        <Txt v="small" dim>{t('answer.typedBy', { name: p.name(turn.playerId) })}</Txt>
      </Row>
      <Txt v="title" auto style={{ marginTop: space(1) }}>“{turn.typed}”</Txt>
      {slot ? (
        <>
          <Gap h={3} />
          {slot.claimedBy ? (
            <Button label={t('answer.matchClaimed', { rank: slot.rank })} icon="copy" kind="secondary" disabled={busy}
              onPress={() => run({ type: 'reject', reason: 'already_claimed', turnSerial: view.turnSerial })} />
          ) : (
            <Button label={t('answer.confirmMatch', { rank: slot.rank, answer: L(slot.text) })} icon="check" size="lg" busy={busy}
              onPress={() => run({ type: 'confirm', rank: slot.rank, turnSerial: view.turnSerial })} />
          )}
        </>
      ) : <Txt v="small" faint style={{ marginTop: space(1) }}>{t('answer.noMatch')}</Txt>}
    </Card>
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
      {mine && view.practice && !turn!.awaitingStreakDecision ? <PracticeHost view={view} /> : null}
      <Gap h={3} />
      <Row gap={3}>
        <GameCard
          title={t('cards.wild')} effect={t('cards.wildEffect')} tint={color.wild} icon="wild" state={me.wild}
          canUse={me.canActivateWild} busy={busy} onUse={() => run({ type: 'activate_wild', turnSerial: view.turnSerial })}
        />
        <GameCard
          title={t('cards.streak')} effect={t('cards.streakEffect')} tint={color.streak} icon="streak" state={me.streak}
          canUse={me.canActivateStreak} busy={busy} onUse={() => run({ type: 'activate_streak', turnSerial: view.turnSerial })}
        />
      </Row>
    </View>
  );
}

/** Practice games only: you rule on your own answer, as the host would. */
function PracticeHost({ view }: { view: LiveView }) {
  const { t, errorText } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const r = view.round!;
  const send = async (action: ActionInput) => {
    setBusy(true);
    setMsg(null);
    try { const res = await api<{ ok: boolean; error?: string }>('POST', `/dev/games/${view.gameId}/host-act`, action); if (!res.ok && res.error) setMsg(errorText(res.error)); }
    catch (e) { setMsg(errorText(e)); }
    setBusy(false);
  };
  return (
    <Card style={{ marginTop: space(3), borderStyle: 'dashed', borderColor: color.streak }}>
      <Txt v="label" color={color.streak}>{t('practice.panel')}</Txt>
      <Txt v="small" dim>{t('practice.panelHint')}</Txt>
      <Gap h={3} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {r.slots.map((s) => {
          const taken = !!s.claimedBy;
          return (
            <Pressable key={s.rank} disabled={taken || busy} onPress={() => send({ type: 'confirm', rank: s.rank, turnSerial: view.turnSerial })}
              accessibilityRole="button" accessibilityLabel={`#${s.rank}`}
              style={({ pressed }) => ({ width: 46, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: taken ? color.surface2 : rankColorOf(s.rank) + '22', borderWidth: 1, borderColor: taken ? color.line : rankColorOf(s.rank), opacity: taken ? 0.4 : pressed ? 0.7 : 1 })}>
              <Txt v="number" style={{ fontSize: 15 }} color={taken ? color.textFaint : rankColorOf(s.rank)}>{s.rank}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Gap h={3} />
      <Row gap={2}>
        <Button label={t('game.wrong')} icon="x" kind="danger" size="sm" style={{ flex: 1 }} disabled={busy} onPress={() => send({ type: 'reject', reason: 'incorrect', turnSerial: view.turnSerial })} />
        <Button label={t('game.pass')} icon="skip-forward" kind="streak" size="sm" style={{ flex: 1 }} disabled={busy} onPress={() => send({ type: 'reject', reason: 'pass', turnSerial: view.turnSerial })} />
      </Row>
      {msg ? <Txt v="small" color={color.bad} style={{ marginTop: space(2) }}>{msg}</Txt> : null}
    </Card>
  );
}

function GameCard({ title, effect, tint, icon, state, canUse, onUse, busy }: {
  title: string; effect: string; tint: string; icon: string; state: 'available' | 'armed' | 'used'; canUse: boolean; onUse: () => void; busy: boolean;
}) {
  const { t } = useApp();
  const used = state === 'used';
  const armed = state === 'armed';
  return (
    <View style={[styles.gameCard, { borderColor: used ? color.line : tint, backgroundColor: armed ? tint : used ? color.surface : tint + '14' }]}
      accessibilityLabel={used ? `${title}: ${t('cards.used')}` : undefined}>
      <View style={{ flex: 1, opacity: used ? 0.35 : 1 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        {has3D(icon) ? <Icon3D name={icon} size={40} /> : <Feather name={icon} size={22} color={armed ? inkOn(tint) : tint} />}
        <Txt v="label" color={armed ? inkOn(tint) : tint}>{used ? t('cards.used') : armed ? t('cards.armed') : t('cards.available')}</Txt>
      </Row>
      <Txt v="h2" color={armed ? inkOn(tint) : color.text} style={{ marginTop: space(2) }}>{title}</Txt>
      <Txt v="small" color={armed ? inkOn(tint) : color.textDim} numberOfLines={3}>{effect}</Txt>
      {!used && !armed ? (
        <Pressable disabled={!canUse || busy} onPress={onUse} accessibilityRole="button" accessibilityLabel={`${t('cards.activate')} ${title}`}
          style={({ pressed }) => [styles.cardBtn, { backgroundColor: canUse ? tint : 'transparent', borderColor: tint, opacity: pressed ? 0.8 : 1 }]}>
          <Txt v="small" color={canUse ? inkOn(tint) : color.textFaint}>{canUse ? t('cards.activate') : t('cards.onlyYourTurn')}</Txt>
        </Pressable>
      ) : null}
      </View>
      {used ? (
        // A used card is crossed out with a big X for the rest of the game.
        <View pointerEvents="none" style={styles.usedX}>
          <View style={styles.usedXCircle}><Feather name="close-thick" size={40} color="#FFFFFF" /></View>
        </View>
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
          : a.outcome === 'passed' ? t('feed.passed', { name: p.name(a.playerId) })
          : a.outcome === 'timed_out' ? t('feed.timeUp', { name: p.name(a.playerId) })
          : a.outcome === 'already_claimed' ? t('feed.claimed', { name: p.name(a.playerId) })
          : t('feed.wrong', { name: p.name(a.playerId) });
        return (
          <Row key={a.id} gap={3} style={[styles.feedRow, a.voided ? { opacity: 0.45 } : null]}>
            <Avatar name={p.name(a.playerId)} tint={p.tint(a.playerId)} emoji={p.emoji(a.playerId)} size={28} />
            <View style={{ flex: 1 }}>
              <Txt v="small" style={a.voided || a.cancelledByStreak ? { textDecorationLine: 'line-through' } : null} numberOfLines={2}>{label}</Txt>
              {a.usedWild || a.usedStreak || a.combo ? (
                <Row gap={2}>
                  {a.usedWild ? <Txt v="small" color={color.wild}>{t('cards.wild')} {ltr(`×${a.multiplier}`)}</Txt> : null}
                  {a.usedStreak ? <Txt v="small" color={color.streak}>{t('cards.streak')}</Txt> : null}
                  {a.combo ? <Txt v="small" color={color.gold}>{t('feed.comboTag')}</Txt> : null}
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
  scoreWrap: { marginTop: -10, alignItems: 'center' },
  scorePill: { minWidth: 34, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#294638', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  deltaFloat: { position: 'absolute', top: -6 },
  rankBadge: { position: 'absolute', top: -4, start: -4, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  turnBar: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingBottom: space(4), backgroundColor: color.accent, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, shadowColor: color.accent, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  turnBarIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  popupBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#29463866', alignItems: 'center', justifyContent: 'center', padding: space(5) },
  popupCard: { width: '100%', maxWidth: 420, padding: space(5), borderRadius: radius.xl, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: color.accent, shadowColor: '#294638', shadowOpacity: 0.25, shadowRadius: 30, elevation: 12 },
  answerInput: { height: 60, borderRadius: radius.lg, borderWidth: 2, borderColor: color.accent, backgroundColor: color.bg, color: color.text, paddingHorizontal: space(4), fontSize: 20, fontWeight: '600' },
  typeAgain: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space(2), paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color.bg + 'AA' },
  myScore: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.md, backgroundColor: color.bg + 'AA', marginEnd: 4 },
  badge: { position: 'absolute', top: 22, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gameCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, padding: space(3), minHeight: 150 },
  usedX: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  usedXCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.bad, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#294638', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  cardBtn: { marginTop: 'auto', height: 34, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  feedRow: { paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: color.line },
  undo: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  backdrop: { flex: 1, backgroundColor: '#29463866', alignItems: 'center', justifyContent: 'center', padding: space(4) },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: color.bgRaised, borderRadius: radius.xl, padding: space(5), borderWidth: 1, borderColor: color.line },
});
