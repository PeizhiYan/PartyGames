# PartyGames — Developer Guide

## What this is
A PWA of party games for a small group of friends, sharing one Firebase project with CoffeeGlass.
Read `README.md` first — it covers setup, deployment and the admin tools. This file is the
orientation for working in the code.

## The shape of it

```
pages ─┐
shell ─┼─► games/ ──► rooms/ ──► services/ ──► adapters/
ui   ──┘      └──────────┴──────► types.ts   (depends on nothing)
```

A **game owns a folder** and nothing else knows its name. Everything else is a layer it plugs into.

Four rules hold the design together:

1. **Game rules are pure.** No React, no `firebase`, no `Date.now()`, no `Math.random()` inside a
   reducer — time comes in as `ctx.now`, dice come in on the action. That is what makes games
   testable, and what lets the backend run a reducer inside a transaction.
2. **The two registries are split for that reason.** `games/registry.ts` holds rules only and is
   what the adapters import; `games/screens.tsx` holds React and is imported only by the UI. Mixing
   them would drag React into the backend — and into a future Node server. There is a check for
   this in "Testing".
3. **Only `src/adapters/firebase/` may import `firebase`.** Everything above it talks to the
   interfaces in `src/services/types.ts`.
4. **A game is a `GameDefinition`**: `newState`, `reduce(state, action, ctx)`, and optionally
   `onPlayersChanged`. `reduce` throws `GameRuleError` with a message written for a player; the UI
   shows it as-is.

## Rooms

One document per room, holding the players, the join queue, the game state, and a presence map.

- **Joining** is two steps: an outsider appends themselves to `requests`, and the owner moves them
  into `players`. Firestore rules allow exactly those two writes and nothing else.
- **Presence**: every device in a room writes `presence.<uid> = serverTimestamp()` every 25s
  (`PRESENCE_INTERVAL_MS`). A heartbeat deliberately does **not** touch `updatedAt`, so idle rooms
  don't keep jumping to the top of the list — the rules allow `updatedAt` to stay put for exactly
  that case.
- **Cleanup** is client-side: `isStale()` marks a room with no sign of life for
  `ABANDONED_AFTER_MS` (15 min), and `RoomRepo.reap()` deletes those. It runs whenever anyone opens
  a room list. There is no scheduler, which is what keeps this portable off Firebase.
- **`PRESENCE_TIMEOUT_MS` (90s) and `ABANDONED_AFTER_MS` (15 min) are different numbers on
  purpose.** The first only drives the "2 online" label. Deleting on that timescale was a real bug:
  a backgrounded tab or a locked phone stops running timers, so a host who opened Messages to send
  the code stopped checking in at once and the room was deleted before the invitation arrived.
  "Sign of life" therefore means the latest of every check-in, `updatedAt` and `createdAt` — a move
  keeps a room alive as much as a heartbeat does — and a room whose timestamps cannot be read at
  all is never deleted.
- **Ownership** moves to the longest-standing remaining player when the owner leaves; the last
  player out deletes the room.

## Where things live

```
src/
├─ types.ts        the shared vocabulary: Room, AppUser, GameDefinition, GameId
├─ games/          one folder per game — rules, screens, art, tests, all of it
│  ├─ registry.ts    rules only. PURE: the adapters import this
│  ├─ screens.tsx    id → { Room, Solo?, Art }. React: only the UI imports this
│  ├─ art.ts         the 640x200 canvas every cover is drawn on
│  ├─ gomoku/        rules board ai (+tests) · Room BoardCanvas Solo Art
│  ├─ monopoly/      rules (+tests) · Room Dice BalanceChart Art
│  └─ hanoi/         rules (+tests) · Solo Board Leaderboard Art
├─ rooms/          the multiplayer layer games plug into: rules, useRooms, RoomList
├─ services/       the backend contract
├─ adapters/       firebase/ and memory/ — the only places that know a backend exists
├─ ui/             design-system primitives: Icon Sheet Toast Segmented Avatar
├─ shell/          app chrome: AppShell Backdrop ThemePicker InstallCard OfflineNotice
├─ pages/          screens that are not a game
├─ hooks/          useAuth useInstall useOnline
└─ lib/ styles/    formatting, theme, version · global CSS
```

| Thing | File |
|---|---|
| Join codes, staleness, who-may-do-what | `src/rooms/rules.ts` |
| Firestore transactions, queries, presence | `src/adapters/firebase/rooms.ts` |
| The dev backend (two tabs can play each other) | `src/adapters/memory/index.ts` |
| Theme tokens, every shared class | `src/styles/global.css` |
| Accent + light/dark choice | `src/lib/theme.ts` |

## Monopoly's two modes

Split across four files because the game got big:

| File | What |
|---|---|
| `boards/` | Four boards as data, each its own shape. `checkBoard()` and a test enforce that a board is a square with corners in the right places. |
| `state.ts` | The state shape, and the readings both halves need — ownership, rent, what a player's property is worth. |
| `play.ts` | Board mode: movement, landing, cards, jail, building, bankruptcy. Pure. |
| `rules.ts` | The `GameDefinition`, the reducer, and bank mode's hand-entered money. |

- **Bank mode still needs the board data.** Buying records *which* space, which is the only reason
  the results screen can total everyone's property instead of asking them to type it. That was the
  point of the whole exercise; do not let `buy` become a free-text amount again.
- **Dice and the card seed come in on the action** (`roll`, `start`), never from `Math.random()`
  inside the reducer, so the whole game stays a pure function and can run in a transaction. Card
  order is `seed` mixed with the number of draws so far.
- **Deliberately missing**: auctions, trading and mortgages. Each needs a negotiation flow, and a
  game between friends works without them. A declined property stays with the bank.
- **The board has two layouts, chosen by a media query.** Wide screens get the ring, the way a
  board is printed. Narrow screens get a **spiral** filling the whole grid, because a ring on a
  phone spends about sixty percent of its area on a hole it does not need — the cards and money
  that hole exists for are not physical here — and squeezes the spaces to ~32px, too small for a
  name. `layout.ts` computes *both* positions for every space and `Board.tsx` writes them on each
  tile as `--g-row/--g-col` and `--r-row/--r-col`; the CSS picks. No resize listener, no flash of
  the wrong shape.
- **The narrow layout was rows alternating direction (boustrophedon) first, and that failed.**
  Which way a row ran was invisible, and bordered lanes with turn markers only made it busier.
  A spiral is at least a shape you recognise before you read anything.
- **The spiral walls its laps off, and each lap opens at its top-left.** Recognising the shape
  is not the same as seeing which lap a tile is on — two tiles side by side across a boundary
  are twenty spaces apart — so each lap gets an outline running down the middle of the gutter
  (`.mono-coil`, one per `coilCount()`), open where the route steps into it. The gutter is 8px
  wide to hold the line; at 3px there was nowhere to put anything.
  - The outlines are their own grid items, not children of a tile: `.mono-space` clips its
    overflow and these have to live in the gutter. They sit at `z-index: 0`, behind the tiles,
    so only the part crossing a gutter is ever seen.
  - **An open lap is two elements, and nothing is erased.** The box is drawn without its left
    border and with that side's corners squared (`.mono-coil.open`), and the left border is a
    second element starting one row lower (`.mono-coil-side`). Three earlier versions painted
    the board's background over a finished box to cut the opening: too short and a stub of line
    was left that still read as closed, long enough to clear the corner and it notched the top
    edge. Both read as the border having failed to draw. Do not go back to erasing.
  - Every lap after the first is entered at its own top-left cell — that falls out of how
    `spiralOrder()` walks the grid, and it is why the opening needs no per-lap arithmetic.
  - Direction arrows in every gutter were the version before all of this, and were too noisy
    for a board you are trying to read.
- **The wrap still has to be written down.** On the ring the last space is next to `GO`; in the
  spiral it finishes in the middle, so the last tile carries a `↺ 0` badge. It gives way to a
  token, like the price and the second line of the name.
- `boardLayout()` picks the factor pair closest to "a bit taller than wide" so the grid is always
  exactly full — 40 → 5×8, 36 → 6×6, 32 → 4×8; `spiralOrder()` then walks it inwards from the
  top-left. `ringPosition()` is the other one. The tests assert, for both, that every space has a
  cell of its own and that consecutive spaces touch — for the ring including the wrap.
- **A room can ask for the whole window.** `GameScreens.wide(room)` is asked per *room*, not per
  game, because Monopoly only wants it in board mode — bank mode is a column of cards and reads
  better narrow. On a wide screen `BoardPlay` puts the board left and everything you do right.
- **The board grows with the window, capped by height.** It is square, so a width-only cap makes
  it taller than the screen on a wide monitor; `max-width: min(100%, calc(100dvh - 150px))` lets
  whichever dimension runs out first decide. Tile text tracks `min(vw, vh)` for the same reason.
- **Nothing on a tile is an emoji.** Emoji are a different typeface on every platform, carry a
  colour nobody chose, and turn to mush at tile size. `Icons.tsx` holds filled 24×24 paths:
  `SpaceIcon` for the spaces with no name of their own, and `Token` for the eight player pieces —
  the player's colour as a disc with their mark knocked out of it in white, because colour is
  what tells two players apart before the shape does. Token ids are names (`hat`, `car`, …), so
  a piece can be redrawn without touching stored state. Redraw one only if it survives 13px: the
  dog and the cat were the same picture until the dog got ears that hang down.
- **A tile with someone on it gives up its price and its second line of name.** Tokens are
  absolutely positioned so an empty tile reserves no gap, but `.has-tokens` hides the price and
  clamps the name to one line, because a token dropped on top of the words made both unreadable
  and who is standing here matters more than what it costs. The side panel and `SpaceSheet`
  still spell the space out in full.
- **On the ring, the colour band faces the middle**, as it does on a printed board — it is the
  clearest sign of which side you are looking at. `ringEdge()` puts `data-edge` on every tile and
  the CSS flips the tile's flex direction; the spiral ignores it and keeps the band on top.
- **The middle of the ring is the city and the dice tray.** `Skyline.tsx` draws one silhouette
  per board in `currentColor` at low opacity — a backdrop, not the picture on the box, so it
  works in either theme without a second asset. Two things learned the hard way: symmetrical
  points in a row read as fir trees whatever you do to them (Canada Place's sails had to become
  asymmetric with masts, and the Temple of Heaven's roofs had to go shallow), and the Great Wall's
  battlements are generated from the wall's top polyline, because thirty hand-placed merlons on a
  slope means thirty chances to leave one in mid-air.
- **The dice are real cubes.** `ThrownDice` builds six rotated faces per die and tumbles them in
  with one keyframe set whose landing angle comes in as `--rx`/`--ry` — six values times two dice
  would otherwise be twelve animations saying the same thing. They are keyed on `lastRoll.at`,
  because a CSS animation only replays on a fresh element. The flat dice (`.dice-aside`) stay for
  the narrow layout, which has no middle to throw anything into; `.row` sets `display: flex` at
  the same specificity and lands later in the bundle, so hiding them needs the ancestor in the
  selector.
- Tapping a space opens `SpaceSheet`; a "You are on …" card always spells out the current space.
- **Do not try to shrink text back into the tiles** on the narrow layout. That was the ring's
  problem, and the first fix dropped the words entirely instead.

## Everything in a room is public

A room is one document and every player in it reads all of it, so there is **nowhere to keep a
secret**. Fine for Gomoku and for MonopolyBuddy; it rules out card games as the model stands — a
hidden hand in the room document is readable by anyone in the room, whatever the UI does. UNO and
Mahjong (both on the roadmap) need either per-player documents guarded by rules, or dealing from
a server. Decide that before the first card game, not during it.

## Adding a game

Everything about a game lives in `src/games/<id>/`. Adding one is three edits, and TypeScript
names the ones you forget:

1. Add the id to the `GameId` union in `src/types.ts`. Both registries are `Record<GameId, …>`,
   so this alone makes the build fail until the game is fully wired — that is deliberate.
2. Create `src/games/<id>/` with `rules.ts` (a `GameDefinition`) and `Art.tsx`. Multiplayer games
   need `Room.tsx` (taking `{ room, uid }`); solo games need `Solo.tsx`. `multiplayer: false`
   identifies a solo-only puzzle, so the lobby and room list never offer it as a room game.
   `soloTitle` and `soloDescription` label the solo entry point. Tests go in the same folder.
3. Register it in `games/registry.ts` (rules) and `games/screens.tsx` (screens).

For multiplayer games only, add the id to `d.game in [...]` in `firestore.rules`. Both room
adapters also reject `multiplayer: false`. A game's optional `LobbyExtra` screen supplies extra
lobby content without adding game-specific branches to the page.

Nothing else. The home grid, the lobby, the room page, the solo route and the room list all read
the registries — there are no per-game branches left anywhere else in the app.

Cover art is drawn on a 640x200 canvas and cropped two ways; see `src/games/art.ts` for the safe
zone before drawing.

## Gomoku: the port

The original (`../PeizhiYan.github.io/js_codes/gomoku`) scored a board by convolving it with
hand-made filters. Each filter was a contiguous run of N cells plus a "shoulder" just past either
end, weighted **10** at the start and **1000** at the end — different on purpose, so every
combination of blocked/empty ends landed on a unique total (a three scored 3 open, −7 or −997
half-open, −1007 dead). That is exactly "find each maximal run and look at both ends", so this
port scans lines instead. Same weights, same move scoring (offence + defence + centre bias), same
alpha-beta search at even depths — orders of magnitude faster, which is what makes the Insight heat
map affordable to redraw after every move on a phone.

Three things that were real bugs in the original or in this port, and have tests:

- The **centre bias** must break ties, or the computer drifts into the top-left corner (scan order).
- **Defence must be scored**, or a cell that has to be blocked gets pruned before the search sees it.
- `candidates()` falls back to the centre **only on an empty board**. A full board also has no
  candidates, and offering the centre there hands the search an occupied cell to play on.

## Hanoi Tower and its leaderboard

Ported from `../PeizhiYan.github.io/js_codes/hanoi_tower`. This is the original **seven-disk**
solo challenge, finishing on the **rightmost peg**. Do not mix difficulties on one leaderboard.
`rules.ts` owns legal moves, completion and replay validation; `Board.tsx` redraws the original
shaded rainbow disks and wooden stand as SVG with keyboard-accessible peg buttons. Selecting
the same peg cancels instead of counting a move, and only a successful move advances the count.

- `backend.hanoiLeaderboard` is the backend seam. The Firebase adapter stores one best per uid
  at `/apps/partygames/leaderboards/hanoi/scores/{uid}`; the memory adapter broadcasts local bests.
- Records hold `uid`, `displayName`, `durationMs`, `moves`, and server-stamped `achievedAt`.
  They contain no email. Results sort by **durationMs ascending, then moves ascending**. Equal
  results keep the earlier record. A Firestore transaction prevents concurrent submissions from
  replacing a better score. The two-field top-50 query needs the index in `firestore.indexes.json`.
  If the index is still building or missing, the adapter watches the whole personal-best collection
  for that visit and sorts before taking 50. This preserves ties at the cutoff and keeps the small
  friends leaderboard usable during deployment. It costs reads for every player in that fallback;
  keep the composite index deployed. A new subscription tries the indexed query again. Permission
  errors never trigger the fallback. The production index error has a dedicated mocked-listener
  regression test because the emulator does not enforce composite indexes.
- `validateRun()` replays the submitted moves before either adapter saves anything. Only a legal
  completed seven-disk run is accepted, with 127–10,000 moves and a positive time up to 24 hours.
  The move trace is not stored in the public leaderboard.
- **This follows the existing trusted-client model.** Firestore rules enforce access, ownership,
  score bounds, server timestamps and improvement. They do not prove that the client played the
  game or timed it honestly. An adversarial/competitive leaderboard would need server-authoritative
  play or server verification; a client replay check is not that.
- `useScore.ts` retains the best pending completion in localStorage, scoped to the uid. It retries
  on reconnect or when the solo screen is reopened, with an explicit retry after a write failure.
  Resetting the puzzle does not discard a pending completion. In-progress games are not persisted;
  navigating away starts a fresh puzzle, while merely backgrounding a tab keeps the clock running.
- Deploy **both Firestore rules and indexes** along with hosting for this feature. Otherwise the
  game can play locally, but leaderboard reads/writes cannot work in production. CoffeeGlass's
  existing rules block is unchanged. Emulator tests exercise the real adapter's concurrent writes.

## Gotchas

- **`clean()`** in the Firebase adapter is a JSON round trip that strips `undefined` (Firestore
  refuses it). It would also flatten `Date`s, which is fine because game state stores times as
  epoch-millisecond numbers — keep it that way.
- **Firestore forbids an array directly inside an array.** `seats[].dice` is fine (array inside a
  map inside an array); `[[1,2]]` would not be. Gomoku's board is a flat 225-cell array for this
  reason.
- **`updatedAt` on a heartbeat**: see Rooms above. Changing that needs the rules changed too.
- **The board arrives as a fresh array on every snapshot**, including an opponent's heartbeat, so
  don't hang UI state off board identity (`BoardCanvas` watches `placing` instead).
- **`firestore.rules` is the whole project's rules file, and this repo owns it.** It covers every
  app in `vibed-apps`, and only this repo deploys it — CoffeeGlass deploys `--only hosting` and
  keeps its copy just to run its own rules tests. A new app's block goes here, not in its own repo.
  See "Owning the rules" in `README.md`.
- **Theming is two attributes on `<html>`**: `data-accent` and `data-mode` (absent = follow the
  system), set by `src/lib/theme.ts`, which `main.tsx` imports for the side effect so the first
  paint is already right. Each accent declares a light pair and a dark pair (`--a-l`/`--a-d`); the
  mode blocks choose between them. The dark token block is written twice — once under
  `prefers-color-scheme` and once under `[data-mode='dark']` — and the two must stay in step.
  `light-dark()` would merge them but needs iOS 17.5+.
- **`--bg`, `--surface` and `--inset` are three different tiers** and the default theme makes the
  first two the same white. Anything sunken *inside* a card (chips, badges, the segmented control)
  must use `--inset`, or it disappears.
- **A sticky bar must be opaque.** `.room-bar` used to fade out over its own bottom edge, so
  content scrolling under it showed through and the top of the screen looked blurred on a phone.
  The soft edge belongs in `::after`, below the bar.
- **Cover art has to survive two crops** (`src/games/art.ts`). It is drawn on 640x200 and `slice`-cropped into a 2:1
  card (sides trimmed) and a ~5:1 lobby banner (top and bottom trimmed), so anything that matters
  lives inside x 120-520, y 34-166. The canvas started at 320x160 and the banner cropped three
  times into the middle of it.
- **`--bg` is a `color-mix()`**, so reading it back with `getPropertyValue('--bg')` returns the
  literal `color-mix(...)` text, not a colour. `applyTheme` takes the computed
  `backgroundColor` off `document.body` instead, for the `theme-color` meta.
- **The backdrop is three forms in one component, picked by CSS.** `shell/Backdrop.tsx` renders
  the waves, the smoke and the particles every time, and `data-backdrop` on `<html>` shows one —
  the same trick `data-accent` and `data-mode` use, so switching needs no React state. A hidden
  form is `display: none`, which stops its animations rather than leaving two unseen ones running
  down the battery.
  - **The waves loop by translating exactly one period.** Each layer is two viewports wide and
    holds two periods of the same wave, so `translateX(-50%)` is seamless. Change the period and
    the animation has to change with it.
  - **The smoke drifts on `alternate`**, not a loop back to the start: a cloud that teleports
    home is the one thing that gives it away as a short animation on repeat.
  - **A particle's rise is in pixels, not percent.** A percentage in `translate` resolves against
    the element's own box, and a mote is 4px across — asking for 60% moved them three pixels.
  - The particle scatter comes from `Math.sin()` on each mote's index, not `Math.random()`, so the
    arrangement is the same on every load instead of rearranging itself on every navigation.
    Negative delays start them part-way up, so the band is full on the first frame.
  - All three honour `prefers-reduced-motion`, and a mote needs its resting opacity set directly
    there, because without the animation it would never fade in.
- **An optimistic stone has to outlive the write that replaces it.** `games/gomoku/Room.tsx`
  draws the stone locally the instant it is tapped and keeps drawing it until the shared state
  actually contains it — identically to a real one, so the handover is invisible. Dropping the
  local copy when the write starts made the stone blink out for the length of the round trip.
- **Taking a move back is a request, not an action.** A stone is on the opponent's board the
  moment it is played, so there is no window in which it is private and no way to withdraw it
  alone. `requestTakeback` / `respondTakeback` need the opponent's agreement, and approving
  unplays everything back to the asker's last move — one stone, or two if the reply has landed.
  `canRequestTakeback` is exported so the button and the reducer cannot disagree.
- **Dice** are rolled on the device (`throwDice()`) and passed in the action; the reducer only
  checks they're two numbers from 1 to 6.
- **`beforeinstallprompt` fires once and early**, usually before React has mounted, so
  `src/hooks/useInstall.ts` registers its listeners at module load and `main.tsx` imports it for
  that side effect. Moving the listener into a component loses the event and the Install button
  never appears. iOS Safari never fires it at all and needs the written-out share-sheet steps.

## Offline

The service worker precaches the whole shell, so the app opens with no connection. What works then:

| | Offline |
|---|---|
| Opening the app, signing in *again* | Yes — Firebase Auth persists the user, and `useAuth` falls back to the last access answer it cached in localStorage |
| Gomoku vs the computer | Yes, entirely. `games/gomoku/Solo.tsx` imports nothing from `src/services` |
| Hanoi Tower | Yes. Completed scores wait per user on the device; the leaderboard needs a connection |
| Room lists | Stale. Firestore serves its cache and does *not* raise an error, so what is on screen may be gone |
| Anything in a room | No. Every move is a transaction against the server |
| First ever sign-in | No. Google sign-in needs the network |

`useOnline()` + `<OfflineNotice />` exist to explain that and to disable the actions that cannot
work. `navigator.onLine` only says the device has *a* network, never that Firestore is reachable,
so it is used to explain and disable — never to decide whether something succeeded. The operations
that need the server still report their own errors.

## Playtesting without deploying

```bash
npm run dev:memory
```

The in-browser backend. **Two browser tabs are two players** — each tab gets its own identity
from `sessionStorage` (the first is the admin), and they see each other's moves through a
`BroadcastChannel`. No Firebase, no deploy.

That still means a lot of clicking for a four-player Monopoly, so `DevBar` (bottom-left, dev
builds only) short-circuits it from a single tab:

- **Acting as** — switch this tab's identity, so one screen can take every turn.
- **Invent another player** — a new identity without opening a tab.
- **Seat someone in this room** — drops them straight in, skipping ask-and-approve.

It is gated on `import.meta.env.DEV` *and* the backend exposing `dev`, so it cannot appear in
production. Its styles are a string inside the component rather than a `.css` import, because a
static CSS import ships whether or not the component renders — check with
`grep dev-bar dist/assets/*` after a build if you touch it.

`MemoryDevTools` is deliberately **not** on the `Backend` interface: no real backend could offer
"become another user", and `DevBar` is the only caller.

## Testing

```bash
npm test               # games, AI, room rules, and the memory adapter end to end
npm run test:rules     # firestore.rules against the emulator (needs Java installed)
```

`src/adapters/memory/rooms.test.ts` drives the room layer the way two phones would — create, ask,
approve, play out of turn, leave, hand over, reap. Point it at a new adapter to check it.

To confirm the rules registry has not picked up React (rule 2 above):

```bash
npx esbuild src/adapters/firebase/index.ts --bundle --platform=neutral \
  --resolve-extensions=.ts,.tsx --outfile=/dev/null --metafile=meta.json --external:firebase/*
```

Nothing in `meta.json`'s inputs should be a `.tsx`, a `.css`, or React.
