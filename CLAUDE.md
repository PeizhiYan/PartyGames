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
│  ├─ hanoi/         rules (+tests) · Solo Board Leaderboard Art
│  ├─ xiangqi/       engine rules ai (+tests) · Room Board Solo Art
│  ├─ chess/         engine rules ai (+tests) · Room Board Pieces Solo Art
│  ├─ yahtzee/       rules ai computers (+tests) · Table Room Solo Art
│  ├─ uno/           cards rules ai computers (+tests) · Card Table Room Solo Art
│  ├─ mahjong/       tiles hand scoring rules ai computers (+tests) · Tile Table Room Solo Art
│  ├─ shuffle.ts     seeded rng + shuffle + newSeed, for any game that deals
│  ├─ cast/          Character faces, Seat, moments, Setup, Seating, Opponent, Confetti
│  ├─ local.ts       useLocalGame: any GameDefinition, played on-device with computer and guest seats
│  ├─ turns.ts       useComputerTurns: plays a game's ComputerPolicy, solo or in a room
│  └─ roomComputers.ts  computers in a room: the host's seating controls, which device drives
├─ rooms/          the multiplayer layer games plug into: rules, computers, useRooms, RoomList
├─ services/       the backend contract
├─ adapters/       firebase/ and memory/ — the only places that know a backend exists
├─ i18n/           languages: en (the reference) zh ja, the provider, the privacy policy
├─ ui/             design-system primitives: Icon Sheet Toast Segmented Avatar Flag
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
secret**: a hidden hand in the room document is readable by anyone in the room, whatever the UI
does. **Decided (2026-11-16): UNO and Mahjong run on the trusted-client model anyway**, the same
one the Hanoi leaderboard runs on — hands and the deck live in the room document, the UI shows
only the viewer's own hand, and someone who opens devtools can cheat. The right trade for a room
of friends. Two rules keep a later move to per-player documents mechanical: private things live
in their own top-level state keys (`hands`, `deck`), and a UI component may index `hands` only by
the viewer's uid or read another player's `.length`. The full plan for the remaining games,
including this, is `docs/games-plan.md`.

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
zone before drawing. Every game also needs an `AppIcon` (120x120) for the home screen on a phone.

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

## Solo modes are the room's reducer

Every "vs the computer" screen runs the game's own `GameDefinition` through `games/local.ts`
(`useLocalGame`), with a made-up room whose other seats are the computer. The AI takes its turn
through the same `reduce` a friend would, so a game cannot behave one way against a person and
another against the engine, and a solo undo is just "request the takeback as you, approve it as
the computer". Gomoku predates this and keeps its own solo loop; everything from Chinese Chess
on uses the hook. It imports nothing from `src/services`, so solo play works offline.

`act` reduces from a ref of the latest state, not the render's copy: React batches `setState`,
and the computer acting straight after you must see your move. `generation` is bumped on reset
so a reply already on its way is thrown away.

## Computer players

A computer is an ordinary `RoomPlayer` whose uid starts with `computer` (`rooms/computers.ts`), so
every game seats it without knowing it is one, and the cast gives it its fixed face and name.

- **Each game's computers are a `ComputerPolicy`** in `<game>/computers.ts`: a pure function from
  the state to the moves its computers would make now, each with who makes it, its actions and a
  delay. `useComputerTurns` (`games/turns.ts`) plays the soonest. Solo screens run it against
  `useLocalGame`; rooms run it against the backend. One policy, so a computer cannot play
  differently alone and in a room. `games/computers.test.ts` plays whole games with nothing but
  computers through the real reducers.
- **A move's delay runs from when it was first offered**, not from the latest change. UNO's catch
  waits 2.5 s of grace while other computers keep playing; restarting its clock on every move meant
  it never fired. `chance` (catching only 60% of the time) is rolled once per offer for the same
  reason: re-rolling on every change makes "sometimes" into "eventually".
- **In a room, one device plays the computers** (`computerDriver`): the host's, or — when the host
  has not checked in for `PRESENCE_TIMEOUT_MS`, say a locked phone — the longest-standing person
  who has. Two devices driving at once would play a turn twice. It acts through
  `rooms.act(roomId, action, as)`, which any player may use, but only `as` a computer in that room.
  The Firestore rules already let a player rewrite the roster, so seating computers needed no rules
  change; they still cap a room at eight (`ROOM_LIMIT`), which is why UNO stops seating there.
- **Computers never keep a room alive or own it.** The host's seat passes to the next *person*, and
  the last person out still deletes the room (`afterLeaving`).
- `GameDefinition.computerPlayers` says a game has them (Yahtzee, UNO, Mahjong). The host adds and
  removes them in the lobby only: a game seats newcomers between rounds, never mid-round.

## Several people on one device

`localRoster` mixes you, computers and guests (`guest`, `guest-2`, … — people with no account).
Yahtzee's setup lets each seat be a computer or a named person; chess, Chinese chess and Gomoku
have an Opponent card ("A friend, here").

- **The action is played as whoever holds the device**: the person to move. Between two friends
  at chess that is the side to move; at Yahtzee the person whose turn it is, or while a computer
  moves, whoever moved last, so the screen does not jump back to you between other people's turns.
  Starting another game is still the host's (you).
- **Nobody is "You" on a shared device** (`hotseat` on the Yahtzee table): it would mean a
  different person every turn, so everyone is called by name.
- Between friends the tally is kept by colour and the colours do not swap — the two of you can
  swap chairs. The board turns to the side to move by default ("The board" card), or stays put for
  a device lying flat between you.
- UNO and Mahjong are not offered this way: their hands are hidden, and a shared screen cannot hide
  one player's hand from the next.

## Chinese Chess: the port

`games/xiangqi/engine.ts` is XiangQi Wizard Light (`position.js` + `search.js` from
`../PeizhiYan.github.io/js_codes/chinese_chess`) in TypeScript, kept line-for-line where the
language allows so its strength carries over: a 16x16 board with the 9x10 playing area at files
3-11 / ranks 3-12, moves as `src + (dst << 8)`, piece-square evaluation, alpha-beta with a
transposition table, killers, history, null-move and quiescence. The opening book is left out —
300KB for a few more varied first moves.

- **The reducer stores only the move list** and replays it from the start position whenever it
  needs the board (`positionOf`). A hundred moves replay in well under a millisecond; a stored
  board would have to be kept in step with the engine's zobrist keys and repetition history.
- **End conditions are the engine's verdict** (`settle()`): mate (which includes stalemate —
  no legal move loses in xiangqi), repetition with the perpetual-check rule deciding who loses,
  no attacking material left after a capture, and fifty moves without one. The bare-board draw
  counts *both* sides' pieces: a rook that stays on the board is still attacking material.
- `MoveSort.next` is a ladder of ifs rather than the original's fall-through switch, because the
  project forbids fall-through. Same order, same early returns.
- `Search` takes an injectable random source, so the engine test can prove it deterministic.
- The board flips for black (`viewer`) by remapping piece positions only; the river's writing is
  never rotated — it faces whoever is looking. A rim is a stroke and a character a fill: giving
  the rim a fill paints over the disc and hides the character, which is how the first render
  came out solid.

## Chess

`games/chess/engine.ts` is our own: an 8x8 mailbox (`Int8Array(64)`, signed pieces, a1 = 0),
moves as `from | (to << 6) | (promotion << 12)`. Legality is decided the plain way — make the
move, see whether the mover's king is attacked, unmake — which is slower than pin detection but
gets castling-through-check and en-passant pins right with no special cases.

- **`engine.test.ts` is perft.** Node counts from the Chess Programming Wiki for the start
  position, Kiwipete, and positions 3 and 4 to depth 3. If a rule is wrong, a count is wrong;
  do not change the generator without running it.
- **A promotion is part of the move**, so a pawn reaching the last rank with no promotion type
  is simply not a legal move. `Board.tsx` opens a sheet to ask which piece, then plays the full
  code. The reducer never has to guess.
- Draws the reducer settles (`settle()`): stalemate, insufficient material (bare kings, one
  minor, or same-shade bishops), fifty moves on the halfmove clock, and threefold repetition —
  `replay()` returns the list of position keys alongside the board for the last one.
- The computer (`ai.ts`) is alpha-beta with piece-square tables, captures searched to quiet,
  and iterative deepening against a time budget. A result from an iteration that ran out of
  time is partial and is thrown away in favour of the last complete one. `random` is injected
  so the tests are deterministic.
- **The pieces are Font Awesome Free 5's chess glyphs** (`Pieces.tsx`, CC BY 4.0, credited in
  README) rather than Unicode's ♔♕♖, which are a different drawing in every font and render as
  emoji on some phones. White pieces are ivory with a dark outline and black ones charcoal with
  a light one (`paint-order: stroke`), so each reads on both shades of square.

## Yahtzee

- **Dice arrive on the `roll` action** (`throwFive()` on the device) and the reducer replaces
  only the dice that are not held. That keeps the reducer pure and also means a client cannot
  send a hand-picked five: a roll can only change what the rules let change.
- **The joker rule** (`jokerState`): a Yahtzee rolled with the Yahtzee box already filled must go
  in its matching upper box if that is open; otherwise any open box, with full house and the
  straights scoring their full value. A bonus of 100 is paid only if the Yahtzee box holds 50.
  `choices()` is the single answer to "where may these dice go", used by the reducer, the
  scorecard's buttons and the AI alike, so the three cannot disagree.
- `Table.tsx` is the whole screen and is shared by `Room` and `Solo`; they differ only in where
  `act` goes. On your turn each open box in your column is a button showing what it would score,
  and the best one is filled in.
- **Layout:** on a phone the paper scorecard comes first and the felt dice tray is
  `position: sticky` at the bottom, so a whole turn needs no scrolling. From 880px the tray moves
  left and the card right (`wide: () => true`). Every box's name opens a sheet explaining it with
  an example roll (`help.ts`); on a wide screen a one-line version sits under the name.
- **The tumble lands upright:** the keyframes start spun and in the air and end at `rotate(0)`.
  Ending on the spin left dice crooked. The dice row is keyed on turn and roll count, because a CSS
  animation only replays on a fresh element.
- A tie is announced as a tie.
- The computer (`ai.ts`) is a list of rules, not a search: keep the largest group, chase four to
  a straight, take the big boxes when they appear, zero the cheapest box when nothing fits. The
  policy in `computers.ts` plays it one beat (800 ms) at a time so a turn can be followed.
- Dice faces live in `src/ui/Die.tsx` for any game; with `onToggle` a die is a hold button.

## The cast: faces, moments and setup

`games/cast/` is shared by every table game, so a table reads as people rather than names.

- **Characters** (`Character.tsx`): eight cartoon species drawn in SVG, five expressions (idle,
  thinking, happy, sad, surprised). Computer players are a fixed cast — Dot is always the robot —
  so you learn who you are playing. People get a character from their uid, and
  **`assignSpecies(uids)` makes them distinct per table**: picking by uid alone sat a person next
  to a computer of the same species. Pass its result as `species` wherever a face is drawn.
- **Moments** (`moments.ts`): reducers know nothing about animation, and must not — the same
  state arrives from a friend's device. A table derives what *just happened* by comparing the
  previous state with the new one (`useMoments(state, detect)`), and each moment lives a second or
  two to drive a bubble, an expression or a flying card. `bubbleFor` / `expressionFor` read them.
- **Setup** asks how many players before a solo game, showing the faces you would be playing.
  Mahjong passes `fixed` (always four).
- Everything animates on `transform`/`opacity` only and stops under `prefers-reduced-motion`.
  Faces blink on their own clocks (`jitter`) so a table never blinks in unison.

## UNO

- **Cards are ids** — indices into `DECK` in `cards.ts` — so the room document holds short arrays
  of numbers, and two copies of the same face are still two different cards. Tests assert after
  every move of fifty seeded games that each of the 108 ids is in exactly one place.
- **The deal is a pure function of the seed** on `start`/`again` (`shuffle.ts`). Draws take from
  the end of `deck`; an empty deck reshuffles the pile under its top card with
  `seed + reshuffles`, so a round replays exactly from its actions.
- **House rules are written at the top of `rules.ts`** and nowhere else: the first card is always
  a number; +2 stacks on +2 and +4 on +4 only; no draw-four challenge; a drawn card that fits may
  be played at once, one that does not passes the turn; anyone on one or two cards may call UNO,
  and anyone may catch a player on one who has not. Change a rule there and in its test together.
- **A player who leaves mid-round is skipped, not removed** (`absent`), so nobody's hand vanishes
  and turn order stays sane. Seats follow the room again between rounds.
- `state.last` is a sentence about what just happened. With three computers moving, the table is
  unreadable without it.
- `computers.ts` gives the computers human flaws on purpose: they call UNO 85% of the time (so
  you can catch them) and catch a person 60% of the time, after 2.5 s of grace. They never catch
  each other. See "Computer players" for why the grace is not reset by other players' moves.
- **The round table** (`Table.tsx`): seats sit round an oval with the viewer at the bottom and play
  running clockwise, so turn order is what you see. The table is a CSS **size container**, so a
  card can fly from a seat to the pile with `translate(Xcqw, Ycqh)` — percentages of the table —
  with no measuring in JavaScript. The pile keeps its last four cards at tilts derived from their
  ids, so it looks thrown-down and never reshuffles on a re-render. The felt's rim glows in the
  active colour; dashed arrows circle the table in the direction of play. On a phone a seat's fan
  of card backs is capped at five, or the side seats run off the screen.
- `Card.tsx` draws every card in SVG. A `clipPath` is resolved in the coordinates of the element
  using it, so it has to sit on an untransformed group: on the translated one it clipped the
  middle of every card down to its bottom-right corner, which is how the first render came out.

## Mahjong

One variant, chosen and written down: 136 tiles, four players, **simplified Guangdong-style
scoring**. The rule choices are at the top of `mahjong/rules.ts`; the fan table is at the top of
`mahjong/scoring.ts`, one test per line.

- **Tiles are 0-135, kinds are `tile >> 2`** (34 of them), the same id trick as UNO's cards.
  `testTiles.ts` writes hands by name (`b(3)`, `c(5)`, `R()`) and hands out a fresh copy each
  call — call `fresh()` between hands in one test or it runs out of copies.
- **`isStandardWin` is complete with only two branches**: the lowest kind left must start either
  a pong or a chow. Seven pairs and thirteen orphans need all fourteen tiles concealed.
- **The reducer drives the loop itself.** After a discard it opens a claim window only for players
  who could use the tile and passes the rest automatically; when every answer is in it resolves
  (win > kong/pong > chow, nearest to the discarder on a tie), or the next player draws on their
  own. So a room never taps "pass" thirty times a hand. The cost: the table can see that someone
  is thinking about a discard.
- **A set called on the tile that completes your hand is the win.** Strictly, a pong then leaves
  you holding a complete hand you may not declare — a win after a call needs a drawn tile — so a
  player who tapped Pong instead of Mahjong was stuck discarding out of a finished hand. `respond`
  records such a call as `win`, and the call bar offers only Mahjong and Pass on that tile.
- **The newest tile is last in its hand**, so "the tile just drawn" needs no field naming a tile
  in a hand — which would break the hidden-hands rule. `justDrew` (a boolean) is what enables a
  self-drawn win.
- **A player who leaves mid-hand** has their claims passed for them, and the host gets a button
  (`cover`) to play their turn by discarding the tile they just drew.
- **The square table** (`Table.tsx`) seats players as at a real table: the next player on your
  right (play runs that way), the one opposite on top, the previous one — the only one you may
  chow from — on your left. Each player's discards lie in a pond in front of them, the four ponds
  in a pinwheel round a compass whose arrow lights towards whoever is to move. Your own tiles are
  in a wooden rack below the table, at full size. Tile sizes are custom properties (`--pt`,
  `--mt`, `--bt`) set per breakpoint, and the table is capped by the screen's height so the table
  and your rack fit on one screen. Calls pop up as bubbles (碰 Pong, 吃 Chow, 槓 Kong, 胡 Mahjong).
- The computer (`ai.ts`) plays tile efficiency: keep tiles with partners, discard the loneliest,
  prefer tiles already seen discarded. The most valuable test in the folder is fifty seeded hands
  played out by four computers, checking after every action that all 136 tiles are in exactly one
  place, and that every hand's payments sum to zero.
- Payments: 2^fan; a discarder pays three shares; the dealer's payments double — only when the
  dealer is the payer or the winner. (The first version doubled a discard whenever the dealer was
  merely at the table.)

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

## Languages

English, Simplified Chinese and Japanese, done the CoffeeGlass way: `src/i18n/en.ts` is the
reference and `zh.ts` / `ja.ts` are typed as `Messages`, so a missing key fails the build. `t` is a
plain module value swapped by `applyLanguage`; `<LanguageProvider>` holds the choice (the device
language, or one picked in Settings and kept in localStorage) and `<LanguageScope>` remounts the
screens when it changes. Sentences with numbers or names are functions, so each language controls
its own word order; a sentence with a bold part in the middle is split into before and after.

- **A game's words live in its folder**, in `<game>/messages.ts`, all three languages side by
  side, read through `byLanguage({ en, zh, ja })` as `m()`. A game owns its folder, translations
  included. Words more than one game uses (turns, takebacks, common rule errors) are in the app's
  messages under `cast`, `duel` and `rules`.
- **A game's name, tagline and solo labels are getters** on its `GameDefinition`, so every
  `game.name` in the app follows the language with no change at the call site.
- **Rule errors are written in the language of the device that made the move.** A reducer throws
  `GameRuleError(m().errors.…)`; the error never enters the shared state, and only that player
  sees it.
- **Nothing in shared state is a sentence.** A room is read by everyone in it, maybe in three
  languages, so UNO's and Mahjong's "what just happened" (`last`) is a note — `{ k: 'played', who,
  card }` — worded on each screen by `noteText`. Where the rules already stored English (chess and
  Chinese chess end reasons, Mahjong's scoring lines, Monopoly's cards and money notes), the
  English is the key and the screen translates it (`reasonText`, `fanLine`, `cardText`,
  `noteText`). An old room holding a plain sentence still shows it as it was.
- **Left as written:** people's names, room names, what players type, and Monopoly's street names,
  which are each city's own (the China and Japan boards are already in local script).

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
- **A sticky bar must be opaque, full width, and fade only over empty page.** `.room-bar` used to
  fade out over its own bottom edge, so content scrolling under it showed through and the top of
  the screen looked blurred on a phone. The soft edge belongs in `::after`, below the bar — over
  the bar's own bottom margin, or at rest it fades the first thing on the page and the header
  looks as if it covers it. The bar also reaches out over `.room-screen`'s 16px gutters
  (negative margin), or content and its shadow show either side of it as they scroll under, and
  it carries the top padding and safe-area inset so a stuck bar covers the status-bar strip.
- **Cover art has to survive two crops** (`src/games/art.ts`). It is drawn on 640x200 and `slice`-cropped into a 2:1
  card (sides trimmed) and a ~5:1 lobby banner (top and bottom trimmed), so anything that matters
  lives inside x 120-520, y 34-166. The canvas started at 320x160 and the banner cropped three
  times into the middle of it. A phone's home screen does not crop it at all: it shows
  each game's own `AppIcon`, a square 120x120 drawing of one bold subject. A square crop of the
  cover was tried first and lost most of every picture.
- **`--bg` is a `color-mix()`**, so reading it back with `getPropertyValue('--bg')` returns the
  literal `color-mix(...)` text, not a colour. `applyTheme` takes the computed
  `backgroundColor` off `document.body` instead, for the `theme-color` meta.
- **The backdrop is three forms in one component, picked by CSS.** `shell/Backdrop.tsx` renders
  the waves, the smoke and the particles every time, and `data-backdrop` on `<html>` shows one —
  the same trick `data-accent` and `data-mode` use, so switching needs no React state. A hidden
  form is `display: none`, which stops its animations rather than leaving two unseen ones running
  down the battery.
  - **All three draw the same three wave layers**, from one `LAYERS` array. Smoke is those waves
    blurred until the crests dissolve; particles are motes scattered along the same curves. They
    were three unrelated decorations first — drifting cloud blobs and motes rising from nowhere —
    and the band stopped looking like the same app when you switched. Keep them one swell in
    three materials.
  - **The period is 720 of the viewBox's 1440.** Each layer is two viewports wide and holds two
    periods, so `translateX(-50%)` is exactly one period and the loop has no seam. **Anything
    positioned along a layer has to repeat on that same period**: the motes seed every random
    number off `c % COLUMNS` rather than the absolute column for exactly this reason, or the
    scatter reshuffles halfway along and the loop visibly jumps.
  - `LAYERS` carries `base` and `amp` beside each path, describing the same curve the path draws
    (`y = base - amp·sin(2πx / 720)`), so the motes can sit on it without anyone parsing an SVG
    path. Change a path and change those too.
  - **The smoke's breathe is on an inner element.** The outer one is already using `transform`
    for the drift and one element cannot run two. It hangs 36px below the band so the blur never
    softens the bottom edge into a gap, and carries about twice the waves' opacity — blur spreads
    the ink thin, but at three times the three layers piled up into a solid orange band.
  - **The spray drifts `SPRAY_SLOWDOWN` times slower than the water.** At the waves' own pace a
    few hundred dots look like they are being dragged sideways rather than hanging in the air.
  - **Each mote also wanders**, around three waypoints and back so it traces a loop rather than
    retracing a line, fading as it goes. The sideways travel is still the layer's; the wander
    only unsticks the motes from moving as one sheet. Its reach is deliberately larger vertically
    than horizontally, for the same reason.
  - **Only `transform` and `opacity` are animated, and the fade shares the wander's keyframes.**
    Animating `left`/`top` on this many elements lays the page out every frame, and a second
    animation would double the per-mote cost for no gain. There is no `will-change` on a mote:
    it would promote all 432 to their own compositing layers. The count came down from 576 when
    they started moving — motion does the work density was doing before.
  - **The wander has to repeat on the period too.** A mote and its counterpart one period away
    share a seed, so they share a path, a duration and a delay, and are at the same point of the
    same wander when the layer jumps home. Check it arithmetically rather than by eye; the error
    should be at floating-point noise.
  - All three honour `prefers-reduced-motion`.
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

**Animations need a real browser.** A static render (`renderToStaticMarkup`) never runs effects,
so moments — and everything they animate — are absent from it. To check one, bundle a small entry
that mounts the real table with `react-dom/client` and switches state on a timer, then screenshot
it partway through with headless Chrome's `--virtual-time-budget=<ms>`, which runs timers and
animations deterministically up to that point.

To confirm the rules registry has not picked up React (rule 2 above):

```bash
npx esbuild src/adapters/firebase/index.ts --bundle --platform=neutral \
  --resolve-extensions=.ts,.tsx --outfile=/dev/null --metafile=meta.json --external:firebase/*
```

Nothing in `meta.json`'s inputs should be a `.tsx`, a `.css`, or React.
