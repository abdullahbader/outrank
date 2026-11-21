// Runtime settings, read once. Game rules live in the engine config; these are server behaviours.

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 3300),
  production: process.env.NODE_ENV === 'production',
  devTools: process.env.DEV_TOOLS === 'true',
  /** How long the host may be offline before the game pauses itself. */
  hostGraceMs: num(process.env.HOST_GRACE_MS, 20_000),
  /** Questions prepared per game (all that exist, up to this). */
  questionsPerGame: num(process.env.QUESTIONS_PER_GAME, 60),
  minQuestions: num(process.env.GAME_MIN_QUESTIONS, 15),
  maxPlayers: num(process.env.GAME_MAX_PLAYERS, 16),
  targetScore: num(process.env.GAME_TARGET_SCORE, 100),
  joinAttemptsPerMinute: num(process.env.JOIN_ATTEMPTS_PER_MINUTE, 20),
};

export function assertSafeConfig() {
  if (config.production && config.devTools) {
    throw new Error('DEV_TOOLS=true is not allowed when NODE_ENV=production. Refusing to start.');
  }
}
