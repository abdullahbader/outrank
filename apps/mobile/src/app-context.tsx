import { isRtl, translate, type AppLocale } from '@outrank/i18n';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { api, ApiError, setApiToken } from './api';
import { storage } from './storage';
import { avatarColors } from './theme';

const K = { token: 'outrank.token', locale: 'outrank.locale', name: 'outrank.name', color: 'outrank.color' };

export interface Profile { deviceId: string | null; name: string; color: string }

interface AppState {
  ready: boolean;
  online: boolean;
  locale: AppLocale;
  rtl: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: AppLocale) => void;
  profile: Profile;
  saveProfile: (p: Partial<Pick<Profile, 'name' | 'color'>>) => Promise<void>;
  errorText: (e: unknown) => string;
  retry: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/**
 * Language, direction and the phone's guest identity. Arabic is the default unless the phone is
 * in English. Direction is set on a root view (not I18nManager), so switching needs no restart.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ar');
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [profile, setProfile] = useState<Profile>({ deviceId: null, name: '', color: avatarColors[0] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    (async () => {
      const stored = (await storage.get(K.locale)) as AppLocale | null;
      const device: AppLocale = getLocales()[0]?.languageCode === 'en' ? 'en' : 'ar';
      const l = stored === 'en' || stored === 'ar' ? stored : device;
      setLocaleState(l);
      applyDirection(l);
      const name = (await storage.get(K.name)) ?? '';
      const colorStored = (await storage.get(K.color)) ?? avatarColors[Math.floor(Math.random() * avatarColors.length)];
      let token = await storage.get(K.token);
      let deviceId: string | null = null;
      try {
        if (token) {
          setApiToken(token);
          try {
            deviceId = (await api<{ deviceId: string }>('GET', '/devices/me')).deviceId;
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) token = null; // server forgot us: start fresh
            else throw e;
          }
        }
        if (!token) {
          const created = await api<{ deviceId: string; token: string }>('POST', '/devices', { locale: l, ...(name ? { displayName: name.slice(0, 20) } : {}) });
          token = created.token;
          deviceId = created.deviceId;
          await storage.set(K.token, token);
          setApiToken(token);
        }
        setOnline(true);
      } catch {
        setOnline(false);
      }
      await storage.set(K.color, colorStored);
      setProfile({ deviceId, name, color: colorStored });
      setReady(true);
    })();
  }, [attempt]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    applyDirection(l);
    storage.set(K.locale, l);
    api('PATCH', '/devices/me', { locale: l }).catch(() => {});
  }, []);

  const saveProfile = useCallback(async (p: Partial<Pick<Profile, 'name' | 'color'>>) => {
    const name = p.name?.trim();
    if (name !== undefined) await storage.set(K.name, name);
    if (p.color) await storage.set(K.color, p.color);
    setProfile((old) => ({ ...old, ...(name !== undefined ? { name } : {}), ...(p.color ? { color: p.color } : {}) }));
    await api('PATCH', '/devices/me', { ...(name ? { displayName: name.slice(0, 20) } : {}), ...(p.color ? { avatarColor: p.color } : {}) }).catch(() => {});
  }, []);

  const errorText = useCallback((e: unknown) => {
    const code = e instanceof ApiError ? e.code : typeof e === 'string' ? e : null;
    if (code === 'OFFLINE') return t('common.offline');
    if (code) {
      const s = t(`errors.${code}`);
      if (s !== `errors.${code}`) return s;
    }
    return t('common.somethingWrong');
  }, [t]);

  const value = useMemo<AppState>(() => ({
    ready, online, locale, rtl: isRtl(locale), t, setLocale, profile, saveProfile, errorText,
    retry: () => { setReady(false); setAttempt((n) => n + 1); },
  }), [ready, online, locale, t, setLocale, profile, saveProfile, errorText]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function applyDirection(l: AppLocale) {
  if (Platform.OS === 'web') {
    const html = globalThis.document?.documentElement;
    if (html) { html.lang = l; html.dir = isRtl(l) ? 'rtl' : 'ltr'; }
    return;
  }
  I18nManager.allowRTL(false);
  if (I18nManager.isRTL) I18nManager.forceRTL(false);
}

/** Lays out children right-to-left for Arabic. Wrap the root and every Modal's content. */
export function DirectionRoot({ children }: { children: ReactNode }) {
  const { rtl } = useApp();
  return <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>{children}</View>;
}

/** Text in the viewer's language from a {en, ar} pair. */
export function useLocalized() {
  const { locale } = useApp();
  return (v: { en: string; ar?: string } | null | undefined) => (v ? (locale === 'ar' && v.ar ? v.ar : v.en) : '');
}

export const recoveryKey = (gameId: string) => `outrank.recovery.${gameId}`;
