import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api, type Stats } from '@/api';
import { useApp } from '@/app-context';
import { color, space } from '@/theme';
import { Card, FadeIn, Gap, IconPlate, Row, Screen, SectionTitle, Txt, type IconName } from '@/ui';

export default function StatsTab() {
  const { t, locale } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  useFocusEffect(useCallback(() => { api<Stats>('GET', '/devices/me/stats').then(setStats).catch(() => {}); }, []));

  const tiles: [string, string, IconName, string][] = [
    [t('profile.played'), String(stats?.gamesPlayed ?? 0), 'grid', color.streak],
    [t('profile.won'), String(stats?.gamesWon ?? 0), 'award', color.gold],
    [t('profile.winRate'), `${stats?.winRate ?? 0}%`, 'percent', color.wild],
    [t('profile.best'), String(stats?.highestScore ?? 0), 'trending-up', color.accent],
    [t('profile.average'), String(stats?.averageScore ?? 0), 'activity', color.good],
  ];

  return (
    <Screen>
      <Txt v="title">{t('stats.title')}</Txt>
      <Gap h={5} />
      <Row wrap gap={3}>
        {tiles.map(([label, value, icon, tint], i) => (
          <FadeIn key={label} index={i} style={{ flexGrow: 1, flexBasis: '44%' }}>
            <Card style={{ padding: space(3.5) }}>
              <Row gap={3}>
                <IconPlate icon={icon} tint={tint} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt v="title" style={{ fontSize: 22 }}>{value}</Txt>
                  <Txt v="small" dim numberOfLines={1}>{label}</Txt>
                </View>
              </Row>
            </Card>
          </FadeIn>
        ))}
      </Row>

      <Gap h={8} />
      <SectionTitle title={t('profile.history')} />
      {stats && !stats.recent.length ? <Card><Txt dim center>{t('profile.noHistory')}</Txt></Card> : null}
      {stats?.recent.map((g, i) => (
        <FadeIn key={g.gameId} index={i}>
          <Card style={{ marginBottom: space(2), padding: space(3) }} glow={g.won ? color.gold : undefined}>
            <Row gap={3}>
              <IconPlate icon={g.won ? 'award' : 'hash'} tint={g.won ? color.gold : color.textDim} size={38} />
              <View style={{ flex: 1 }}>
                <Txt>{new Date(g.at).toLocaleDateString(locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Txt>
                <Txt v="small" dim>{t('profile.rank', { rank: g.rank })}{g.won ? ` · ${t('profile.winner')}` : ''}</Txt>
              </View>
              <Txt v="title" style={{ fontSize: 22 }} color={g.won ? color.gold : color.text}>{g.score}</Txt>
            </Row>
          </Card>
        </FadeIn>
      ))}
    </Screen>
  );
}
