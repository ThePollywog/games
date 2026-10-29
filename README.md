# Pollywog Arcade

An ad-free puzzle arcade with real leaderboards: **Water Sort**, **Ball Sort**, **Nuts & Bolts** and **Hexa Stack**.

```bash
npm install
npm run dev        # Vite on :5173 + leaderboard API on :8787 (proxied at /api)
npm test           # engine, generator, solver and score-verification tests
npm run build && npm start   # production: one Node process serves dist/ + API on :8787
```

GitHub Pages: `npm run pages` builds a static site in `dist-pages/` with the arcade at the root, each game at `/<game-id>/` and the App Store support and privacy page at `/support/`. It has no leaderboard server, so progress stays in the browser. `.github/workflows/pages.yml` builds and deploys it on every push to `main`.

iOS: each game ships as its own App Store app from The Pollywog (Shipshape, Buoy Oh Buoy, Knots & Bolts, Hex Marks the Spot); see [IOS.md](IOS.md). The apps use Game Center leaderboards only; the server is for the web build.

Requires Node 24+ (runs TypeScript natively and uses the built-in `node:sqlite`). Data lives in `data/arcade.db` (override with `DB_FILE`).

## Games

| Game | Twist | Modes and leaderboards |
| --- | --- | --- |
| Water Sort | Pour whole runs of liquid; mystery layers from level 24 | Campaign, Daily, Blitz (weekly), Zen |
| Ball Sort | One ball per move, so every move counts against par | Campaign, Daily, Blitz (weekly), Zen |
| Nuts & Bolts | Bolts of different heights; from level 12 there's only one spare bolt | Campaign, Daily, Blitz (weekly), Zen |
| Hexa Stack | Place hex stacks; matching neighbours merge; 10 of a color clears; chains multiply; a stone drops every 20 placements | Endless (weekly), Daily |

The three sort games share one engine (`shared/sort`), one set of screens and one board component with three looks (`liquid`, `balls`, `nuts`). Each game's level curves, dailies and Blitz ramps are in `shared/sort/levels.ts`; its copy, tips and chapters are in `src/games/registry.ts`.

Shared across all games:
- **No ads.** Undo is free. Hints, extra tubes, hammers and shuffles cost coins you earn by playing.
- Combos, stars against a solver-computed par, and chain clears in Hexa.
- XP and player levels, coins, daily streaks, 34 achievements and a palette shop (palettes apply to every game).
- Moves can overlap: queue up a second pour or move while the first is still animating.
- Color-blind symbols, reduced motion, synthesized sound, haptics, and installs as a PWA.

## Architecture

```
shared/sort/         sort-puzzle core (Water/Ball/Nuts), used by BOTH browser and server
  engine.ts          move rules: run vs single moves, per-tube heights, mystery reveal
  solver.ts          weighted A*: level validation, par, and hints
  levels.ts          per-game seeded generation and difficulty curves
  session.ts         a play-through as an action log (+ replay)
  scoring.ts / verify.ts
shared/hexa/         Hexa Stack engine, seeded pieces, replay + verification
server/              node:http + node:sqlite leaderboard API
src/platform/        game-agnostic profile, XP, coins, streaks, achievements, API
src/games/           game registry, sort board (3 skins), rewards
src/screens/         hub, sort/ (home, play, blitz) and hexa/ (home, play)
```

**Anti-cheat:** the client never posts a score. It posts its action log. The server rebuilds the level from its seed, replays every move with the same engine, rejects illegal or unsolved logs and impossibly fast times, then computes the score itself. XP and campaign boards are self-reported (with bounds).

**Adding a game:** a new sort variant is mostly a config entry in `shared/sort/levels.ts` plus metadata in `src/games/registry.ts`. A brand-new game (like Hexa) needs its pure logic in `shared/<game>/`, a verify route in `server/index.ts`, and screens; profile, streaks, achievements and leaderboards come for free.
