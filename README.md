# Pollywog Arcade

Four ad-free nautical puzzle games from **The Pollywog**: **Shipshape** (bottle sort), **Buoy Oh Buoy** (ball sort), **Knots & Bolts** (rope sort) and **Hex Marks the Spot** (hex stacking). They ship together as the Pollywog Arcade on the web and as four separate iOS apps.

```bash
npm install
npm run dev        # Vite on :5173 + leaderboard API on :8787 (proxied at /api)
npm test           # engine, generator, solver and score-verification tests
npm run build && npm start   # production: one Node process serves dist/ + API on :8787
npm run pages      # static GitHub Pages site in dist-pages/
npm run ios -- build         # the four iOS apps; see IOS.md
```

Requires Node 24+ (runs TypeScript natively and uses the built-in `node:sqlite`). Leaderboard data lives in `data/arcade.db` (override with `DB_FILE`).

## Where it runs

| Build | What it is | Leaderboards |
| --- | --- | --- |
| Web server (`npm run build && npm start`) | The arcade with all four games | This repo's verified leaderboard server |
| GitHub Pages (`npm run pages`) | The arcade at the site root, each game alone at `/<game-id>/`, and the App Store support and privacy page at `/support/` | None. Progress stays in the browser and the leaderboard screens say so |
| iOS (`npm run ios`) | One App Store app per game; see [IOS.md](IOS.md) | Game Center |

`.github/workflows/pages.yml` runs the tests, builds the Pages site and deploys it on every push to `main`. Turn it on under the repo's Settings › Pages › Source: GitHub Actions.

## Games

| Game | Id | Twist | Modes and leaderboards |
| --- | --- | --- | --- |
| Shipshape | `shipshape` | Pour whole runs of sea water between bottles; mystery layers from level 24 | Campaign, Daily, Blitz (weekly), Zen |
| Buoy Oh Buoy | `buoy-oh-buoy` | One buoy per move, so every move counts against par | Campaign, Daily, Blitz (weekly), Zen |
| Knots & Bolts | `knots-and-bolts` | Rope coils on bollards of different heights; from level 12 there's only one spare | Campaign, Daily, Blitz (weekly), Zen |
| Hex Marks the Spot | `hex-marks-the-spot` | Place hex stacks; matching neighbours merge; 10 of a color digs up points; chains multiply; a reef rock surfaces every 20 placements | Endless (weekly), Daily Dig |

The three sort games share one engine (`shared/sort`), one set of screens and one board component with three looks (`liquid`, `balls`, `nuts`). Each game's level curves, dailies and Blitz ramps are in `shared/sort/levels.ts`; its copy, tips and chapters are in `src/games/registry.ts`.

Shared across all games:
- **No ads.** Undo is free. Hints, extra containers, the cannon and shuffles cost coins you earn by playing.
- Combos, stars against a solver-computed par, and chain digs in Hex Marks the Spot.
- XP and player ranks (Pollywog up to Admiral of the Seas), coins, daily streaks, 34 achievements and a palette shop (palettes apply to every game).
- Moves can overlap: queue up a second pour or move while the first is still animating.
- Color-blind symbols, reduced motion, synthesized sound, haptics, and installs as a PWA.

## Look

Everything follows The Pollywog's visual style guide, whose official reference is the mission wallpaper (`ThePollywogMissionWallpaper.png`): off-white paper with a fine engineering grid, navy-charcoal ink for text and lines, and small signal-orange and teal marks. No dark backgrounds, glows or gradients.

- **Colors and type** are CSS variables at the top of `src/styles.css`. Titles use the Black Ops One stencil face, labels and numbers a monospace.
- **Game pieces** use the Mission palette in `src/games/sort/palettes.ts`, muted versions of the brand colors. The other palettes in the shop are optional unlocks.
- **App icons** are small mission patches drawn by `scripts/ios-assets.sh` from `resources/<id>/icon.svg`. The splash and the "by The Pollywog" mark use the mission patch, `resources/brand/pollywog-badge.png` and `public/pollywog.png`.

## Architecture

```
shared/sort/         sort-puzzle core (Shipshape, Buoy Oh Buoy, Knots & Bolts), used by BOTH browser and server
  engine.ts          move rules: run vs single moves, per-tube heights, mystery reveal
  solver.ts          weighted A*: level validation, par, and hints
  levels.ts          per-game seeded generation and difficulty curves
  session.ts         a play-through as an action log (+ replay)
  scoring.ts / verify.ts
shared/hexa/         Hex Marks the Spot engine, seeded pieces, replay + verification
server/              node:http + node:sqlite leaderboard API
src/platform/        game-agnostic profile, XP, coins, streaks, achievements, API, Game Center
src/games/           game registry, sort board (3 skins), rewards
src/screens/         hub, sort/ (home, play, blitz) and hexa/ (home, play)
native/ios/          Swift shared by the four iOS apps (Game Center plugin, entitlements, privacy manifest)
scripts/             iOS build, project setup and icon scripts, and the Pages build
resources/           icon art per game and the Pollywog mission patch
store/               App Store listings, screenshots, and the support and privacy page (site/)
```

**Anti-cheat:** the client never posts a score. It posts its action log. The server rebuilds the level from its seed, replays every move with the same engine, rejects illegal or unsolved logs and impossibly fast times, then computes the score itself. XP and campaign boards are self-reported (with bounds).

**Adding a game:** a new sort variant is mostly a config entry in `shared/sort/levels.ts` plus metadata in `src/games/registry.ts`. A brand-new game (like Hex Marks the Spot) needs its pure logic in `shared/<game>/`, a verify route in `server/index.ts`, and screens; profile, streaks, achievements and leaderboards come for free.
