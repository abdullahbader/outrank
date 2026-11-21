import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useApp } from '../app-context';
import { Icon3D } from '../icons3d';
import { color, radius, space } from '../theme';
import { Txt, useReducedMotion } from '../ui';

export interface Burst { key: number; card: 'wild' | 'streak'; name: string }

const native = Platform.OS !== 'web';
const RAYS = 10;

/**
 * The "super power" moment: when anyone plays Wild or Streak, every phone (host included) shows
 * the card bursting in — a glow, rays, sparkles flying out, and who played it. Taps pass through,
 * so the game is never blocked. With reduced motion it simply appears and fades.
 */
export function PowerUp({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  const { t } = useApp();
  const reduced = useReducedMotion();
  const tint = burst.card === 'wild' ? color.wild : color.streak;
  const pop = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const seq = reduced
      ? Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 200, useNativeDriver: native }),
          Animated.delay(1400),
          Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: native }),
        ])
      : Animated.sequence([
          Animated.parallel([
            Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: native }),
            Animated.timing(rays, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
          ]),
          Animated.delay(500),
          Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: native }),
        ]);
    seq.start(() => done.current());
    return () => seq.stop();
  }, [pop, rays, fade, reduced]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const rotate = pop.interpolate({ inputRange: [0, 1], outputRange: [burst.card === 'wild' ? '-28deg' : '20deg', '0deg'] });
  const glow = rays.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.6] });
  const glowOpacity = rays.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] });
  const angles = useMemo(() => Array.from({ length: RAYS }, (_, i) => (i / RAYS) * Math.PI * 2), []);

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity: fade }]} accessibilityLiveRegion="polite"
      accessibilityLabel={burst.card === 'wild' ? t('power.wildSub', { name: burst.name }) : t('power.streakSub', { name: burst.name })}>
      <View style={[styles.flash, { backgroundColor: tint + '30' }]} />
      {!reduced ? <Animated.View style={[styles.ring, { borderColor: tint, opacity: glowOpacity, transform: [{ scale: glow }] }]} /> : null}
      {!reduced ? angles.map((a, i) => {
        const dist = 150 + (i % 3) * 30;
        const x = rays.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * dist] });
        const y = rays.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * dist] });
        const o = rays.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View key={i} style={[styles.spark, { opacity: o, transform: [{ translateX: x }, { translateY: y }, { scale: i % 2 ? 0.7 : 1 }] }]}>
            <Icon3D name={i % 3 === 0 ? (burst.card === 'wild' ? 'sparkles' : 'streak') : 'sparkles'} size={34} />
          </Animated.View>
        );
      }) : null}
      <Animated.View style={[styles.card, { borderColor: tint, shadowColor: tint, transform: [{ scale }, { rotate }] }]}>
        <Icon3D name={burst.card} size={120} />
        <Txt v="hero" color={tint} center style={{ fontSize: 34, lineHeight: 42 }}>
          {burst.card === 'wild' ? t('power.wildTitle') : t('power.streakTitle')}
        </Txt>
        <Txt dim center>{burst.card === 'wild' ? t('power.wildSub', { name: burst.name }) : t('power.streakSub', { name: burst.name })}</Txt>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 10 },
  spark: { position: 'absolute' },
  card: {
    alignItems: 'center', gap: space(1), paddingVertical: space(6), paddingHorizontal: space(7), borderRadius: radius.xl,
    backgroundColor: '#FFFFFF', borderWidth: 3, shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 14, maxWidth: 320,
  },
});
