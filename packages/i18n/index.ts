// Every visible string lives here (en.json + ar.json, same keys).
import en from './en.json';
import ar from './ar.json';

export type AppLocale = 'en' | 'ar';
export const dictionaries = { en, ar } as const;
export const isRtl = (l: AppLocale) => l === 'ar';

type Dict = { [k: string]: string | Dict };

/** "game.turn" + {name} → "Sara's turn". Falls back to English, then to the key. */
export function translate(locale: AppLocale, key: string, vars?: Record<string, string | number>): string {
  const find = (d: Dict) => key.split('.').reduce<string | Dict | undefined>((n, k) => (n && typeof n === 'object' ? n[k] : undefined), d);
  let s = find(dictionaries[locale] as Dict);
  if (typeof s !== 'string') s = find(dictionaries.en as Dict);
  if (typeof s !== 'string') return key;
  return vars ? s.replace(/\{\{(\w+)\}\}/g, (_, v) => (vars[v] !== undefined ? String(vars[v]) : '')) : s;
}
