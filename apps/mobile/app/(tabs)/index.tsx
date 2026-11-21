import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { api, type ActiveGame, type Category, type Stats } from '@/api';
import { useApp, useLocalized } from '@/app-context';
import { catStyle, color, radius, rankColor, shadow, space } from '@/theme';
import { Avatar, Card, FadeIn, Gap, Gradient, IconPlate, ltr, Row, Screen, SectionTitle, Txt, type IconName } from '@/ui';

const HOW: { key: string; icon: IconName; tint: string }[] = [
  { key: 's1', icon: 'list', tint: color.accent },
  { key: 's2', icon: 'repeat', tint: color.streak },
  { key: 's3', icon: 'trending-up', tint: color.gold },
  { key: 's4', icon: 'layers', tint: color.wild },
  { key: 's5', icon: 'flag', tint: color.good },
];

export default function Home() {
  const { t, locale, setLocale, profile } = useApp();
  const L = useLocalized();
  const router = useRouter();
  const [active, setActive] = useState<ActiveGame[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(0);
  const cardW = Math.min(Dimensions.get('window').width, 560) - space(8) - 24;

  useFocusEffect(useCallback(() => {
    api<ActiveGame[]>('GET', '/devices/me/active-games').then(setActive).catch(() => setActive([]));
    api<Category[]>('GET', '/categories').then(setCats).catch(() => {});
    api<Stats>('GET', '/devices/me/stats').then(setStats).catch(() => {});
  }, []));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / (cardW + space(3))));

  return (
    <Screen>
      {/* header */}
      <FadeIn>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel={t('nav.profile')}>
            <Row gap={3}>
              <Avatar name={profile.name || '?'} tint={profile.color} size={46} />
              <View>
                <Txt v="h2">{profile.name ? t('home2.hi', { name: profile.name }) : t('home2.welcome')}</Txt>
                <Txt v="small" dim>{t('app.name')}</Txt>
              </View>
            </Row>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')} style={styles.lang}>
            <Feather name="globe" size={15} color={color.textDim} />
            <Txt v="small" dim>{t('common.language')}</Txt>
          </Pressable>
        </Row>
      </FadeIn>
      <Gap h={5} />

      {/* hero with the main actions */}
      <FadeIn index={1}>
        <Gradient from="#5B2BFF" to="#FF4F9A" style={shadow.glow('#7B3BFF')}>
          <View style={{ padding: space(5) }}>
            <Ladder />
            <Gap h={4} />
            <Txt v="title" color="#fff">{t('home2.heroTitle')}</Txt>
            <Txt v="small" color="#ffffffcc">{t('home2.heroSub')}</Txt>
            <Gap h={5} />
            <Row gap={2}>
              <Pressable onPress={() => router.push('/create')} accessibilityRole="button" style={({ pressed }) => [styles.heroBtn, { backgroundColor: '#FFFFFF', flex: 1.7, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Feather name="zap" size={18} color={color.accent} />
                <Txt color={color.accent} numberOfLines={1} style={{ flexShrink: 1 }}>{t('home2.host')}</Txt>
              </Pressable>
              <Pressable onPress={() => router.push('/join')} accessibilityRole="button" style={({ pressed }) => [styles.heroBtn, { backgroundColor: '#ffffff26', flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Feather name="log-in" size={18} color="#fff" />
                <Txt color="#fff" numberOfLines={1}>{t('home2.join')}</Txt>
              </Pressable>
              <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel={t('home2.scan')} style={({ pressed }) => [styles.heroIcon, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
                <Feather name="maximize" size={20} color="#fff" />
              </Pressable>
            </Row>
          </View>
        </Gradient>
      </FadeIn>

      {/* every game this phone is in */}
      {active.length ? (
        <>
          <Gap h={6} />
          <SectionTitle title={t('home2.activeTitle')} />
          {active.map((g, i) => (
            <FadeIn key={g.gameId} index={i + 2}>
              <Pressable onPress={() => router.push(`/game/${g.gameId}`)} accessibilityRole="button">
                <Card glow={color.accent} style={{ marginBottom: space(3), padding: space(3.5) }}>
                  <Row gap={3}>
                    <IconPlate icon={g.role === 'host' ? 'mic' : 'user'} tint={color.accent} solid />
                    <View style={{ flex: 1 }}>
                      <Txt v="h2">{ltr(g.code)}</Txt>
                      <Txt v="small" dim>{g.role === 'host' ? t('common.host') : t('common.you')} · {g.status === 'lobby' ? t('home2.lobby') : t('home2.playing')}</Txt>
                    </View>
                    <View style={styles.openPill}><Txt v="small" color={color.accentInk}>{t('home2.open')}</Txt></View>
                  </Row>
                </Card>
              </Pressable>
            </FadeIn>
          ))}
        </>
      ) : null}

      {/* category tiles */}
      <Gap h={6} />
      <SectionTitle title={t('home2.categories')} />
      <Txt v="small" dim style={{ marginTop: -space(2), marginBottom: space(3) }}>{t('home2.categoriesHint')}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3), paddingEnd: space(2) }} style={{ marginHorizontal: -space(4) }} contentInset={{ left: space(4) }}>
        <View style={{ width: space(1) }} />
        {cats.filter((c) => c.ready > 0).map((c, i) => {
          const st = catStyle(c.id);
          return (
            <FadeIn key={c.id} index={i}>
              <Pressable onPress={() => router.push({ pathname: '/create', params: { category: c.id } })} accessibilityRole="button" accessibilityLabel={L(c.name)}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                <Gradient from={st.tint + '40'} to={color.surface} radius={radius.lg} style={[styles.tile, { borderColor: st.tint + '55' }]}>
                  <View style={{ padding: space(3.5), flex: 1, justifyContent: 'space-between' }}>
                    <IconPlate icon={st.icon as IconName} tint={st.tint} size={46} solid />
                    <View>
                      <Txt v="h2" numberOfLines={2} style={{ fontSize: 16, lineHeight: locale === 'ar' ? 24 : 20 }}>{L(c.name)}</Txt>
                      <Txt v="small" dim>{t('home2.questionsN', { n: c.ready })}</Txt>
                    </View>
                  </View>
                </Gradient>
              </Pressable>
            </FadeIn>
          );
        })}
        <View style={{ width: space(2) }} />
      </ScrollView>

      {/* how it works carousel */}
      <Gap h={6} />
      <SectionTitle title={t('home2.howTitle')} action={t('nav.rules')} onAction={() => router.navigate('/rules')} />
      <ScrollView horizontal pagingEnabled={false} snapToInterval={cardW + space(3)} decelerationRate="fast" showsHorizontalScrollIndicator={false}
        onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ gap: space(3) }}>
        {HOW.map((h, i) => (
          <Card key={h.key} style={{ width: cardW, minHeight: 150, borderColor: h.tint + '44' }}>
            <Row gap={3} style={{ alignItems: 'flex-start' }}>
              <IconPlate icon={h.icon} tint={h.tint} />
              <View style={{ flex: 1 }}>
                <Txt v="label" color={h.tint}>{`${i + 1} / ${HOW.length}`}</Txt>
                <Txt v="h2">{t(`how.${h.key}t`)}</Txt>
                <Gap h={1} />
                <Txt v="small" dim>{t(`how.${h.key}b`)}</Txt>
              </View>
            </Row>
          </Card>
        ))}
      </ScrollView>
      <Row gap={1.5} style={{ justifyContent: 'center', marginTop: space(3) }}>
        {HOW.map((h, i) => <View key={h.key} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? color.accent : color.line }} />)}
      </Row>

      {/* stats strip */}
      <Gap h={6} />
      <SectionTitle title={t('home2.statsTitle')} action={t('home2.seeStats')} onAction={() => router.navigate('/stats')} />
      <Row gap={3}>
        {([
          ['home2.games', stats?.gamesPlayed ?? 0, 'grid', color.streak],
          ['home2.wins', stats?.gamesWon ?? 0, 'award', color.gold],
          ['home2.best', stats?.highestScore ?? 0, 'trending-up', color.accent],
        ] as [string, number, IconName, string][]).map(([k, n, icon, tint]) => (
          <Card key={k} style={{ flex: 1, padding: space(3), alignItems: 'center' }}>
            <IconPlate icon={icon} tint={tint} size={36} />
            <Gap h={2} />
            <Txt v="title" style={{ fontSize: 22 }}>{n}</Txt>
            <Txt v="small" dim>{t(k)}</Txt>
          </Card>
        ))}
      </Row>
    </Screen>
  );
}

/** The brand mark: a 12-step ranking ladder, gold at 10, red at 11–12. */
function Ladder() {
  return (
    <Row gap={1.5} style={{ alignItems: 'flex-end', height: 56 }}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={{ width: 12, height: 14 + (11 - i) * 3.6, borderRadius: 4, backgroundColor: i < 9 ? '#ffffff' : rankColor(i + 1), opacity: i < 9 ? 0.35 + (9 - i) * 0.07 : 1 }} />
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line },
  heroBtn: { height: 50, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  heroIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center' },
  openPill: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 148, height: 168, borderWidth: 1 },
});
