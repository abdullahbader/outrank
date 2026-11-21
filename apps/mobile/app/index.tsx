import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api, type ActiveGame } from '@/api';
import { useApp } from '@/app-context';
import { color, radius, rankColor, space } from '@/theme';
import { Avatar, Card, Gap, ltr, Row, Screen, Txt, type IconName } from '@/ui';

export default function Home() {
  const { t, locale, setLocale, profile } = useApp();
  const router = useRouter();
  const [active, setActive] = useState<ActiveGame[]>([]);

  useFocusEffect(useCallback(() => {
    api<ActiveGame[]>('GET', '/devices/me/active-games').then(setActive).catch(() => setActive([]));
  }, []));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.profile')} onPress={() => router.push('/profile')}>
          <Avatar name={profile.name || '?'} tint={profile.color} size={44} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')} style={styles.lang}>
          <Feather name="globe" size={16} color={color.textDim} />
          <Txt v="small" dim>{t('common.language')}</Txt>
        </Pressable>
      </Row>

      <Gap h={8} />
      <Ladder />
      <Gap h={5} />
      <Txt v="hero">{t('app.name')}</Txt>
      <Txt dim>{t('app.tagline')}</Txt>
      <Gap h={8} />

      {active.map((g) => (
        <Pressable key={g.gameId} onPress={() => router.push(`/game/${g.gameId}`)} accessibilityRole="button">
          <Card glow={color.accent} style={{ marginBottom: space(3) }}>
            <Row>
              <Feather name="play-circle" size={24} color={color.accent} />
              <View style={{ flex: 1 }}>
                <Txt v="h2">{t('home.rejoin')}</Txt>
                <Txt v="small" dim>{t(g.role === 'host' ? 'home.rejoinHost' : 'home.rejoinPlayer', { code: ltr(g.code) })}</Txt>
              </View>
            </Row>
          </Card>
        </Pressable>
      ))}

      <BigAction icon="zap" title={t('home.create')} hint={t('home.createHint')} tint={color.accent} onPress={() => router.push('/create')} />
      <Gap h={3} />
      <BigAction icon="log-in" title={t('home.join')} hint={t('home.joinHint')} tint={color.streak} onPress={() => router.push('/join')} />

      <Gap h={8} />
      <Txt v="label" faint>{t('home.how')}</Txt>
      <Gap h={3} />
      {(['how1', 'how2', 'how3', 'how4'] as const).map((k, i) => (
        <Row key={k} gap={3} style={{ marginBottom: space(3), alignItems: 'flex-start' }}>
          <View style={[styles.step, { borderColor: [color.accent, color.streak, color.gold, color.wild][i] }]}>
            <Txt v="number" style={{ fontSize: 14 }}>{i + 1}</Txt>
          </View>
          <View style={{ flex: 1 }}><Txt dim>{t(`home.${k}`)}</Txt></View>
        </Row>
      ))}
    </Screen>
  );
}

function BigAction({ icon, title, hint, tint, onPress }: { icon: IconName; title: string; hint: string; tint: string; onPress: () => void }) {
  const { rtl } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={[styles.big, { borderColor: tint + '55' }]}>
        <View style={[styles.plate, { backgroundColor: tint }]}><Feather name={icon} size={26} color={color.accentInk} /></View>
        <View style={{ flex: 1 }}>
          <Txt v="title" style={{ fontSize: 22 }}>{title}</Txt>
          <Txt v="small" dim>{hint}</Txt>
        </View>
        <Feather name={rtl ? 'chevron-left' : 'chevron-right'} size={24} color={color.textDim} />
      </View>
    </Pressable>
  );
}

/** The brand mark: a 12-step ranking ladder, gold at 10, red at 11–12. */
function Ladder() {
  return (
    <Row gap={1.5} style={{ alignItems: 'flex-end', height: 64 }}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={{ width: 14, height: 16 + (11 - i) * 4, borderRadius: 4, backgroundColor: rankColor(i + 1), opacity: i < 9 ? 0.35 + (9 - i) * 0.07 : 1 }} />
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line },
  big: { flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(4), borderRadius: radius.xl, backgroundColor: color.surface, borderWidth: 1 },
  plate: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  step: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
