# 12 — Test launch: server on Render + Neon, APK for friends

Goal: friends anywhere can install an APK and play, with the game server on the internet.

| Piece | Where | Cost |
|---|---|---|
| Game server (API + live updates) | Render web service `outrank-game` (https://outrank-g6mn.onrender.com), Ohio, free plan | Free (sleeps after 15 min idle; first player waits ~1 min) |
| Database | Neon PostgreSQL, AWS US East 2 (Ohio) | Free |
| App | APK built by Expo (EAS), profile `preview` | Free plan |

## Files

- `render.yaml` — Render blueprint: build `npm run render:build`, start `npm run render:start`
  (runs migrations, imports the question set — re-running changes nothing — then starts the API),
  health check `/health`, Node 24, `NODE_ENV=staging`, `DEV_TOOLS=true` (practice mode and test
  players stay on for the test). `DATABASE_URL` is entered in Render, never committed.
- `apps/mobile/eas.json` — `preview` profile builds an installable **APK** and bakes in
  `EXPO_PUBLIC_API_URL` (the Render address).
- `apps/mobile/assets/` — app icon, Android adaptive icon, splash, favicon.

## Steps

1. **GitHub**: create an empty private repository (no README). The code is pushed there.
2. **Neon**: new project `outrank`, region *AWS Europe Central 1 (Frankfurt)*. Copy the
   **direct** connection string (not the "pooled" one). It looks like
   `postgresql://…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require`. Keep it private.
3. **Render**: sign in with GitHub → New → Blueprint → choose the repository → paste the Neon
   string into `DATABASE_URL` → Apply. First deploy ≈ 5–8 min. The address will be
   `https://outrank-g6mn.onrender.com` (or similar if taken). Check `…/health` shows `{"ok":true}`.
4. **Expo**: sign in once with `npx eas-cli@latest login` in `apps/mobile`, then
   `npx eas-cli@latest build -p android --profile preview`. The build page gives a link and QR code
   to share; friends open it on Android and install (allow "install unknown apps").

If Render gives a different address, update `EXPO_PUBLIC_API_URL` in `eas.json` before building.

## For the real launch later

`NODE_ENV=production`, `DEV_TOOLS=false` (the server refuses to start with test tools on in
production), a paid always-on plan, and the owner's verified question list instead of TEST DATA.
