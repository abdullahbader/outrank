import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { api, type Stats } from '@/api';
import { useApp } from '@/app-context';
import { avatarColors, color, radius, space } from '@/theme';
import { Avatar, Button, Card, Gap, Row, Screen, TopBar, Txt } from '@/ui';

export default function Profile() {
  const { t, profile, saveProfile, locale } = useApp();
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [tint, setTint] = useState(profile.color);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { api<Stats>('GET', '/devices/me/stats').then(setStats).catch(() => {}); }, []);

  const save = async () => {
    await saveProfile({ name: name.trim(), color: tint });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const tiles: [string, string][] = stats ? [
    [t('profile.played'), String(stats.gamesPlayed)],
    [t('profile.won'), String(stats.gamesWon)],
    [t('profile.winRate'), `${stats.winRate}%`],
    [t('profile.best'), String(stats.highestScore)],
    [t('profile.average'), String(stats.averageScore)],
  ] : [];

  return (
    <Screen>
      <TopBar title={t('profile.title')} onBack={() => router.back()} />
      <Row gap={4}>
        <Avatar name={name || '?'} tint={tint} size={72} />
        <View style={{ flex: 1 }}>
          <Txt v="label" faint>{t('profile.name')}</Txt>
          <Gap h={2} />
          <TextInput value={name} onChangeText={setName} maxLength={20} placeholderTextColor={color.textFaint} placeholder={t('profile.name')}
            style={{ height: 48, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, color: color.text, paddingHorizontal: space(3), fontSize: 16 }} />
        </View>
      </Row>
      <Gap h={4} />
      <Txt v="label" faint>{t('profile.color')}</Txt>
      <Gap h={2} />
      <Row wrap gap={2}>
        {avatarColors.map((c) => (
          <Pressable key={c} accessibilityRole="radio" accessibilityState={{ selected: c === tint }} accessibilityLabel={c} onPress={() => setTint(c)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: c === tint ? 3 : 0, borderColor: color.text }} />
        ))}
      </Row>
      <Gap h={4} />
      <Button label={saved ? t('profile.saved') : t('profile.save')} icon={saved ? 'check' : 'save'} onPress={save} disabled={!name.trim()} />

      <Gap h={8} />
      <Txt v="label" faint>{t('profile.stats')}</Txt>
      <Gap h={3} />
      <Row wrap gap={3}>
        {tiles.map(([label, value]) => (
          <Card key={label} style={{ flexGrow: 1, flexBasis: '30%', padding: space(3) }}>
            <Txt v="title">{value}</Txt>
            <Txt v="small" dim>{label}</Txt>
          </Card>
        ))}
      </Row>

      <Gap h={8} />
      <Txt v="label" faint>{t('profile.history')}</Txt>
      <Gap h={3} />
      {stats && !stats.recent.length ? <Txt dim>{t('profile.noHistory')}</Txt> : null}
      {stats?.recent.map((g) => (
        <Row key={g.gameId} style={{ paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: color.line }}>
          <View style={{ flex: 1 }}>
            <Txt>{new Date(g.at).toLocaleDateString(locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Txt>
            <Txt v="small" dim>{t('profile.rank', { rank: g.rank })}{g.won ? ` · ${t('profile.winner')}` : ''}</Txt>
          </View>
          <Txt v="number" color={g.won ? color.gold : color.text}>{g.score}</Txt>
        </Row>
      ))}
    </Screen>
  );
}
