import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useLocalized } from '../app-context';
import { color, space } from '../theme';
import { Avatar, Banner, Button, Card, Confetti, FadeIn, Gap, ltr, Pop, Row, Txt } from '../ui';
import type { ActResult, ActionInput, LiveView } from '../useGame';
import { Board } from './Board';
import { CountdownPill } from './Countdown';
import { Icon3D } from '../icons3d';
import { people } from './helpers';
import { LeaderTable } from './Leaderboard';
import { AnswerFeed, QuestionHeader } from './Play';

type Act = (a: ActionInput) => Promise<ActResult>;

/** End of a question: the full ranking, points per player, who starts next (brief §10H). */
export function Results({ view, act, onError, categoryName }: { view: LiveView; act: Act; onError: (c: string) => void; categoryName: string }) {
  const { t } = useApp();
  const L = useLocalized();
  const insets = useSafeAreaInsets();
  const p = people(view);
  const host = view.role === 'host';
  const [busy, setBusy] = useState(false);
  const r = view.round!;

  const deltas = view.players.map((pl) => {
    const mine = r.attempts.filter((a) => a.playerId === pl.id && !a.voided);
    const pts = mine.filter((a) => a.outcome === 'correct' && !a.cancelledByStreak).reduce((n, a) => n + a.points, 0);
    return { id: pl.id, played: mine.length > 0, pts, cards: mine.filter((a) => a.usedWild || a.usedStreak) };
  }).filter((d) => d.played).sort((a, b) => b.pts - a.pts);

  const next = async () => {
    setBusy(true);
    const res = await act({ type: 'next_question' });
    setBusy(false);
    if (!res.ok) onError(res.error);
  };

  const label = view.nextStep === 'finished' ? t('results.toFinal') : view.nextStep === 'tiebreak' ? t('results.toTiebreak') : t('results.nextQuestion');

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingTop: insets.top + space(3), paddingBottom: space(20) }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <QuestionHeader view={view} categoryName={categoryName} />
          <Gap h={4} />
          {view.nextStep === 'tiebreak' ? <Banner tone="warn" icon="users" text={t('results.tieNotice', { names: p.list(view.tiedPlayerIds) })} /> : null}
          {view.nextStep === 'finished' ? <Banner tone="good" icon="flag" text={t('results.gameOver')} /> : null}
          {view.nextStep === 'next_question' && view.nextStarter ? <Banner tone="info" icon="arrow-right-circle" text={t('results.nextStarter', { name: p.name(view.nextStarter) })} /> : null}
          {view.nextStep === 'tiebreak' && view.nextStarter ? <><Gap h={2} /><Banner tone="info" icon="arrow-right-circle" text={t('results.nextStarter', { name: p.name(view.nextStarter) })} /></> : null}
          <Gap h={4} />

          <Txt v="label" faint>{t('results.thisQuestion')}</Txt>
          <Gap h={2} />
          <Card style={{ padding: space(3) }}>
            {deltas.map((d) => (
              <Row key={d.id} gap={3} style={{ paddingVertical: space(1.5) }}>
                <Avatar name={p.name(d.id)} tint={p.tint(d.id)} size={28} />
                <Txt style={{ flex: 1 }} numberOfLines={1}>{p.name(d.id)}</Txt>
                {d.cards.some((a) => a.usedWild) ? <Txt v="small" color={color.wild}>{t('cards.wild')}</Txt> : null}
                {d.cards.some((a) => a.usedStreak) ? <Txt v="small" color={color.streak}>{t('cards.streak')}</Txt> : null}
                <Pop trigger={d.pts}><Txt v="number" color={d.pts > 0 ? color.good : d.pts < 0 ? color.bad : color.textDim}>{ltr(d.pts > 0 ? `+${d.pts}` : d.pts)}</Txt></Pop>
              </Row>
            ))}
          </Card>

          <Gap h={5} />
          <Txt v="label" faint>{t('results.title')}</Txt>
          <Gap h={2} />
          <Board view={view} />
          {r.explanation ? <><Gap h={3} /><Txt v="small" dim>{L(r.explanation)}</Txt></> : null}
          <Gap h={5} />
          {host ? <AnswerFeed view={view} run={(a) => { act(a).then((x) => { if (!x.ok) onError(x.error); }); }} /> : null}
          <Gap h={5} />
          <Txt v="label" faint>{t('game.leaderboard')}</Txt>
          <LeaderTable view={view} />
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: insets.bottom + space(3), backgroundColor: color.bgRaised, borderTopWidth: 1, borderTopColor: color.line }}>
        {view.timer?.kind === 'next' ? (
          <Row gap={2} style={{ justifyContent: 'center', marginBottom: space(2) }}>
            <Txt v="small" dim>{view.nextStep === 'finished' ? t('results.finalIn') : t('results.nextIn')}</Txt>
            <CountdownPill view={view} kind="next" />
          </Row>
        ) : null}
        {host
          ? <Button label={label} icon={view.nextStep === 'finished' ? 'award' : 'arrow-right'} size="lg" kind={view.nextStep === 'finished' ? 'gold' : 'primary'} busy={busy} disabled={view.paused} onPress={next} />
          : <Txt center dim>{t('results.waitHost')}</Txt>}
      </View>
    </View>
  );
}

/** Final Results (brief §10I): winner, rankings, per-player numbers, celebration. */
export function Final({ view }: { view: LiveView }) {
  const { t } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = people(view);
  const s = view.summary;
  if (!s) return null;
  const winners = s.players.filter((x) => x.won);
  const shared = winners.length > 1;
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingTop: insets.top + space(6), paddingBottom: space(8) }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Txt v="label" faint center>{t('final.title')}</Txt>
          <Gap h={4} />
          {winners.length ? (
            <Pop trigger={winners.map((w) => w.id).join()}>
              <Card glow={color.gold} style={{ alignItems: 'center', paddingVertical: space(6) }}>
                <Icon3D name="trophy" size={72} />
                <Gap h={2} />
                <Txt v="label" color={color.gold}>{shared ? t('final.sharedWin') : t('final.winner')}</Txt>
                <Gap h={3} />
                <Row gap={3} style={{ justifyContent: 'center' }}>
                  {winners.map((w) => <Avatar key={w.id} name={w.name} tint={p.tint(w.id)} size={84} ring={color.gold} />)}
                </Row>
                <Gap h={3} />
                <Txt v="hero" center>{winners.map((w) => w.name).join(' · ')}</Txt>
                <Txt v="title" color={color.gold}>{winners[0].score}</Txt>
              </Card>
            </Pop>
          ) : null}
          {s.players.length >= 2 ? <><Gap h={5} /><Podium players={s.players.slice(0, 3)} tint={p.tint} /></> : null}
          <Gap h={4} />
          <Txt v="small" dim center>{t('final.questions', { n: s.questionsPlayed })}</Txt>
          {s.reason && s.reason !== 'winner' ? <Txt v="small" faint center>{t(`final.reason_${s.reason}`)}</Txt> : null}

          <Gap h={6} />
          {s.players.map((pl) => (
            <Card key={pl.id} style={{ marginBottom: space(3), padding: space(3) }} glow={pl.won ? color.gold : undefined}>
              <Row gap={3}>
                <Txt v="number" faint style={{ width: 28 }}>{pl.position}</Txt>
                <Avatar name={pl.name} tint={p.tint(pl.id)} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt numberOfLines={1}>{pl.name}{pl.id === view.me?.playerId ? ` · ${t('common.you')}` : ''}</Txt>
                  <Txt v="small" dim>
                    {[t('final.claimedN', { n: pl.answersClaimed }), pl.pointsGained ? t('final.gained', { n: ltr(`+${pl.pointsGained}`) }) : null, pl.pointsLost ? t('final.lost', { n: ltr(`−${pl.pointsLost}`) }) : null].filter(Boolean).join(' · ')}
                  </Txt>
                  {pl.cardsUsed.length ? (
                    <Row gap={2}>{pl.cardsUsed.map((c, i) => <Txt key={i} v="small" color={c === 'wild' ? color.wild : color.streak}>{t(`cards.${c}`)}</Txt>)}</Row>
                  ) : null}
                </View>
                <Txt v="title" color={pl.won ? color.gold : color.text}>{pl.score}</Txt>
              </Row>
            </Card>
          ))}
          <Gap h={4} />
          {view.role === 'host' ? <Button label={t('final.newGame')} icon="refresh-cw" size="lg" onPress={() => router.replace('/create')} /> : null}
          <Gap h={2} />
          <Button label={t('final.home')} icon="home" kind="ghost" onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
      {winners.length ? <Confetti /> : null}
    </View>
  );
}


/** Top three on steps: 2nd, 1st, 3rd. */
function Podium({ players, tint }: { players: { id: string; name: string; score: number; position: number }[]; tint: (id: string) => string }) {
  const order = [players[1], players[0], players[2]].filter(Boolean);
  const heights: Record<number, number> = { 1: 110, 2: 82, 3: 62 };
  const medal: Record<number, string> = { 1: color.gold, 2: '#9DB0A6', 3: '#C9875C' };
  return (
    <Row gap={2} style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      {order.map((pl, i) => {
        const pos = Math.min(pl.position, 3);
        return (
          <FadeIn key={pl.id} index={i} style={{ flex: 1, alignItems: 'center', maxWidth: 140 }}>
            <Avatar name={pl.name} tint={tint(pl.id)} size={pos === 1 ? 60 : 48} ring={medal[pos]} />
            <Txt v="small" numberOfLines={1} style={{ marginTop: 4 }}>{pl.name}</Txt>
            <Txt v="number" color={medal[pos]}>{pl.score}</Txt>
            <View style={{ width: '100%', height: heights[pos], marginTop: 6, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: medal[pos] + '33', borderWidth: 1, borderColor: medal[pos] + '88', alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="title" color={medal[pos]}>{pl.position}</Txt>
            </View>
          </FadeIn>
        );
      })}
    </Row>
  );
}
