import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { api, type Category } from '@/api';
import { recoveryKey, useApp, useLocalized } from '@/app-context';
import { storage } from '@/storage';
import { color, radius, space } from '@/theme';
import { Banner, Button, Chip, Gap, Row, Screen, TopBar, Txt, type IconName } from '@/ui';

const MIN_QUESTIONS = 15;
const ICONS: Record<string, IconName> = {
  globe: 'globe', landmark: 'flag', trophy: 'award', atom: 'aperture', cpu: 'cpu', film: 'film',
  utensils: 'coffee', briefcase: 'briefcase', leaf: 'feather', lightbulb: 'zap',
};

export default function CreateGame() {
  const { t, profile, saveProfile, errorText } = useApp();
  const L = useLocalized();
  const router = useRouter();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>('GET', '/categories')
      .then((c) => { setCats(c); setPicked(c.filter((x) => x.ready > 0).map((x) => x.id)); })
      .catch((e) => setError(errorText(e)));
  }, [errorText]);

  const total = useMemo(() => (cats ?? []).filter((c) => picked.includes(c.id)).reduce((n, c) => n + c.ready, 0), [cats, picked]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const all = (cats ?? []).filter((c) => c.ready > 0).map((c) => c.id);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      if (name.trim() && name.trim() !== profile.name) await saveProfile({ name: name.trim() });
      const g = await api<{ gameId: string; code: string; hostRecoveryCode: string }>('POST', '/games', { categories: picked });
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
        <Row style={{ justifyContent: 'space-between', marginBottom: space(3) }}>
          <Txt v="small" dim>{t('create.totalReady', { n: total })}</Txt>
          <Txt v="small" faint>{t('create.rules', { target: 100, wild: 5 })}</Txt>
        </Row>
        <Button label={t('create.create')} icon="zap" size="lg" onPress={create} busy={busy} disabled={total < MIN_QUESTIONS || !picked.length} />
      </View>
    }>
      <TopBar title={t('create.title')} onBack={() => router.back()} />
      <Txt v="label" faint>{t('create.yourName')}</Txt>
      <Gap h={2} />
      <TextInput
        value={name} onChangeText={setName} maxLength={20} placeholder={t('create.yourName')} placeholderTextColor={color.textFaint}
        style={{ height: 52, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, color: color.text, paddingHorizontal: space(4), fontSize: 16 }}
      />
      <Gap h={6} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" faint>{t('create.categories')}</Txt>
        <Chip label={t('create.selectAll')} selected={picked.length === all.length && all.length > 0} onPress={() => setPicked(picked.length === all.length ? [] : all)} />
      </Row>
      <Gap h={1} />
      <Txt v="small" dim>{t('create.categoriesHint')}</Txt>
      <Gap h={3} />
      <Row wrap gap={2}>
        {(cats ?? []).map((c) => (
          <Chip key={c.id} label={L(c.name)} sub={String(c.ready)} icon={ICONS[c.icon] ?? 'star'} selected={picked.includes(c.id)} onPress={() => toggle(c.id)} />
        ))}
      </Row>
      <Gap h={4} />
      {total < MIN_QUESTIONS && cats ? <Banner tone="warn" text={t('create.needMore', { n: MIN_QUESTIONS })} /> : null}
      {error ? <><Gap h={3} /><Banner tone="bad" text={error} /></> : null}
    </Screen>
  );
}
