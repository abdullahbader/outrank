import { Icon as Feather } from '@/icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { api, type ActiveGame, type Category, type Stats } from '@/api';
import { useApp, useLocalized } from '@/app-context';
import { Icon3D } from '@/icons3d';
import { CategoryPhoto } from '@/photos';
import { catStyle, color, radius, rankColor, shadow, space } from '@/theme';
import { Avatar, Card, FadeIn, Gap, Gradient, IconPlate, ltr, Row, Screen, SectionTitle, Txt, type IconName, useReducedMotion } from '@/ui';

const HOW: { key: string; icon: IconName; tint: string; img?: string }[] = [
  { key: 's1', icon: 'list', tint: color.accent },
  { key: 's2', icon: 'repeat', tint: color.streak, img: 'microphone' },
  { key: 's3', icon: 'trending-up', tint: color.gold, img: 'sparkles' },
  { key: 's4', icon: 'cards-playing', tint: color.wild, img: 'wild' },
  { key: 's5', icon: 'flag', tint: color.good, img: 'trophy' },
];

export default function Home() {
  const { t, locale, setLocale, profile, rtl } = useApp();
  const L = useLocalized();
  const router = useRouter();
  const [active, setActive] = useState<ActiveGame[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(0);
  const [devTools, setDevTools] = useState(false);
  const [practising, setPractising] = useState(false);
  const cardW = Math.min(Dimensions.get('window').width, 560) - space(8) - 24;

  useFocusEffect(useCallback(() => {
    api<ActiveGame[]>('GET', '/devices/me/active-games').then(setActive).catch(() => setActive([]));
    api<Category[]>('GET', '/categories').then(setCats).catch(() => {});
    api<Stats>('GET', '/devices/me/stats').then(setStats).catch(() => {});
    api<{ devTools: boolean }>('GET', '/health').then((h) => setDevTools(!!h.devTools)).catch(() => {});
  }, []));

  const practise = async () => {
    setPractising(true);
    try {
      const g = await api<{ gameId: string }>('POST', '/dev/practice');
      router.push(`/game/${g.gameId}`);
    } catch {} finally { setPractising(false); }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / (cardW + space(3))));

  return (
    <Screen>
      {/* header */}
      <FadeIn>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel={t('nav.profile')}>
            <Row gap={3}>
              <Avatar name={profile.name || '?'} tint={profile.color} emoji={profile.emoji} size={46} />
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
        <Gradient from="#3F8F65" to="#75AFC5" style={shadow.glow('#3F8F65')}>
          <View style={{ padding: space(5) }}>
            <Ladder />
            <Gap h={4} />
            <Txt v="title" color="#fff">{t('home2.heroTitle')}</Txt>
            <Txt v="small" color="#ffffffcc">{t('home2.heroSub')}</Txt>
            <Gap h={5} />
            {/* the main action: a big Join block */}
            <View style={styles.joinBlock}>
              <Pressable onPress={() => router.push('/join')} accessibilityRole="button" accessibilityLabel={t('home.join')}
                style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(3) }, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                <JoinArt size={56} />
                <View style={{ flex: 1 }}>
                  <Txt v="h2" color={color.text} style={{ fontSize: 20 }}>{t('home.join')}</Txt>
                  <Txt v="small" dim>{t('home.joinHint')}</Txt>
                </View>
              </Pressable>
              <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel={t('home2.scan')} hitSlop={6}
                style={({ pressed }) => [styles.scanBtn, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
                <Feather name="maximize" size={20} color={color.accent} />
              </Pressable>
            </View>
            <Gap h={3} />
            <Pressable onPress={() => router.push('/create')} accessibilityRole="button" style={({ pressed }) => [styles.hostRow, { opacity: pressed ? 0.8 : 1 }]}>
              <Feather name="zap" size={18} color="#FFFFFF" />
              <Txt color="#FFFFFF" style={{ flex: 1 }}>{t('home2.host')}</Txt>
              <Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={20} color="#FFFFFFCC" />
            </Pressable>
          </View>
        </Gradient>
      </FadeIn>

      {devTools ? (
        <FadeIn index={2}>
          <Pressable onPress={practise} disabled={practising} accessibilityRole="button" style={({ pressed }) => ({ marginTop: space(4), opacity: practising ? 0.6 : pressed ? 0.85 : 1 })}>
            <Card style={{ padding: space(3.5), borderStyle: 'dashed', borderColor: color.streak }}>
              <Row gap={3}>
                <IconPlate icon="user-check" tint={color.streak} />
                <View style={{ flex: 1 }}>
                  <Txt v="h2" style={{ fontSize: 16 }}>{t('practice.title')}</Txt>
                  <Txt v="small" dim>{t('practice.hint')}</Txt>
                </View>
                <View style={[styles.openPill, { backgroundColor: color.streak }]}><Txt v="small" color="#FFFFFF">{t('practice.go')}</Txt></View>
              </Row>
            </Card>
          </Pressable>
        </FadeIn>
      ) : null}

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
                <CategoryPhoto category={c.id} radius={radius.lg} shade={0.42} style={[styles.tile, { borderColor: st.tint }]}>
                  <View style={{ padding: space(3.5), flex: 1, justifyContent: 'space-between' }}>
                    <IconPlate icon={st.icon as IconName} img={c.id} tint="#FFFFFF" size={56} solid />
                    <View>
                      <Txt v="h2" color="#FFFFFF" numberOfLines={2} style={{ fontSize: 17, lineHeight: locale === 'ar' ? 25 : 21 }}>{L(c.name)}</Txt>
                      <Txt v="small" color="#FFFFFFDD">{t('home2.questionsN', { n: c.ready })}</Txt>
                    </View>
                  </View>
                </CategoryPhoto>
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
              <IconPlate icon={h.icon} img={h.img} tint={h.tint} size={52} />
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
          ['home2.games', stats?.gamesPlayed ?? 0, 'grid', color.streak, 'party'],
          ['home2.wins', stats?.gamesWon ?? 0, 'award', color.gold, 'trophy'],
          ['home2.best', stats?.highestScore ?? 0, 'trending-up', color.accent, 'sparkles'],
        ] as [string, number, IconName, string, string][]).map(([k, n, icon, tint, img]) => (
          <Card key={k} style={{ flex: 1, padding: space(3), alignItems: 'center' }}>
            <IconPlate icon={icon} img={img} tint={tint} size={44} />
            <Gap h={2} />
            <Txt v="title" style={{ fontSize: 22 }}>{n}</Txt>
            <Txt v="small" dim>{t(k)}</Txt>
          </Card>
        ))}
      </Row>
    </Screen>
  );
}

/** The brand mark: a 12-step ranking ladder (gold at 10, red at 11–12) with a smart boy hopping
 *  from column to column. Tap it to send him off again. Still when the phone asks for less motion. */
const BAR_W = 14;
const BAR_GAP = 6;
const BOY = 30;
const barHeight = (i: number) => 18 + (11 - i) * 4;

/** "Join": a runner leaping onto a game controller, with a gentle hop. */
export function JoinArt({ size = 56 }: { size?: number }) {
  const reduced = useReducedMotion();
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(hop, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(1400),
    ]));
    a.start();
    return () => a.stop();
  }, [hop, reduced]);
  const y = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.18] });
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.accent + '22', alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
      <Icon3D name="gamepad" size={size * 0.62} style={{ marginBottom: size * 0.06 }} />
      <Animated.View style={{ position: 'absolute', top: -size * 0.12, transform: [{ translateY: y }] }}>
        <Icon3D name="runner" size={size * 0.6} />
      </Animated.View>
    </View>
  );
}

function Ladder() {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const run = useCallback(() => {
    anim.current?.stop();
    if (reduced) { t.setValue(0); return; }
    t.setValue(0);
    anim.current = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 11, duration: 11 * 420, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(700),
      Animated.timing(t, { toValue: 0, duration: 11 * 260, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(1200),
    ]));
    anim.current.start();
  }, [t, reduced]);

  useEffect(() => { run(); return () => anim.current?.stop(); }, [run]);

  // Hop path: on top of each column at whole numbers, up in the air half-way between columns.
  const xs: number[] = [];
  const ys: number[] = [];
  const inputs: number[] = [];
  const maxH = barHeight(0);
  for (let i = 0; i <= 11; i++) {
    inputs.push(i);
    xs.push(i * (BAR_W + BAR_GAP) + BAR_W / 2 - BOY / 2);
    ys.push(maxH - barHeight(i));
    if (i < 11) {
      inputs.push(i + 0.5);
      xs.push((i + 0.5) * (BAR_W + BAR_GAP) + BAR_W / 2 - BOY / 2);
      ys.push(maxH - Math.max(barHeight(i), barHeight(i + 1)) - 22);
    }
  }
  const translateX = t.interpolate({ inputRange: inputs, outputRange: xs });
  const translateY = t.interpolate({ inputRange: inputs, outputRange: ys });

  return (
    <Pressable onPress={run} accessibilityRole="button" accessibilityLabel="Outrank" style={{ alignSelf: 'flex-start' }}>
      <View style={{ height: maxH + BOY + 4, width: 12 * BAR_W + 11 * BAR_GAP, justifyContent: 'flex-end' }}>
        <Row gap={BAR_GAP / 4} style={{ alignItems: 'flex-end' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={{ width: BAR_W, height: barHeight(i), borderRadius: 4, backgroundColor: i < 9 ? '#ffffff' : rankColor(i + 1), opacity: i < 9 ? 0.4 + (9 - i) * 0.066 : 1 }} />
          ))}
        </Row>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX }, { translateY }] }}>
          <Icon3D name="boy" size={BOY} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line },
  joinBlock: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg, backgroundColor: '#FFFFFF', minHeight: 84 },
  joinPlate: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.accent + '18', alignItems: 'center', justifyContent: 'center' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), height: 48, paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: '#FFFFFF2E' },
  openPill: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 156, height: 180, borderWidth: 2 },
});
