# Dalang: Bayang Harian

**One shadow a day. One right answer.**

A daily shadow-puppet logic puzzle that runs inside a Reddit post, built on
[Devvit Web](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_overview)
for Reddit's Game of the Day hackathon (2026).

Every day a new scene from a wayang story appears on the kelir, the cloth
screen of Javanese shadow theatre. You are the dalang, the puppet master.
Pick the right puppets from the chest, stand them at the right place and
depth in front of the lamp, tilt them, raise their arms, turn them around,
until their shadows fill the outline **exactly**. Every position snaps, so
each puzzle is solved by reasoning, not nudging, and every puzzle has been
proved by a solver to have exactly one answer.

Solve the scene and the wayang in it join your album. Solve it at par with no
hints and the card turns to gold leaf.

> Dalang is a **port**: it brings the characters, stories and look of our
> Dalang VR game for Meta Quest to Reddit, rebuilt as a daily logic puzzle.
> The code here is new; the VR game's rhythm battles stay on Quest.

## How a day works

|             | Player                                     | In the post                                      | Server (Devvit + Redis)                                       |
| ----------- | ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| **Open**    | Taps today's post in the feed              | Shows the scene, the outline, the date and par   | The scheduler made the post at 00:00 UTC (07:00 WIB)          |
| **Solve**   | Drops a decoy, moves Bima two slots closer | Recasts the shadow on every tap; nothing is sent |                                                               |
| **Collect** | 100% match: the gamelan plays              | Shows the result card and the new wayang cards   | Re-checks the answer, saves cards, streak and the solve count |
| **Share**   | Posts the result as a comment in one tap   |                                                  | Comments as the player, updates their flair rank              |

## The four tools

- **Place**: 7 rod slots along the banana trunk, 5 depths (closer to the lamp
  = bigger shadow), tilt in 45° steps, the arm down / forward / up, flip.
- **Pierce**: every puppet has its own carved holes. Light shows through
  them, so the holes in the outline tell you who is in the scene.
- **Cast**: the chest offers more puppets than the scene needs. Decoys look
  right and never fit.
- **Match**: only a 100% match of the shadow grid solves it, and par is the
  fewest taps, worked out by the solver.

## What is in this build

- The puzzle engine: wayang silhouettes, a 200×120 shadow grid, exact
  match, and a solver that proves each puzzle has one answer and finds par
  (`src/shared`).
- A 30-second warm-up with Semar's step-by-step tips, then one-time
  contextual tips; Semar's three hints per puzzle (a hint costs the gold card,
  never the solve).
- Two story weeks (14 puzzles), Monday gentle to Sunday fiendish:
  _Bima Suci_ and _Arjuna Wiwaha_. After the second week the calendar
  starts again.
- 15 wayang in five sets (Punakawan, Pandawa, Kurawa, Dewa, Raksasa), gold
  cards, a gunungan badge for a full set, ranks (Penonton → Dalang Muda →
  Dalang Agung) shown as user flair.
- Streaks, "% solved today", a result card shared as a comment.
- A daily post from the Devvit scheduler, a mod menu to post today's puzzle
  or the "start here" demo post, and a demo post on install.
- Gamelan made with WebAudio (saron, kecrek, gong); nothing is downloaded.

**Not built yet** (planned P1): two-lamp puzzles, the weekend story riddle,
player-made puzzles voted into Sunday.

## Project layout

```
src/shared/    the game itself, shared by the post and the server
  figures.ts     the 15 wayang as polygons, carved holes, posable arm and rods
  grid.ts        the shadow grid: rasteriser, bit masks, compact encoding
  shadow.ts      poses: slot, depth, tilt, arm, flip -> a puppet's shadow
  puzzle.ts      moves and par, the solver, the calendar, Semar's hints
  game.ts        saves: cards, gold, streaks, counts (any Redis-like store)
  bank.json      the generated, solver-checked puzzles
src/client/    the post (React): splash card in the feed, the game, album
src/server/    Devvit Web server (Hono): API, scheduler, menu, install trigger
scripts/       generate-bank.ts, check-bank.ts (the CI gate), bundle check
```

The answers never ship inside the post: the client gets the outline and the
starting scene; the server keeps the solutions, re-checks every solve and
hands out hints.

## Develop

Node 24 or newer.

```bash
npm install
npm run local        # play in a normal browser: http://localhost:5173/splash.html
                     #   ?day=3 picks a day, ?warm=done skips the warm-up,
                     #   /gallery.html shows every puppet
npm test             # types, lint, unit tests, puzzle-bank gate
npm run bank         # regenerate the puzzle bank (fixed seeds, deterministic)
```

On Reddit:

```bash
npm run login        # devvit login, once
npm run dev          # devvit playtest in your test subreddit
npm run deploy       # checks, then devvit upload (private; does not publish)
```

After installing the app in a subreddit, use the subreddit menu
**Dalang: post the start-here demo** for the judged demo post, and
**Dalang: post today's shadow** to post the day's puzzle by hand. The
scheduler posts a new one every day at 00:00 UTC.

## Continuous integration and deployment

- **CI** (`.github/workflows/ci.yml`), on every push and pull request:
  typecheck, lint, unit tests, the puzzle-bank gate (every puzzle has exactly
  one answer and a true par, every wayang can be collected), the Devvit
  build, and a check that no answers ship in the post.
- **Deploy** (`.github/workflows/deploy.yml`), after CI passes on `main`:
  - the browser demo is published to GitHub Pages;
  - a new private version is uploaded to Reddit with `devvit upload`. To turn
    this on, run `npx devvit login` once, then save the contents of
    `~/.devvit/token` as the repository secret `DEVVIT_AUTH_TOKEN` (Settings →
    Secrets and variables → Actions). Without the secret the job skips
    itself. Uploading never publishes the app.

## Credits

Characters and stories come from traditional Javanese wayang (the Mahabharata
and its Javanese tales). All puppet artwork is drawn in code for this game.
Fonts: Yatra One, Lora and Nunito (SIL Open Font License, in `public/fonts`).
Built from Reddit's Devvit React template (BSD-3-Clause).
