# Dalang: Bayang Harian

**One shadow a day. One right answer.**

A daily shadow-puppet logic puzzle that runs inside a Reddit post, built on
[Devvit Web](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_overview)
for Reddit's Game of the Day hackathon (2026).

Every day a new scene from a wayang story appears on the kelir, the cloth
screen of Javanese shadow theatre. You are the dalang, the puppet master.
Pick puppets from the chest, stand them at the right place and depth in
front of the lamp, tilt them, bend their arms and turn them around until
their shadows fill the outline exactly. Every position snaps, so you work
out the answer rather than nudge towards it, and a solver has checked that
each puzzle has only one.

Solve the scene and you earn its pusaka, an heirloom from the story (Bima's
club, Arjuna's keris, Sinta's hairpin). Solve it at par with no hints and it
turns to gold leaf. Everything goes into your book, _Serat Dalang_.

> Dalang is a **port**: it brings the characters, stories and look of our
> Dalang VR game for Meta Quest to Reddit, rebuilt as a daily logic puzzle.
> The code here is new; the VR game's rhythm battles stay on Quest.

## How a day works

|             | Player                                     | In the post                                      | Server (Devvit + Redis)                                        |
| ----------- | ------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------- |
| **Open**    | Taps today's post in the feed              | Shows the scene, the outline, the date and par   | The scheduler made the post at 00:00 UTC (07:00 WIB)           |
| **Solve**   | Drops a decoy, moves Bima two slots closer | Recasts the shadow on every tap; nothing is sent |                                                                |
| **Collect** | 100% match: the gamelan plays              | Shows the result card and the new pusaka         | Re-checks the answer, saves pusaka, streak and the solve count |
| **Share**   | Posts the result as a comment in one tap   |                                                  | Comments as the player, updates their flair rank               |

## The four tools

- **Place**: 7 rod slots along the banana trunk, 5 depths (closer to the lamp
  = bigger shadow), tilt in 45° steps, flip. As in real wayang kulit, the
  legs are carved with the body and the arms move: each arm bends at the
  shoulder and the elbow, and the head bows or rises. The week unlocks them
  in turn (Monday the front shoulder, then the elbow, the back arm on
  Thursday, the head at the weekend). Undo steps back one move.
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
- Three story weeks (21 puzzles), Monday gentle to Sunday fiendish:
  _Bima Suci_, _Arjuna Wiwaha_ and _Hanoman Duta_ (from the Ramayana). After
  the third week the calendar starts again. Each solve unlocks that day's chapter of the story, which
  ends on tomorrow's hook.
- Each weekday adds a rule as well as raising par: from Wednesday puppets
  overlap and hide each other's carved holes; from Thursday the match meter
  is gone and one decoy almost fits; at the weekend shadow that spills
  outside the outline is no longer marked red.
- Sunday is a two-lamp night: a second blencong hangs beside the first, so
  every puppet casts two half-dark shadows. The closer it stands to the
  lamps the further apart they fall, so the gap tells you its depth; where
  both shadows meet the screen is darkest. The second shadow follows the
  same projection as the 3D reveal, which lights the scene with two real
  lamps.
- 22 pusaka to collect (one per scene, gold at par), 19 wayang to meet in
  six sets (Punakawan, Pandawa, Kurawa, Dewa, Raksasa, Ramayana), and the
  story chapters, all in the book _Serat Dalang_ (Pusaka, Wayang and Lakon
  tabs; unfound pusaka show as silhouettes). Finishing a lakon's pusaka
  earns its gunungan. Ranks (Penonton → Dalang Muda → Dalang Agung) show as
  user flair.
- Sunday's finale: after the two-lamp puzzle, the puppets you posed perform
  the week's story on the kelir to the gamelan, chapter by chapter.
- The turn-around: after a solve, a three.js scene swings the camera to the
  dalang's side of the screen. The painted puppets stand in your pose, and
  a real lamp casts your matched shadow onto the cloth. It loads only after
  a solve, and falls back to a flat flip without WebGL or with reduced
  motion.
- Streaks with lamp oil: every gold solve adds a drop (up to 3), and the
  lamp burns one drop per missed day to keep the streak alive.
- A leaderboard on every post (fewest moves, then first to solve), shown on
  the result card and the feed card.
- Tomorrow's newcomer as a mystery silhouette on the feed and result cards.
- A spoiler-free result card (moves, par, gold, streak and a row of squares
  showing how close each move came), posted as a comment or copied.
- Player-made shadows: pose wayang you have met, keep a decoy, and Semar
  (the solver) must find exactly one answer before you can post it. One per
  player per day, posted as the player. On Sunday the week's most upvoted
  player shadow gets its own post.
- Vinyl-toy 3D wayang made in Blender for the reveal and the cards (see Art
  pipeline).
- A daily post from the Devvit scheduler, a mod menu to post today's puzzle
  or the "start here" demo post, and a demo post on install.
- Gamelan made with WebAudio, ported from the Dalang VR synth: the same
  pelog-flavoured tuning, saron and bonang partials, gong with its ombak
  beating, kendang and the cempala knock on every move. Nothing is
  downloaded.

**Not built yet:** the weekend story riddle.

## Project layout

```
src/shared/    the game itself, shared by the post and the server
  figures.ts     the 19 wayang as polygons, carved holes, two posable arms,
                 a turning head, rods
  pusaka.ts      the 22 heirlooms you collect
  tales.json     the story chapters (generated, no answers in it)
  grid.ts        the shadow grid: rasteriser, bit masks, compact encoding
  shadow.ts      poses: slot, depth, tilt, arm, flip -> a puppet's shadow
  puzzle.ts      moves and par, the solver, the calendar, Semar's hints
  game.ts        saves: cards, gold, streaks, counts (any Redis-like store)
  bank.json      the generated, solver-checked puzzles
src/client/    the post (React): splash card in the feed, the game, the book
               (book.tsx), the Sunday finale (finale.tsx),
               reveal3d.ts (the three.js turn-around, loaded after a solve)
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

## Art pipeline

The puppets you see in the reveal and on the cards are built in Blender from
the same polygons that cast the scored shadows, in the chunky vinyl-toy style
of Dalang VR: each part a rounded slab in its colour, the carved holes cut
clean through, sphere eyes, gold (or Semar's red) bracelets.

```bash
node --experimental-strip-types scripts/export-figures.ts     # -> tools/blender/figures.json
blender -b --python tools/blender/build_wayang.py              # -> public/models/*.glb, public/art/*.webp
blender -b --python tools/blender/build_wayang.py -- --only semar,bima --no-art
```

- `scripts/export-figures.ts` tags every polygon (skin, face, cloth, hair,
  gold...) and gives the colours; if a figure in `src/shared/figures.ts`
  gains or loses a polygon, update its tag list there (the script checks).
- Models: one GLB per figure with nodes `body`, `head` (origin at the neck,
  so the reveal can turn it), and the arms `front_<s><e>` and `back_<s><e>`
  for every shoulder and elbow position, in figure units, meshopt-compressed
  without normals (three.js recomputes them). They are only for show: in the
  reveal an invisible plane with the exact scored silhouette casts the
  shadow. Until a figure's GLB has these nodes, the reveal shows its painted
  stand-in.
- Card art: `<id>-<arm>.webp`, 360×480, every figure at the same scale.

## Credits

Characters and stories come from traditional Javanese wayang (the
Mahabharata, the Ramayana and their Javanese tellings, and Mpu Kanwa's
Arjunawiwaha). Sources for the story text are in `docs/STORY-SOURCES.md`. All puppet artwork is made for this game: drawn in code and modelled in Blender from the same shapes.
Fonts: Yatra One, Lora and Nunito (SIL Open Font License, in `public/fonts`).
Built from Reddit's Devvit React template (BSD-3-Clause).
