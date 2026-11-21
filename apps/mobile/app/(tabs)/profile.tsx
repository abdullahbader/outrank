import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { api } from '@/api';
import { useApp } from '@/app-context';
import { avatarColors, color, radius, space } from '@/theme';
import { Avatar, Button, Card, FadeIn, Gap, IconPlate, Row, Screen, SectionTitle, Txt } from '@/ui';

interface AppConfig { support: { whatsapp: string | null; email: string | null } }

export default function Profile() {
  const { t, profile, saveProfile, locale, setLocale } = useApp();
  const [name, setName] = useState(profile.name);
  const [tint, setTint] = useState(profile.color);
  const [saved, setSaved] = useState(false);
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => { api<AppConfig>('GET', '/app-config').then(setCfg).catch(() => {}); }, []);
  const dirty = name.trim() !== profile.name || tint !== profile.color;

  const save = async () => {
    await saveProfile({ name: name.trim(), color: tint });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const wa = cfg?.support.whatsapp;
  const mail = cfg?.support.email;

  return (
    <Screen>
      <Txt v="title">{t('profile.title')}</Txt>
      <Gap h={5} />
      <FadeIn>
        <Card style={{ alignItems: 'center', paddingVertical: space(6) }} glow={tint}>
          <Avatar name={name || '?'} tint={tint} size={92} />
          <Gap h={3} />
          <Txt v="title">{name || '—'}</Txt>
        </Card>
      </FadeIn>

      <Gap h={6} />
      <FadeIn index={1}>
        <SectionTitle title={t('profile.name')} />
        <TextInput value={name} onChangeText={setName} maxLength={20} placeholderTextColor={color.textFaint} placeholder={t('profile.name')}
          style={{ height: 52, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, color: color.text, paddingHorizontal: space(4), fontSize: 16, textAlign: locale === 'ar' ? 'right' : 'left' }} />
        <Gap h={5} />
        <SectionTitle title={t('profile.color')} />
        <Row wrap gap={3}>
          {avatarColors.map((c) => (
            <Pressable key={c} accessibilityRole="radio" accessibilityState={{ selected: c === tint }} accessibilityLabel={c} onPress={() => setTint(c)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: c === tint ? 3 : 0, borderColor: color.text, alignItems: 'center', justifyContent: 'center' }} />
          ))}
        </Row>
        <Gap h={4} />
        <Button label={saved ? t('profile.saved') : t('profile.save')} icon={saved ? 'check' : 'save'} onPress={save} disabled={!name.trim() || (!dirty && !saved)} />
      </FadeIn>

      <Gap h={8} />
      <FadeIn index={2}>
        <SectionTitle title={t('profile2.language')} />
        <Row gap={2}>
          {(['ar', 'en'] as const).map((l) => (
            <Pressable key={l} onPress={() => setLocale(l)} accessibilityRole="radio" accessibilityState={{ selected: locale === l }}
              style={{ flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: locale === l ? color.accent : color.surface, borderWidth: 1, borderColor: locale === l ? color.accent : color.line }}>
              <Txt color={locale === l ? color.accentInk : color.text}>{l === 'ar' ? 'العربية' : 'English'}</Txt>
            </Pressable>
          ))}
        </Row>
      </FadeIn>

      {wa || mail ? (
        <>
          <Gap h={8} />
          <FadeIn index={3}>
            <SectionTitle title={t('profile2.support')} />
            <Card style={{ padding: space(2) }}>
              {wa ? (
                <Pressable onPress={() => Linking.openURL(`https://wa.me/${wa.replace(/[^0-9]/g, '')}`)} accessibilityRole="link" style={{ padding: space(2) }}>
                  <Row gap={3}><IconPlate icon="message-circle" tint={color.good} size={40} /><Txt>{t('profile2.whatsapp')}</Txt></Row>
                </Pressable>
              ) : null}
              {mail ? (
                <Pressable onPress={() => Linking.openURL(`mailto:${mail}`)} accessibilityRole="link" style={{ padding: space(2) }}>
                  <Row gap={3}><IconPlate icon="mail" tint={color.streak} size={40} /><Txt>{t('profile2.email')}</Txt></Row>
                </Pressable>
              ) : null}
            </Card>
          </FadeIn>
        </>
      ) : null}

      <Gap h={6} />
      <Txt v="small" faint center>{t('profile2.version', { v: Constants.expoConfig?.version ?? '0.1.0' })}</Txt>
    </Screen>
  );
}
