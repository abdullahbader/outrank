// Outrank visual identity: a dark party-game look with one electric accent and card colours.
// Change the brand here; every screen reads these tokens.

export const color = {
  // "Modern Fresh" palette (owner, 2026-11-21)
  bg: '#F5F8F3',          // background
  bgRaised: '#FFFFFF',
  surface: '#FFFFFF',     // cards
  surface2: '#DCEBDD',    // soft green: quiet fills, secondary buttons, empty slots
  line: '#E3E9E1',        // borders
  text: '#294638',
  textDim: '#5C7568',
  textFaint: '#93A79B',

  accent: '#3F8F65',      // primary green: main actions, current turn
  accentInk: '#FFFFFF',   // text on the primary green and other strong fills
  gold: '#E8C66A',        // muted gold: rank 10, winner
  streak: '#75AFC5',      // muted blue: Streak card
  wild: '#D4876F',        // muted coral (chosen to match): Wild card
  good: '#3F8F65',        // correct
  bad: '#C8614F',         // muted red (chosen to match): wrong, ranks 11–12
  warn: '#D9A441',
} as const;

/** Light colours (gold, blue) used as text on white are darkened so they stay readable. White stays white. */
export function readableText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.58 || lum > 0.95) return hex;
  const k = 0.62;
  const h = (x: number) => Math.round(x * k).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

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

export const avatarColors = ['#3F8F65', '#75AFC5', '#E8C66A', '#D4876F', '#8E7CC3', '#5E9E8F', '#C8614F', '#6F8FB8', '#B5A04A', '#A0789A'];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

/** Each category's colour and icon (Feather names). Unknown categories fall back to the accent. */
export const categoryStyle: Record<string, { tint: string; icon: string }> = {
  geography: { tint: '#75AFC5', icon: 'earth' },
  history: { tint: '#C9A24D', icon: 'pillar' },
  sports: { tint: '#3F8F65', icon: 'soccer' },
  science: { tint: '#8E7CC3', icon: 'flask' },
  technology: { tint: '#6F8FB8', icon: 'laptop' },
  entertainment: { tint: '#D4876F', icon: 'movie-open' },
  food: { tint: '#C97B4A', icon: 'food-apple' },
  business: { tint: '#B5A04A', icon: 'briefcase' },
  nature: { tint: '#5E9E8F', icon: 'leaf' },
  general: { tint: '#7A9A5C', icon: 'lightbulb-on' },
};
export const catStyle = (id: string) => categoryStyle[id] ?? { tint: color.accent, icon: 'star' };

export const shadow = {
  soft: { shadowColor: '#294638', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
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
