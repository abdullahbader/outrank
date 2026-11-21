import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { api, type Category } from '../api';
import { recoveryKey, useApp, useLocalized } from '../app-context';
import { joinLink } from '../config';
import { storage } from '../storage';
import { catStyle, color, radius, space } from '../theme';
import { Avatar, Banner, Button, Card, Chip, FadeIn, Gap, Gradient, ltr, Pop, QR, Row, Screen, TopBar, Txt } from '../ui';
import type { ActResult, ActionInput, LiveView } from '../useGame';
import { people } from './helpers';

export function Lobby({ view, act, onError }: { view: LiveView; act: (a: ActionInput) => Promise<ActResult>; onError: (code: string) => void }) {
  const { t, errorText } = useApp();
  const L = useLocalized();
  const router = useRouter();
  const host = view.role === 'host';
  const p = people(view);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [devTools, setDevTools] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Category[]>('GET', '/categories').then(setCats).catch(() => {});
    if (host) {
      storage.get(recoveryKey(view.gameId)).then(setRecovery);
      api<{ devTools: boolean }>('GET', '/health').then((h) => setDevTools(!!h.devTools)).catch(() => {});
    }
  }, [host, view.gameId]);

  const run = async (a: ActionInput) => {
    setBusy(true);
    const r = await act(a);
    setBusy(false);
    if (!r.ok) onError(r.error);
  };

  const toggleCat = (id: string) => {
    const next = view.categories.includes(id) ? view.categories.filter((c) => c !== id) : [...view.categories, id];
    if (next.length) run({ type: 'set_categories', categories: next });
  };

  const catName = (id: string) => L(cats.find((c) => c.id === id)?.name) || id;
  const enough = view.players.length >= 2;

  return (
    <Screen footer={host ? (
      <View>
        {!enough ? <Txt v="small" dim center style={{ marginBottom: space(2) }}>{t('lobby.needPlayers', { n: 2 })}</Txt> : null}
        <Button label={t('lobby.start')} icon="play" size="lg" busy={busy} disabled={!enough} onPress={() => run({ type: 'start' })} />
      </View>
    ) : (
      <Button label={t('lobby.leave')} kind="ghost" icon="log-out" onPress={async () => { const r = await act({ type: 'leave' }); if (r.ok) router.replace('/'); else onError(r.error); }} />
    )}>
      <TopBar title={t('lobby.title')} onBack={() => router.replace('/')} />

      <Gradient from="#2A1F5C" to="#15112B" style={{ borderWidth: 1, borderColor: color.accent + '66' }}>
        <View style={{ alignItems: 'center', padding: space(5) }}>
          <Txt v="label" faint>{t('lobby.code')}</Txt>
          <Txt v="hero" style={{ letterSpacing: 6, fontFamily: 'Sora_700Bold' }}>{ltr(view.code)}</Txt>
          <Gap h={3} />
          <QR value={joinLink(view.code)} size={host ? 180 : 120} />
          <Gap h={3} />
          <Txt v="small" dim center>{t('lobby.share')}</Txt>
          <Gap h={3} />
          <Button label={t('lobby.shareBtn')} icon="share-2" kind="secondary" size="sm"
            onPress={() => Share.share({ message: t('lobby.shareText', { code: view.code, link: joinLink(view.code) }) }).catch(() => {})} />
        </View>
      </Gradient>

      {!host ? <><Gap h={4} /><Banner tone="good" icon="check-circle" text={`${t('lobby.youJoined')} ${t('lobby.waitingHost')}`} /></> : null}

      <Gap h={6} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" faint>{t('lobby.categories')}</Txt>
        {host ? <Pressable onPress={() => setEditing((e) => !e)} accessibilityRole="button"><Txt v="small" color={color.accent}>{t('lobby.edit')}</Txt></Pressable> : null}
      </Row>
      <Gap h={2} />
      <Row wrap gap={2}>
        {(editing ? cats.filter((c) => c.ready > 0).map((c) => c.id) : view.categories).map((id) => (
          <Chip key={id} label={catName(id)} icon={catStyle(id).icon as never} selected={view.categories.includes(id)} onPress={host && editing ? () => toggleCat(id) : undefined} />
        ))}
      </Row>

      <Gap h={6} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" faint>{t('lobby.players', { n: view.players.length })}</Txt>
        {host && devTools ? <Pressable onPress={() => api('POST', `/dev/games/${view.gameId}/bots`, { count: 9 }).catch((e) => onError(errorText(e)))} accessibilityRole="button"><Txt v="small" color={color.streak}>{t('lobby.addBots')}</Txt></Pressable> : null}
      </Row>
      <Gap h={2} />
      {!view.players.length ? <Card><Txt dim center>{t('lobby.waiting')}</Txt></Card> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        {view.players.map((pl, i) => (
          <FadeIn key={pl.id} index={i} style={{ width: '30%', flexGrow: 1, maxWidth: '33%' }}>
            <Card style={{ alignItems: 'center', padding: space(3), borderColor: pl.id === view.me?.playerId ? color.accent : color.line }}>
              <View>
                <Pop trigger={pl.id}><Avatar name={pl.name} tint={p.tint(pl.id)} size={52} /></Pop>
                <View style={{ position: 'absolute', bottom: 0, end: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: color.surface, backgroundColor: view.online[pl.id] ? color.good : color.textFaint }} />
              </View>
              <Gap h={2} />
              <Txt v="small" numberOfLines={1}>{pl.name}</Txt>
              {pl.id === view.me?.playerId ? <Txt v="small" color={color.accent} style={{ fontSize: 11 }}>{t('common.you')}</Txt> : null}
              {host ? (
                <Pressable onPress={() => run({ type: 'remove_player', playerId: pl.id })} accessibilityRole="button" accessibilityLabel={`${t('lobby.remove')} ${pl.name}`} hitSlop={8}
                  style={{ position: 'absolute', top: 6, end: 6, padding: 4, borderRadius: radius.pill, backgroundColor: color.surface2 }}>
                  <Feather name="x" size={14} color={color.bad} />
                </Pressable>
              ) : null}
            </Card>
          </FadeIn>
        ))}
      </View>

      {host && recovery ? (
        <>
          <Gap h={6} />
          <Card>
            <Txt v="label" faint>{t('lobby.recovery')}</Txt>
            <Txt v="title" style={{ letterSpacing: 4 }}>{ltr(recovery)}</Txt>
            <Txt v="small" dim>{t('lobby.recoveryHint')}</Txt>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
