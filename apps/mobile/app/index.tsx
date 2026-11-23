import { Icon as Feather } from '@/icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { api, type ActiveGame, type Category, type Stats } from '@/api';
import { useApp, useLocalized } from '@/app-context';
import { Icon3D } from '@/icons3d';
import { CategoryPhoto } from '@/photos';
import { HeroVideo } from '@/HeroVideo';
import { catStyle, color, radius, rankColor, space } from '@/theme';
import { Avatar, Card, FadeIn, Gap, Gradient, IconButton, IconPlate, ltr, Row, Screen, SectionTitle, Txt, type IconName, useReducedMotion } from '@/ui';

const HOW: { key: string; icon: IconName; tint: string; img?: string }[] = [
  { key: 's1', icon: 'list', tint: color.accent },
  { key: 's2', icon: 'repeat', tint: color.streak, img: 'microphone' },
  { key: 's3', icon: 'trending-up', tint: color.gold, img: 'sparkles' },
  { key: 's4', icon: 'cards-playing', tint: color.wild, img: 'wild' },
  { key: 's5', icon: 'flag', tint: color.good, img: 'trophy' },
];

export default function Home() {
  const { t, locale, profile, rtl } = useApp();
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

  // the two main actions, always at the bottom of Home as big squares: Join a game · Host a game
  // the two main actions, always at the bottom of Home as two equal squares: Join a game · Host a game
  const actions = (
    <View style={{ flexDirection: 'row', gap: space(3) }}>
      <ActionSquare index={0} bg="#294638" ink="#FFFFFF" title={t('home.join')} hint={t('home.joinHint')} onPress={() => router.push('/join')}
        art={<JoinArt size={56} ring="#FFFFFF1F" />}
        corner={
          <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel={t('home2.scan')} hitSlop={8}
            style={({ pressed }) => [styles.scanBtn, rtl ? { left: space(3) } : { right: space(3) }, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
            <Feather name="maximize" size={18} color={color.accent} />
          </Pressable>
        } />
      <ActionSquare index={1} bg={color.gold} title={t('home2.host')} hint={t('home.createHint')} onPress={() => router.push('/create')}
        art={<Wiggle><Icon3D name="microphone" size={56} /></Wiggle>} />
    </View>
  );

  return (
    <Screen footer={actions}>
      {/* header */}
      <FadeIn>
        {/* logo on one side, the player's picture and name on the other */}
        <Row style={{ justifyContent: 'space-between' }}>
          <BrandLogo height={48} />
          <Row gap={2} style={{ flexShrink: 1, marginStart: space(3) }}>
            <IconButton icon="book-open" label={t('nav.rules')} onPress={() => router.push('/rules')} />
            <IconButton icon="bar-chart-2" label={t('nav.stats')} onPress={() => router.push('/stats')} />
            <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('nav.profile')} hitSlop={6}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
              <Avatar name={profile.name || '?'} tint={profile.color} emoji={profile.emoji} size={44} />
            </Pressable>
          </Row>
        </Row>
      </FadeIn>
      <Gap h={5} />

      {/* hero with the main actions */}
      <FadeIn index={1}>
        {/* edge to edge: cancel the screen's side padding, no rounded corners */}
        <HeroVideo style={{ marginHorizontal: -space(4), borderRadius: 0 }}>
          <View style={{ padding: space(5), minHeight: 210, justifyContent: 'flex-end' }}>
            <Txt v="small" color="#ffffffcc">{profile.name ? t('home2.hi', { name: profile.name }) : t('home2.welcome')}</Txt>
            <Txt v="title" color="#fff">{t('home2.heroTitle')}</Txt>
            <Txt v="small" color="#ffffffcc">{t('home2.heroSub')}</Txt>
          </View>
        </HeroVideo>
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
      <SectionTitle title={t('home2.howTitle')} action={t('nav.rules')} onAction={() => router.push('/rules')} />
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
      <SectionTitle title={t('home2.statsTitle')} action={t('home2.seeStats')} onAction={() => router.push('/stats')} />
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

/** The owner's logo (ladder + boy) on the hero; it floats gently, and a tap makes it bounce. */
const LOGO = require('../assets/brand/logo-mark.png');
function BrandLogo({ height = 121 }: { height?: number }) {
  const reduced = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    a.start();
    return () => a.stop();
  }, [bob, reduced]);
  const bounce = () => {
    if (reduced) return;
    pop.setValue(0.9);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 120, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(2, height / 24)] });
  return (
    <Pressable onPress={bounce} accessibilityRole="image" accessibilityLabel="Outrank" style={{ alignSelf: 'flex-start' }}>
      <Animated.Image source={LOGO} resizeMode="contain" style={{ width: height * (220 / 121), height, transform: [{ translateY }, { scale: pop }] }} />
    </Pressable>
  );
}

/** "Join": a runner leaping onto a game controller, with a gentle hop. */
export function JoinArt({ size = 56, ring = color.accent + '22' }: { size?: number; ring?: string }) {
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ring, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
      <Icon3D name="gamepad" size={size * 0.62} style={{ marginBottom: size * 0.06 }} />
      <Animated.View style={{ position: 'absolute', top: -size * 0.12, transform: [{ translateY: y }] }}>
        <Icon3D name="runner" size={size * 0.6} />
      </Animated.View>
    </View>
  );
}

const ND = Platform.OS !== 'web';

/**
 * One big square action. Pops in with a spring (the second one a beat later), gets a soft shine
 * sweeping across it every few seconds, and squashes and springs back when pressed.
 * The corner prop is a small extra button laid over the top corner (a button cannot hold another button).
 */
function ActionSquare({ index, bg, ink = color.text, title, hint, art, onPress, corner }: {
  index: number; bg: string; ink?: string; title: string; hint: string; art: ReactNode; onPress: () => void; corner?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(enter, { toValue: 1, delay: 150 + index * 140, friction: 5, tension: 70, useNativeDriver: ND }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(2200 + index * 700),
      Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enter, shine, index, reduced]);
  const to = (v: number) => { if (!reduced) Animated.spring(press, { toValue: v, friction: 4, tension: 160, useNativeDriver: ND }).start(); };
  const scale = Animated.multiply(press, enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }));
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-160, 260] });
  return (
    <Animated.View style={{ flex: 1, opacity: enter, transform: [{ translateY }, { scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.93)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={title}
        style={[styles.square, { backgroundColor: bg }]}>
        {!reduced ? (
          <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: '20deg' }] }]} />
        ) : null}
        {art}
        <View>
          <Txt v="h2" color={ink} style={{ fontSize: 18 }} numberOfLines={2}>{title}</Txt>
          <Txt v="small" color={ink + 'B3'} numberOfLines={1}>{hint}</Txt>
        </View>
      </Pressable>
      {corner}
    </Animated.View>
  );
}

/** A playful tilt back and forth, now and then. */
function Wiggle({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const step = (v: number, d: number) => Animated.timing(r, { toValue: v, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: ND });
    const loop = Animated.loop(Animated.sequence([step(1, 160), step(-1, 260), step(0.6, 220), step(0, 200), Animated.delay(1600)]));
    loop.start();
    return () => loop.stop();
  }, [r, reduced]);
  const rotate = r.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });
  return <Animated.View style={{ alignSelf: 'flex-start', transform: [{ rotate }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  square: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, padding: space(3.5), justifyContent: 'space-between', overflow: 'hidden' },
  shine: { position: 'absolute', top: -60, bottom: -60, width: 46, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  joinPlate: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { position: 'absolute', top: space(3), width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  openPill: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 156, height: 180, borderWidth: 2 },
});
