import { Icon as Feather } from '@/icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api, type Category } from '@/api';
import { recoveryKey, useApp, useLocalized } from '@/app-context';
import { storage } from '@/storage';
import { catStyle, color, radius, space } from '@/theme';
import { Avatar, Banner, Button, Chip, FadeIn, Gap, IconPlate, Row, Screen, SectionTitle, TopBar, Txt, type IconName } from '@/ui';

const MIN_QUESTIONS = 15;

export default function CreateGame() {
  const { t, profile, saveProfile, errorText, locale } = useApp();
  const L = useLocalized();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>('GET', '/categories')
      .then((c) => {
        setCats(c);
        const ready = c.filter((x) => x.ready > 0).map((x) => x.id);
        // Coming from a category tile: start with that one, the host adds more if needed.
        setPicked(params.category && ready.includes(params.category) ? [params.category] : ready);
      })
      .catch((e) => setError(errorText(e)));
  }, [errorText, params.category]);

  const total = useMemo(() => (cats ?? []).filter((c) => picked.includes(c.id)).reduce((n, c) => n + c.ready, 0), [cats, picked]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const all = (cats ?? []).filter((c) => c.ready > 0).map((c) => c.id);
  const pct = Math.min(1, total / MIN_QUESTIONS);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      if (name.trim() && name.trim() !== profile.name) await saveProfile({ name: name.trim() });
      const g = await api<{ gameId: string; code: string; hostRecoveryCode: string }>('POST', '/games', { categories: picked, answerSeconds: seconds });
      await storage.set(recoveryKey(g.gameId), g.hostRecoveryCode);
      router.replace(`/game/${g.gameId}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={
      <View>
        <Row style={{ justifyContent: 'space-between', marginBottom: space(2) }}>
          <Txt v="small" color={total >= MIN_QUESTIONS ? color.good : color.warn}>{t('create.totalReady', { n: total })}</Txt>
          <Txt v="small" faint>{t('create.rules', { target: 100, wild: 5 })}</Txt>
        </Row>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: total >= MIN_QUESTIONS ? color.good : color.warn }]} /></View>
        <Gap h={3} />
        <Button label={t('create.create')} icon="zap" size="lg" onPress={create} busy={busy} disabled={total < MIN_QUESTIONS || !picked.length} />
      </View>
    }>
      <TopBar title={t('create.title')} onBack={() => router.back()} />

      <FadeIn>
        <Row gap={3}>
          <Avatar name={name || '?'} tint={profile.color} size={52} />
          <View style={{ flex: 1 }}>
            <Txt v="label" faint>{t('create.yourName')}</Txt>
            <Gap h={1} />
            <TextInput
              value={name} onChangeText={setName} maxLength={20} placeholder={t('create.yourName')} placeholderTextColor={color.textFaint}
              style={[styles.input, { textAlign: locale === 'ar' ? 'right' : 'left' }]}
            />
          </View>
        </Row>
      </FadeIn>

      <Gap h={6} />
      <SectionTitle title={t('create.timer')} />
      <Txt v="small" dim style={{ marginTop: -space(2), marginBottom: space(3) }}>{t('create.timerHint')}</Txt>
      <Row gap={2} wrap>
        {[0, 15, 30, 45, 60].map((n) => (
          <Chip key={n} label={n ? t('create.seconds', { n }) : t('create.noTimer')} icon={n ? 'timer-outline' : 'timer-off-outline'} selected={seconds === n} onPress={() => setSeconds(n)} />
        ))}
      </Row>

      <Gap h={6} />
      <SectionTitle title={t('create.categories')} />
      <Row style={{ justifyContent: 'space-between', marginTop: -space(2), marginBottom: space(3) }}>
        <Txt v="small" dim style={{ flex: 1 }}>{t('create.categoriesHint')}</Txt>
        <Chip label={t('create.selectAll')} selected={picked.length === all.length && all.length > 0} onPress={() => setPicked(picked.length === all.length ? [] : all)} />
      </Row>
      <View style={styles.grid}>
        {(cats ?? []).map((c, i) => {
          const st = catStyle(c.id);
          const on = picked.includes(c.id);
          const empty = c.ready === 0;
          return (
            <FadeIn key={c.id} index={i} style={styles.cell}>
              <Pressable disabled={empty} onPress={() => toggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: empty }} accessibilityLabel={L(c.name)}
                style={({ pressed }) => [styles.tile, { borderColor: on ? st.tint : color.line, backgroundColor: on ? st.tint + '22' : color.surface, opacity: empty ? 0.4 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <IconPlate icon={st.icon as IconName} img={c.id} tint={st.tint} size={48} solid={on} />
                  <View style={[styles.check, on ? { backgroundColor: st.tint, borderColor: st.tint } : null]}>
                    {on ? <Feather name="check" size={14} color={color.accentInk} /> : null}
                  </View>
                </Row>
                <Gap h={3} />
                <Txt numberOfLines={2} style={{ fontSize: 15 }}>{L(c.name)}</Txt>
                <Txt v="small" dim>{t('home2.questionsN', { n: c.ready })}</Txt>
              </Pressable>
            </FadeIn>
          );
        })}
      </View>
      <Gap h={4} />
      {total < MIN_QUESTIONS && cats ? <Banner tone="warn" text={t('create.needMore', { n: MIN_QUESTIONS })} /> : null}
      {error ? <><Gap h={3} /><Banner tone="bad" text={error} /></> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { height: 50, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, color: color.text, paddingHorizontal: space(4), fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  cell: { width: '47%', flexGrow: 1 },
  tile: { borderRadius: radius.lg, borderWidth: 1.5, padding: space(3.5), minHeight: 140 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: color.surface2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
