import { Icon as Feather } from './icons';
import { has3D, Icon3D } from './icons3d';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useApp } from './app-context';
import { color, font, inkOn, radius, readableText, space } from './theme';

export type IconName = string;

// ───────────── text

type TxtVariant = 'hero' | 'title' | 'h2' | 'body' | 'small' | 'label' | 'number';

export function Txt({ children, v = 'body', style, dim, faint, center, numberOfLines, color: c, auto }: {
  children: ReactNode; v?: TxtVariant; style?: StyleProp<TextStyle>; dim?: boolean; faint?: boolean; center?: boolean; numberOfLines?: number; color?: string;
  /** Text typed by people (chat): direction follows the text's own language. */
  auto?: boolean;
}) {
  const { locale } = useApp();
  const ar = locale === 'ar';
  const base: TextStyle = ({
    hero: { fontFamily: ar ? font.arBold : font.display, fontSize: 40, lineHeight: ar ? 56 : 44, letterSpacing: ar ? 0 : -1 },
    title: { fontFamily: ar ? font.arBold : font.display, fontSize: 26, lineHeight: ar ? 40 : 32, letterSpacing: ar ? 0 : -0.5 },
    h2: { fontFamily: ar ? font.arBold : font.displaySemi, fontSize: 18, lineHeight: ar ? 28 : 24 },
    body: { fontFamily: ar ? font.ar : font.body, fontSize: 16, lineHeight: ar ? 26 : 22 },
    small: { fontFamily: ar ? font.ar : font.bodyMedium, fontSize: 13, lineHeight: ar ? 21 : 18 },
    label: { fontFamily: ar ? font.arBold : font.bodyBold, fontSize: 12, lineHeight: ar ? 18 : 16, letterSpacing: ar ? 0 : 0.8, textTransform: ar ? 'none' : 'uppercase' },
    number: { fontFamily: font.display, fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
  } as Record<TxtVariant, TextStyle>)[v];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[base, { color: c ? readableText(c) : (faint ? color.textFaint : dim ? color.textDim : color.text), textAlign: center ? 'center' : 'auto', writingDirection: auto ? 'auto' : ar ? 'rtl' : 'ltr' }, style]}
    >
      {children}
    </Text>
  );
}

/** Keep numbers, codes and names left-to-right inside Arabic text. */
export const ltr = (s: string | number) => `⁦${s}⁩`;

// ───────────── layout

export function Screen({ children, scroll = true, footer, padded = true }: { children: ReactNode; scroll?: boolean; footer?: ReactNode; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  const pad = padded ? space(4) : 0;
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ padding: pad, paddingTop: insets.top + space(3), paddingBottom: space(24) }} keyboardShouldPersistTaps="handled">
      <View style={styles.maxWidth}>{children}</View>
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: pad, paddingTop: insets.top + space(3) }}><View style={[styles.maxWidth, { flex: 1 }]}>{children}</View></View>
  );
  return (
    <View style={styles.screen}>
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space(3) }]}><View style={styles.maxWidth}>{footer}</View></View> : null}
    </View>
  );
}

export function Row({ children, gap = 2, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(gap), flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Gap({ h = 4 }: { h?: number }) { return <View style={{ height: space(h) }} />; }

export function Card({ children, style, glow }: { children: ReactNode; style?: StyleProp<ViewStyle>; glow?: string }) {
  return <View style={[styles.card, glow ? { borderColor: glow, shadowColor: glow, shadowOpacity: 0.35, shadowRadius: 18 } : null, style]}>{children}</View>;
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  const { t, rtl } = useApp();
  return (
    <Row style={{ marginBottom: space(4), minHeight: 44 }}>
      {onBack ? <IconButton icon={rtl ? 'arrow-right' : 'arrow-left'} label={t('common.back')} onPress={onBack} /> : null}
      <View style={{ flex: 1 }}>{title ? <Txt v="h2" numberOfLines={1}>{title}</Txt> : null}</View>
      {right}
    </Row>
  );
}

// ───────────── controls

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'wild' | 'streak' | 'gold';

export function Button({ label, onPress, kind = 'primary', icon, disabled, busy, size = 'md', style }: {
  label: string; onPress?: () => void; kind?: BtnKind; icon?: IconName; disabled?: boolean; busy?: boolean; size?: 'md' | 'lg' | 'sm'; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: color.accent, secondary: color.surface2, ghost: 'transparent', danger: color.bad, wild: color.wild, streak: color.streak, gold: color.gold }[kind];
  const fg = kind === 'secondary' || kind === 'ghost' ? color.text : inkOn(bg);
  const h = size === 'lg' ? 60 : size === 'sm' ? 38 : 50;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, height: h, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        kind === 'ghost' ? { borderWidth: 1, borderColor: color.line } : null,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <Row gap={2}>
          {icon ? <Feather name={icon} size={size === 'sm' ? 16 : 20} color={fg} /> : null}
          <Txt v={size === 'lg' ? 'h2' : 'body'} color={fg} numberOfLines={1}>{label}</Txt>
        </Row>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tint = color.text, bg = color.surface }: { icon: IconName; label: string; onPress: () => void; tint?: string; bg?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}>
      <Feather name={icon} size={20} color={tint} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, sub }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; sub?: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!selected }} accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? { backgroundColor: color.accent, borderColor: color.accent } : null, { opacity: pressed ? 0.8 : 1 }]}>
      {icon ? <Feather name={icon} size={16} color={selected ? color.accentInk : color.textDim} /> : null}
      <Txt v="small" color={selected ? color.accentInk : color.text}>{label}</Txt>
      {sub ? <Txt v="small" color={selected ? color.accentInk : color.textFaint}>{sub}</Txt> : null}
    </Pressable>
  );
}

export function Avatar({ name, tint, size = 36, ring, dim, emoji }: { name: string; tint: string; size?: number; ring?: string; dim?: boolean; emoji?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: emoji ? tint + '33' : tint, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.45 : 1, borderWidth: ring ? 3 : 0, borderColor: ring }}>
      {emoji ? <Text style={{ fontSize: size * 0.56, lineHeight: size * 0.72 }}>{emoji}</Text> : <Text style={{ color: inkOn(tint), fontFamily: font.display, fontSize: size * 0.38 }}>{initials}</Text>}
    </View>
  );
}

export function Banner({ text, tone = 'info', icon }: { text: string; tone?: 'info' | 'warn' | 'bad' | 'good'; icon?: IconName }) {
  const c = { info: color.streak, warn: color.warn, bad: color.bad, good: color.good }[tone];
  return (
    <View style={[styles.banner, { borderColor: c, backgroundColor: c + '1A' }]}>
      <Feather name={icon ?? (tone === 'bad' ? 'alert-triangle' : 'info')} size={18} color={c} />
      <View style={{ flex: 1 }}><Txt v="small">{text}</Txt></View>
    </View>
  );
}

export function Loading() {
  return <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={color.accent} size="large" /></View>;
}

// ───────────── QR

export function QR({ value, size = 180 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    const q = QRCode.create(value, { errorCorrectionLevel: 'M' });
    return { n: q.modules.size, data: q.modules.data as unknown as ArrayLike<number> };
  }, [value]);
  const quiet = 2;
  const total = cells.n + quiet * 2;
  const rects: ReactNode[] = [];
  for (let y = 0; y < cells.n; y++) for (let x = 0; x < cells.n; x++) {
    if (cells.data[y * cells.n + x]) rects.push(<Rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width={1.02} height={1.02} fill={color.text} />);
  }
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: 6 }} accessibilityLabel="QR code">
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        <Rect x={0} y={0} width={total} height={total} fill="#fff" />
        {rects}
      </Svg>
    </View>
  );
}

// ───────────── motion (slow and friendly; off when the phone asks for reduced motion)

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

const native = Platform.OS !== 'web';

/** Pops its child in whenever `trigger` changes. */
export function Pop({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) return;
    v.setValue(0.85);
    Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: native }).start();
  }, [trigger, reduced, v]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** Gentle breathing glow for "your turn". */
export function Pulse({ active, children, style }: { active: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduced) { v.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, reduced, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Counts from the previous value to the new one. Display only — the value comes from the server. */
export function CountUp({ value, style, prefix = '' }: { value: number; style?: StyleProp<TextStyle>; prefix?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced || from.current === value) { setShown(value); from.current = value; return; }
    const start = from.current;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 600);
      setShown(Math.round(start + (value - start) * (1 - (1 - p) ** 3)));
      if (p >= 1) { clearInterval(id); from.current = value; }
    }, 30);
    return () => { clearInterval(id); from.current = value; };
  }, [value, reduced]);
  return <Text style={[{ fontFamily: font.display, color: color.text, fontVariant: ['tabular-nums'] }, style]}>{prefix}{shown}</Text>;
}

/** Falling confetti for the winner. */
export function Confetti({ count = 36 }: { count?: number }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 1400, size: 6 + Math.random() * 8,
    tint: [color.accent, color.wild, color.streak, color.gold][i % 4], rot: Math.random() * 360,
  })), [count]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => <ConfettiPiece key={i} {...p} />)}
    </View>
  );
}

function ConfettiPiece({ left, delay, size, tint, rot }: { left: number; delay: number; size: number; tint: string; rot: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: 4200, delay, easing: Easing.linear, useNativeDriver: native }));
    a.start();
    return () => a.stop();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-40, 820] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: [`${rot}deg`, `${rot + 540}deg`] });
  return <Animated.View style={{ position: 'absolute', top: 0, left: `${left}%`, width: size, height: size * 0.5, borderRadius: 2, backgroundColor: tint, transform: [{ translateY }, { rotate }] }} />;
}

// ───────────── decoration

/** A soft diagonal gradient behind its children (drawn with SVG, no extra package). */
export function Gradient({ from, to, children, style, radius: r = radius.xl }: { from: string; to: string; children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const id = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Round icon plate in a colour. */
export function IconPlate({ icon, tint, size = 44, solid, img }: { icon: IconName; tint: string; size?: number; solid?: boolean; img?: string }) {
  if (img && has3D(img)) {
    // Full-colour 3D icon on a soft plate in the item's colour.
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: tint + (solid ? '40' : '22') }}>
        <Icon3D name={img} size={size * 0.78} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: solid ? tint : tint + '26' }}>
      <Feather name={icon} size={size * 0.48} color={solid ? inkOn(tint) : tint} />
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space(3) }}>
      <Txt v="h2">{title}</Txt>
      {action && onAction ? <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}><Txt v="small" color={color.accent}>{action}</Txt></Pressable> : null}
    </Row>
  );
}

/** Slides and fades content in once, a little after the item before it. */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [v, index, reduced]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  maxWidth: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  footer: { paddingHorizontal: space(4), paddingTop: space(3), backgroundColor: color.bgRaised, borderTopWidth: 1, borderTopColor: color.line, shadowColor: '#294638', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space(4), borderWidth: 1, borderColor: color.line, shadowOffset: { width: 0, height: 6 }, shadowColor: '#294638', shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 },
  btn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(5) },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3.5), height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md, borderWidth: 1 },
});
