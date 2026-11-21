// Outrank visual identity: a dark party-game look with one electric accent and card colours.
// Change the brand here; every screen reads these tokens.

export const color = {
  bg: '#F5F3FF',          // soft lavender-white page
  bgRaised: '#FFFFFF',
  surface: '#FFFFFF',     // cards
  surface2: '#EFEBFC',    // quiet fills (secondary buttons, empty slots)
  line: '#E4DEF7',
  text: '#17122F',
  textDim: '#5D5781',
  textFaint: '#9690B6',

  accent: '#6C3BFF',      // primary actions, current turn
  accentInk: '#FFFFFF',   // text on accent and other strong fills
  wild: '#E83E8C',        // Wild card
  streak: '#0EA5E9',      // Streak card
  gold: '#F59E0B',        // rank 10, winner
  good: '#12B76A',        // correct
  bad: '#E5484D',         // wrong, negative ranks
  warn: '#F79009',
} as const;

/** Readable text colour (dark or white) on a given fill. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return color.accentInk;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.68 ? color.text : '#FFFFFF';
}

/** Colour of an answer slot by its rank: 1–9 climb, 10 is gold, 11–12 are danger. */
export function rankColor(rank: number): string {
  if (rank === 10) return color.gold;
  if (rank >= 11) return color.bad;
  return color.accent;
}

export const avatarColors = ['#E83E8C', '#0EA5E9', '#7C3AED', '#F59E0B', '#10B981', '#F97316', '#6366F1', '#EF4444', '#14B8A6', '#D946EF'];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

/** Each category's colour and icon (Feather names). Unknown categories fall back to the accent. */
export const categoryStyle: Record<string, { tint: string; icon: string }> = {
  geography: { tint: '#0EA5E9', icon: 'globe' },
  history: { tint: '#F59E0B', icon: 'book-open' },
  sports: { tint: '#10B981', icon: 'award' },
  science: { tint: '#8B5CF6', icon: 'aperture' },
  technology: { tint: '#6366F1', icon: 'cpu' },
  entertainment: { tint: '#E83E8C', icon: 'film' },
  food: { tint: '#F97316', icon: 'coffee' },
  business: { tint: '#CA8A04', icon: 'trending-up' },
  nature: { tint: '#16A34A', icon: 'feather' },
  general: { tint: '#7C3AED', icon: 'zap' },
};
export const catStyle = (id: string) => categoryStyle[id] ?? { tint: color.accent, icon: 'star' };

export const shadow = {
  soft: { shadowColor: '#3B2A8C', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  glow: (c: string) => ({ shadowColor: c, shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 6 }, elevation: 8 }),
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const space = (n: number) => n * 4;

export const font = {
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  body: 'Manrope_600SemiBold',
  bodyMedium: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  ar: 'IBMPlexSansArabic_500Medium',
  arBold: 'IBMPlexSansArabic_700Bold',
} as const;
