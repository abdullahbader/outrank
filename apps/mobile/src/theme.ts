// Outrank visual identity: a dark party-game look with one electric accent and card colours.
// Change the brand here; every screen reads these tokens.

export const color = {
  bg: '#0D0A1C',
  bgRaised: '#15112B',
  surface: '#1C1736',
  surface2: '#262046',
  line: '#332B5C',
  text: '#F6F4FF',
  textDim: '#ABA5CF',
  textFaint: '#726B9A',

  accent: '#C8FF3E',      // primary actions, current turn
  accentInk: '#0D0A1C',   // text on accent
  wild: '#FF4F9A',        // Wild card
  streak: '#3ED8FF',      // Streak card
  gold: '#FFC94A',        // rank 10, winner
  good: '#3EF0A6',        // correct
  bad: '#FF5C6C',         // wrong, negative ranks
  warn: '#FFB23E',
} as const;

/** Colour of an answer slot by its rank: 1–9 climb, 10 is gold, 11–12 are danger. */
export function rankColor(rank: number): string {
  if (rank === 10) return color.gold;
  if (rank >= 11) return color.bad;
  return color.accent;
}

export const avatarColors = ['#FF4F9A', '#3ED8FF', '#C8FF3E', '#FFC94A', '#B58CFF', '#FF8A3D', '#3EF0A6', '#FF5C6C', '#6C8CFF', '#F2E94E'];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

/** Each category's colour and icon (Feather names). Unknown categories fall back to the accent. */
export const categoryStyle: Record<string, { tint: string; icon: string }> = {
  geography: { tint: '#3ED8FF', icon: 'globe' },
  history: { tint: '#FFB23E', icon: 'book-open' },
  sports: { tint: '#3EF0A6', icon: 'award' },
  science: { tint: '#B58CFF', icon: 'aperture' },
  technology: { tint: '#6C8CFF', icon: 'cpu' },
  entertainment: { tint: '#FF4F9A', icon: 'film' },
  food: { tint: '#FF8A3D', icon: 'coffee' },
  business: { tint: '#F2E94E', icon: 'trending-up' },
  nature: { tint: '#7BE36A', icon: 'feather' },
  general: { tint: '#C8FF3E', icon: 'zap' },
};
export const catStyle = (id: string) => categoryStyle[id] ?? { tint: color.accent, icon: 'star' };

export const shadow = {
  soft: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  glow: (c: string) => ({ shadowColor: c, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 6 }, elevation: 8 }),
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
