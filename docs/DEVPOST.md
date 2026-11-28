# Devpost submission: Dalang

Copy each block into the matching Devpost field. Fill in the `[ ]` links once
the app is uploaded and the demo post is up.

---

## Project name

Dalang: Bayang Harian

## Elevator pitch (max 200 characters)

A daily wayang shadow-puppet puzzle in a Reddit post. Pick the puppets, set their depth and bend their arms until the shadow fits the outline, and earn the story's heirlooms.

## Category

Best Daily Game **and** Best Ported Daily Game. Dalang is a port of our own
game, Dalang for Meta Quest (we own the IP; the characters, stories, look and
gamelan identity carry over, the code is new).

---

## About the project

### Inspiration

Wayang kulit has always been a shadow puzzle. The dalang sits behind a cloth
screen with an oil lamp and a chest of flat leather puppets, and every shadow
the audience sees comes from choices he makes: which puppet, how near the
lamp, which way it faces, where its arms point. UNESCO recognised Indonesian
wayang as a Masterpiece of the Oral and Intangible Heritage of Humanity in 2003.

We had already made Dalang for Meta Quest, a VR shadow play with stories from
across Indonesia. For Reddit we turned the shadow itself into the puzzle: one
scene a day, and only one way to cast it.

### What it does

Each day's post shows a gold outline on the kelir (the screen) and a chest of
puppets. You play the dalang:

- **Place** a puppet in one of 7 rod slots and 5 depths. Nearer the lamp,
  the shadow grows. Tilt it in 45° steps or turn it round.
- **Pose** it. In real wayang kulit the legs are carved with the body and
  only the arms move, so here too: each arm bends at the shoulder and the
  elbow, and the head bows or lifts. Monday gives you one shoulder; by the
  weekend you have both arms and the head.
- **Read the holes.** Every puppet has its own carved holes, and light shows
  through them, so the holes in the outline tell you who is in the scene.
- **Leave out the decoys.** The chest holds more puppets than the scene
  needs.
- **Match it.** Only an exact match counts. Par is the fewest taps, and our
  solver has checked that every puzzle has one answer.

When the shadow matches, the screen turns around. The camera swings in 3D to
the dalang's side, where the puppets stand in your pose under a flickering
lamp, and a real light throws the shadow you just made onto the cloth.

You then get the scene's pusaka, an heirloom from the story: Bima's club
Rujakpolo, Arjuna's keris Pulanggeni, the arrow Pasopati, Sinta's hairpin.
Match at par without hints and it turns to gold leaf. Your book, Serat
Dalang, keeps the pusaka you have found (the rest show as silhouettes), the
wayang you have met and the story chapters you have unlocked. Collect every
pusaka of a story and you earn its gunungan. Your rank shows as user flair.

Each week tells one lakon, a scene a day: _Bima Suci_ (Bima looks for the
water of life), _Arjuna Wiwaha_ (Arjuna meditates on Mount Indrakila and the
gods test him) and _Hanoman Duta_ (Hanoman carries Rama's ring to Sinta, from
the Ramayana). Monday is gentle. From Wednesday the puppets overlap and hide
each other's holes. From Thursday there is no match meter and one decoy
nearly fits. At the weekend, shadow outside the outline is no longer marked
in red. Sunday has a second lamp, so every puppet throws two faint shadows,
and the gap between them gives away how near the lamps it stands. After
Sunday's puzzle the puppets you posed act out the week's story to the
gamelan.

What brings people back the next day:

- Each solve tells the next chapter, which ends on a hook, and the feed
  card shows tomorrow's newcomer as a silhouette.
- Gold solves fill the lamp with oil, and oil keeps your streak alive
  through a missed day.
- Every post has a leaderboard: fewest moves, then first to finish.
- The result comment gives nothing away: moves against par, gold or not,
  your streak, and a row of squares for how close each move came.
- You can make a shadow for the subreddit from the wayang you have met.
  The solver has to find one answer before it can be posted, and the
  week's most upvoted one gets its own post on Sunday.

First-time players get a 30-second warm-up with Semar, the clown-servant,
telling them one tap at a time what to do. After that a tip appears only the
first time a tool matters, and Semar gives up to three hints a day.

### How we built it

It is a Devvit Web app: a React and TypeScript post built with Vite, and a
Hono server.

The puzzle engine is shared TypeScript that runs in the post and on the
server. Each wayang is a set of polygons with carved holes, two jointed arms
and a head that turns about the neck, plus its rods. A pose is rasterised
onto a 200×120 grid, and a match is a bit-for-bit comparison. The kelir is
drawn from the same polygons with a lamp-lit cloth and a soft edge, so what
you see is what gets scored.

The solver lists every pose of every puppet whose shadow fits inside the
outline (shadows only add, so most poses drop out), then searches the
combinations and rejects any puzzle with no answer or more than one. A
puppet's shadow is its body, holes cut, plus two arms, so the solver checks
each piece on its own first. The arms and head multiply the poses by 243;
the hardest Sunday still solves in under a second. A seeded generator
rerolls each scene until it has one answer and a par that suits the
weekday.

The 3D reveal uses three.js and only loads after you solve, so the feed card
stays light. Each puppet is placed by running the lamp's projection
backwards, so a real point light lands its shadow on the scored one. A
Blender script turns each figure's polygons into a jointed 3D model and
renders the card art. Without WebGL, or with reduced motion on, the screen
flips flat instead.

The server keeps profiles, solve counts, hints and leaderboards in Redis.
The answers never ship in the post, and the server re-checks every solve and
every player-made shadow. The Devvit scheduler makes the daily post; a mod
menu makes the "start here" post. The sound is the Dalang VR gamelan synth
ported to WebAudio (saron, bonang, gong, kendang and the dalang's wooden
knocker), with no audio files.

GitHub Actions run the typecheck, lint, unit tests and a puzzle-bank check
on every push. On main, a playable browser version goes to GitHub Pages and
a private build is uploaded with `devvit upload`.

### Challenges we ran into

- **Exact but fair.** An exact match is only fair if every position snaps
  and only one answer exists. The solver turned that into a check that runs
  on every puzzle in CI.
- **Looking like wayang at phone size.** Our first silhouettes read as stick
  figures. What makes a shadow read as wayang is the rods, arms that reach
  past the knee and the flared dodot cloth, so those went into every figure,
  and into the puzzle.
- **Drawing what is scored.** Drawing the grid looked blocky, and smooth
  vectors could show a shadow that looks right but isn't. Now both come from
  the same polygons and the grid decides.
- **Par and the chest.** Putting a puppet back in the chest and taking it
  out again resets its pose, which is sometimes the shortest route. Par and
  a one-time tip both account for it.

### Accomplishments that we're proud of

- The solver has checked every puzzle in the game for a single answer.
- A new player gets from the feed to a solved warm-up in about 30 seconds,
  without a page of rules.
- The whole game fits in a phone post without scrolling.
- Players come away knowing who Semar, Bima, Arjuna and Hanoman are, and
  how a dalang works the light.

### What we learned

A few snapped controls and carved holes were enough to make puzzles we
ourselves get stuck on. And most of a daily game happens around the puzzle:
the outline in the feed, the result comment, the book and the streak.

### What's next for Dalang

- **After judging:** a weekend story riddle, two-lamp player shadows, then
  App Review and publishing.
- **Later:** more lakon (Sawerigading, Purbasari), other wayang forms such as
  wayang golek, and subreddit events where a whole community plays one long
  lakon together.

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
