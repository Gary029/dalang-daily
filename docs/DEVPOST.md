# Devpost submission: Dalang

Copy each block into the matching Devpost field. Fill in the `[ ]` links once
the app is uploaded and the demo post is up.

---

## Project name

Dalang: Bayang Harian

## Elevator pitch (max 200 characters)

A daily wayang shadow-puppet logic puzzle inside a Reddit post. Pick the puppets, set their depth and pose, match the shadow exactly, and keep every wayang you solve.

## Category

Best Daily Game **and** Best Ported Daily Game. Dalang is a port of our own
game, Dalang for Meta Quest (we own the IP; the characters, stories, look and
gamelan identity carry over, the code is new).

---

## About the project

### Inspiration

Wayang kulit has always been a shadow puzzle. A dalang sits behind a cloth
screen with a lamp and a chest of flat leather puppets, and every shadow the
audience sees is a decision: which puppet, how close to the lamp, which way it
faces, where its arm points. UNESCO recognised Indonesian wayang as a
Masterpiece of the Oral and Intangible Heritage of Humanity in 2003.

We had already built Dalang for Meta Quest, a VR shadow play with stories from
across Indonesia. For Reddit we asked a different question: what if the
shadow _itself_ were the puzzle, one a day, with exactly one right answer?

### What it does

Every day a new post shows a scene from a wayang story: a gold outline on the
kelir. You are the dalang.

- **Place**: each puppet snaps to one of 7 rod slots and 5 depths (closer to
  the lamp makes a bigger shadow), tilts in 45° steps, raises its arm down,
  forward or up, and flips to face the other way.
- **Pierce**: every puppet has its own carved holes. Light shines through
  them, so the holes in the outline tell you who belongs in the scene.
- **Cast**: the chest holds more puppets than the scene needs. Decoys look
  right and never fit.
- **Match**: only a 100% match solves it. Par is the fewest taps, worked out
  by our solver, and every live puzzle is proved to have exactly one answer.

Solve it and the screen turns around. In 3D, the camera swings from the
audience's side of the kelir to the dalang's side: the painted leather
puppets stand in exactly the pose you set, the blencong lamp flickers, and
a real light casts the very shadow you just matched onto the cloth.

Then the scene's wayang join your album: 15 characters in five sets
(Punakawan, Pandawa, Kurawa, Dewa, Raksasa), each with a short card telling
who they are. Solve at par with no hints and the card turns to gold leaf.
Finish a set to earn the gunungan. Your rank (Penonton → Dalang Muda →
Dalang Agung) shows as user flair, your result card posts as a comment in one
tap, and streaks and "% solved today" keep the community coming back.

The week follows one lakon (story), one scene a day, harder from Monday to
Sunday: _Bima Suci_ (Bima's search for the water of life) and _Arjuna
Wiwaha_ (Arjuna's meditation and the giant king).

New players start with a 30-second warm-up where Semar, the wise clown-servant,
coaches them one tap at a time. After that, tips appear only the first time a
tool matters, and Semar gives up to three hints a day.

### How we built it

- **Devvit Web** with a React + TypeScript post (Vite) and a Hono server.
- **The puzzle engine** lives in shared TypeScript used by both the post and
  the server: each wayang is a set of polygons with carved holes, a posable
  arm and its rods; a pose is rasterised onto a 200×120 shadow grid; a match
  is an exact bit-for-bit comparison. The kelir is drawn from the same
  polygons with a lamp-lit cloth and a soft penumbra, so what you see is
  exactly what is scored.
- **The solver** enumerates every pose of every offered puppet whose shadow
  fits inside the target (shadows only add up, so this prunes hard), then
  searches combinations. It rejects any puzzle with zero or two answers and
  computes par. A seeded generator rolls each story scene until it is unique
  and its par fits the weekday.
- **The reveal** uses three.js, loaded only after a solve so the feed card
  stays light. Each puppet is painted onto a plane in its exact pose, with
  its carved holes cut out. We place it by inverting the lamp's projection,
  so a real point light gives a shadow that matches the scored one. Without
  WebGL, or with reduced motion on, the kelir flips flat instead.
- **Server**: Redis keeps profiles (album, gold cards, streaks), per-post
  solve counts and hints. The answer never ships in the post; the server
  re-checks every solve. The Devvit scheduler creates the daily post; a mod
  menu creates the "start here" demo post.
- **Reddit features**: interactive post with a fast inline splash and an
  expanded game view, user flair for ranks, one-tap result comments, daily
  scheduled posts.
- **Sound**: a small WebAudio gamelan (saron in slendro, kecrek, gong), no
  audio files.
- **CI/CD** on GitHub Actions: typecheck, lint, unit tests and a puzzle-bank
  gate on every push; on main, a playable browser demo goes to GitHub Pages
  and a new private version is uploaded with `devvit upload`.

### Challenges we ran into

- **Exact but fair.** A 100% match is only fair if every position snaps and
  the answer is unique. The solver made that a test we can run on every
  puzzle, in CI, instead of a hope.
- **Looking like wayang at phone size.** Our first silhouettes read as stick
  figures. The rods (the central gapit and the arm tuding), long arms that
  reach past the knee and the flared dodot are what make a shadow read as
  wayang, so they became part of every figure, and of the puzzle.
- **Drawing what is scored.** Drawing the grid looked blocky; drawing smooth
  vectors risked a shadow that looks right but is not. Both now come from the
  same polygons, and the grid decides.
- **Par with the chest.** Lifting a puppet out and placing it back resets its
  pose, which is sometimes the shortest path. The par calculation and a
  one-time tip both account for it.

### Accomplishments that we're proud of

- Every live puzzle is proved to have exactly one answer.
- A first-time player goes from the feed to a solved warm-up in about 30
  seconds, with no wall of instructions.
- The whole game fits a phone post with no scrolling.
- It teaches something real: who Semar, Bima, Arjuna and Cakil are, and how
  a dalang thinks about light.

### What we learned

Small rules make deep puzzles: five snapped controls and carved holes give a
surprisingly rich logic space. And a daily game is mostly about the loop
around the puzzle: the outline in the feed, the result card, the album, the
streak.

### What's next for Dalang

- **Next, after judging:** two-lamp puzzles (two screens at once) and the
  weekend story riddle; player-made puzzles with a builder, solver-checked and
  voted into Sunday's slot; App Review and publishing.
- **Later:** more lakon (Ramayana, Sawerigading, Purbasari), other wayang
  forms such as wayang golek, and subreddit events where a whole community
  solves one long lakon together.

---

## Built with

devvit, devvit-web, reddit, react, typescript, vite, hono, redis,
tailwindcss, three.js, webgl, webaudio, canvas, github-actions, node.js

## Links ("Try it out")

- App listing: `[https://developers.reddit.com/apps/dalang-daily]`
- Demo post (judges start here): `[https://www.reddit.com/r/<your_test_subreddit>/comments/...]`
- Source code: https://github.com/Gary029/dalang-daily
- Browser demo (same game, server logic in the page): https://gary029.github.io/dalang-daily/
- Video (optional, under 1 minute): `[youtube link]`

## Checklist before submitting

- [ ] `npm run deploy` (or the Deploy workflow) uploaded the app; it stays
      private, **not published**.
- [ ] App installed in a public test subreddit with under 200 members.
- [ ] Demo post made with the mod menu **Dalang: post the start-here demo**
      (it opens on the warm-up, then Monday's puzzle). Played once while
      logged out and once logged in.
- [ ] Marked as a port of Dalang VR in the submission.
- [ ] Optional: the Devvit feedback survey (Best Feedback prize).
- [ ] Deadline: 9 Dec 2026, 09:00 WIB (8 Dec, 18:00 PT).
