import { Icon as Feather } from '@/icons';
import type { GameEvent } from '@outrank/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Category } from '@/api';
import { useApp, useLocalized } from '@/app-context';
import { people } from '@/game/helpers';
import { Lobby } from '@/game/Lobby';
import { buzz, Play } from '@/game/Play';
import { Final, Results } from '@/game/Results';
import { Social } from '@/game/Social';
import { color, inkOn, radius, space } from '@/theme';
import { Button, Gap, Loading, ltr, Screen, Txt, useReducedMotion } from '@/ui';
import { useGame, type LiveView } from '@/useGame';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, errorText } = useApp();
  const L = useLocalized();
  const router = useRouter();
  const { view, connected, error, act, lastEvents, chat } = useGame(id);
  const [cats, setCats] = useState<Category[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string; tone: string } | null>(null);
  const toastId = useRef(0);

  useEffect(() => { api<Category[]>('GET', '/categories').then(setCats).catch(() => {}); }, []);

  const show = (text: string, tone: string) => { toastId.current += 1; setToast({ id: toastId.current, text, tone }); };
  const onError = (code: string) => show(errorText(code), color.bad);

  // What just happened, for everyone (brief §8: who answered, answer, rank, points, multiplier).
  useEffect(() => {
    if (!view || !lastEvents.events.length) return;
    const msg = describe(lastEvents.events, view, t, L);
    if (msg) {
      show(msg.text, msg.tone);
      if (msg.tone === color.good && view.me) buzz('good');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvents.id]);

  if (error === 'NOT_IN_GAME' || error === 'GAME_NOT_FOUND') {
    return (
      <Screen>
        <Gap h={20} />
        <Txt v="h2" center>{errorText(error)}</Txt>
        <Gap />
        <Button label={t('final.home')} icon="home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  if (!view) return <Loading />;

  const categoryName = view.round ? L(cats.find((c) => c.id === view.round!.categoryId)?.name) || view.round.categoryId : '';

  let body;
  if (view.phase === 'lobby') body = <Lobby view={view} act={act} onError={onError} />;
  else if (view.phase === 'question') body = <Play view={view} act={act} onError={onError} categoryName={categoryName} />;
  else if (view.phase === 'results') body = <Results view={view} act={act} onError={onError} categoryName={categoryName} />;
  else body = <Final view={view} />;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {body}
      <Social view={view} chat={chat} onError={onError} lift={view.phase === 'question' ? 0 : -4} />
      {view.paused && view.phase !== 'finished' ? <PausedOverlay view={view} onResume={() => act({ type: 'resume' }).then((r) => { if (!r.ok) onError(r.error); })} /> : null}
      {!connected ? <Offline text={t('common.offline')} /> : null}
      {toast ? <Toast key={toast.id} text={toast.text} tone={toast.tone} onDone={() => setToast(null)} /> : null}
    </View>
  );
}

function describe(events: GameEvent[], view: LiveView, t: (k: string, v?: Record<string, string | number>) => string, L: (v: { en: string; ar?: string } | null | undefined) => string) {
  const p = people(view);
  const ev = (type: string) => events.find((e) => e.type === type) as (GameEvent & Record<string, any>) | undefined;
  const reached = ev('target_reached');
  if (reached) return { text: t('game.targetReached', { names: p.list(reached.playerIds as string[]), n: view.targetScore }), tone: color.gold };
  const lost = ev('streak_failed');
  if (lost) return { text: t('feed.streakLost', { name: p.name(lost.playerId), n: lost.lostPoints }), tone: color.bad };
  const ok = ev('answer_confirmed');
  if (ok) {
    const slot = view.round?.slots.find((s) => s.rank === ok.rank);
    const mult = ok.multiplier > 1 ? ` ×${ok.multiplier}` : '';
    const pts = ok.points > 0 ? `+${ok.points}` : `${ok.points}`;
    return { text: `${t('feed.correct', { name: p.name(ok.playerId), rank: ok.rank, answer: L(slot?.text) })}  ${ltr(pts + mult)}`, tone: ok.points < 0 ? color.bad : color.good };
  }
  const bad = ev('answer_rejected');
  if (bad) return { text: t(bad.outcome === 'already_claimed' ? 'feed.claimed' : 'feed.wrong', { name: p.name(bad.playerId) }), tone: color.bad };
  const passed = ev('turn_passed');
  if (passed) return { text: t('feed.passed', { name: p.name(passed.playerId) }), tone: color.streak };
  const timeUp = ev('time_up');
  if (timeUp) return { text: t('feed.timeUp', { name: p.name(timeUp.playerId) }), tone: color.bad };
  const skipped = ev('turn_skipped');
  if (skipped) return { text: t('feed.skipped', { name: p.name(skipped.playerId) }), tone: color.textDim };
  const card = ev('card_activated');
  if (card) return { text: t('cards.activated', { name: p.name(card.playerId), card: t(`cards.${card.card}`) }), tone: card.card === 'wild' ? color.wild : color.streak };
  if (ev('attempt_voided')) return { text: t('feed.voided'), tone: color.warn };
  return null;
}

function Toast({ text, tone, onDone }: { text: string; tone: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(reduced ? 0 : -80)).current;
  useEffect(() => {
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.spring(y, { toValue: 0, friction: 7, useNativeDriver: native }),
      Animated.delay(2600),
      Animated.timing(y, { toValue: -120, duration: 300, useNativeDriver: native }),
    ]).start(onDone);
  }, [y, onDone]);
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + space(2), borderColor: tone, transform: [{ translateY: y }] }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
      <Txt numberOfLines={2} style={{ flex: 1 }}>{text}</Txt>
    </Animated.View>
  );
}

function PausedOverlay({ view, onResume }: { view: LiveView; onResume: () => void }) {
  const { t } = useApp();
  return (
    <View style={styles.overlay}>
      <View style={styles.pauseCard}>
        <Feather name={view.hostOnline ? 'pause-circle' : 'wifi-off'} size={42} color={color.warn} />
        <Gap h={3} />
        <Txt v="title" center>{t('game.paused')}</Txt>
        <Txt dim center>{view.role === 'host' ? '' : view.hostOnline ? t('game.pausedHint') : t('game.waitingHost')}</Txt>
        {view.role === 'host' ? <><Gap h={4} /><Button label={t('game.resume')} icon="play" onPress={onResume} /></> : null}
      </View>
    </View>
  );
}

function Offline({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.offline, { bottom: insets.bottom + 90 }]}>
      <Feather name="wifi-off" size={16} color={inkOn(color.warn)} />
      <Txt v="small" color={inkOn(color.warn)}>{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: space(4), right: space(4), maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3.5), borderRadius: radius.lg, backgroundColor: color.bgRaised, borderWidth: 1.5, shadowColor: '#294638', shadowOpacity: 0.18, shadowRadius: 20, elevation: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F5F8F3EE', alignItems: 'center', justifyContent: 'center', padding: space(6) },
  pauseCard: { width: '100%', maxWidth: 380, alignItems: 'center', padding: space(6), borderRadius: radius.xl, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  offline: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 36, borderRadius: radius.pill, backgroundColor: color.warn },
});
