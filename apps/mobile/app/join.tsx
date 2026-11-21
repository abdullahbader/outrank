import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { api } from '@/api';
import { recoveryKey, useApp } from '@/app-context';
import { storage } from '@/storage';
import { color, radius, space } from '@/theme';
import { Banner, Button, Card, Gap, ltr, Row, Screen, TopBar, Txt } from '@/ui';

interface Preview { gameId: string; code: string; status: string; hostName: string | null; playerCount: number; maxPlayers: number }

export default function JoinGame() {
  const { t, profile, saveProfile, errorText } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [name, setName] = useState(profile.name);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recovery, setRecovery] = useState('');

  useEffect(() => {
    setPreview(null);
    setError(null);
    if (code.length !== 6) return;
    let live = true;
    api<Preview>('GET', `/games/by-code/${code}`)
      .then((p) => live && setPreview(p))
      .catch((e) => live && setError(errorText(e)));
    return () => { live = false; };
  }, [code, errorText]);

  const join = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/games/${preview.gameId}/join`, { name: name.trim() });
      if (name.trim() !== profile.name) await saveProfile({ name: name.trim() });
      router.replace(`/game/${preview.gameId}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const recover = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/games/${preview.gameId}/host/recover`, { recoveryCode: recovery });
      await storage.set(recoveryKey(preview.gameId), recovery);
      router.replace(`/game/${preview.gameId}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const input = { height: 56, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, color: color.text, paddingHorizontal: space(4) };

  return (
    <Screen footer={<Button label={t('join.join')} icon="log-in" size="lg" onPress={join} busy={busy} disabled={!preview || !name.trim()} />}>
      <TopBar title={t('join.title')} onBack={() => router.back()} />
      <Txt v="label" faint>{t('join.code')}</Txt>
      <Gap h={2} />
      <TextInput
        value={code}
        onChangeText={(s) => setCode(s.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))}
        autoCapitalize="characters" autoCorrect={false} placeholder="ABC123" placeholderTextColor={color.textFaint}
        accessibilityLabel={t('join.code')}
        style={[input, { fontSize: 30, letterSpacing: 8, textAlign: 'center', fontFamily: 'Sora_700Bold', writingDirection: 'ltr' }]}
      />
      <Gap h={2} />
      <Txt v="small" faint center>{t('join.codeHint')}</Txt>
      <Gap h={3} />
      <Button label={t('join.scan')} icon="camera" kind="ghost" onPress={() => router.push('/scan')} />

      {preview ? (
        <>
          <Gap h={5} />
          <Card glow={color.streak}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="title">{ltr(preview.code)}</Txt>
              <Txt v="small" dim>{t('join.players', { n: preview.playerCount })}</Txt>
            </Row>
            {preview.hostName ? <Txt v="small" dim>{t('join.hostedBy', { name: preview.hostName })}</Txt> : null}
          </Card>
          <Gap h={5} />
          <Txt v="label" faint>{t('join.name')}</Txt>
          <Gap h={2} />
          <TextInput value={name} onChangeText={setName} maxLength={20} placeholder={t('join.name')} placeholderTextColor={color.textFaint} style={[input, { fontSize: 18 }]} />
          <Gap h={6} />
          {recovering ? (
            <Card>
              <Txt v="label" faint>{t('join.recoverCode')}</Txt>
              <Gap h={2} />
              <TextInput value={recovery} onChangeText={(s) => setRecovery(s.toUpperCase().slice(0, 12))} autoCapitalize="characters" autoCorrect={false}
                placeholderTextColor={color.textFaint} placeholder="ABCD2345" style={[input, { fontSize: 20, letterSpacing: 4, textAlign: 'center', writingDirection: 'ltr' }]} />
              <Gap h={3} />
              <Button label={t('join.recover')} icon="key" kind="secondary" busy={busy} disabled={recovery.length < 4} onPress={recover} />
            </Card>
          ) : (
            <Pressable onPress={() => setRecovering(true)} accessibilityRole="button"><Txt v="small" color={color.textDim} center>{t('join.recoverLink')}</Txt></Pressable>
          )}
        </>
      ) : null}
      {error ? <View style={{ marginTop: space(4) }}><Banner tone="bad" text={error} /></View> : null}
    </Screen>
  );
}
