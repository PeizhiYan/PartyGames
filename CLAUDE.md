# PartyGames — Developer Guide

## What this is
A PWA of party games for a small group of friends, sharing one Firebase project with CoffeeGlass.
Read `README.md` first — it covers setup, deployment and the admin tools. This file is the
orientation for working in the code.

## The shape of it

```
pages → components/hooks → services → adapters
                  ↘ domain ↙          (domain depends on nothing)
```

Three rules hold the whole design together:

1. **`src/domain/` is pure.** No React, no `firebase`, no `Date.now()`, no `Math.random()` inside a
   reducer — time comes in as `ctx.now`, dice come in on the action. That is what makes the games
   testable, and what lets the backend run a reducer inside a transaction.
2. **Only `src/adapters/firebase/` may import `firebase`.** Everything above it talks to the
   interfaces in `src/services/types.ts`.
3. **A game is a `GameDefinition`**: `newState`, `reduce(state, action, ctx)`, and optionally
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

| Thing | File |
|---|---|
| The vocabulary (`Room`, `AppUser`, `GameDefinition`) | `src/domain/types.ts` |
| Join codes, staleness, who-may-do-what | `src/domain/rooms.ts` |
| The list of games | `src/domain/games.ts` |
| Gomoku geometry and win detection | `src/domain/gomoku/board.ts` |
| The Gomoku computer opponent | `src/domain/gomoku/ai.ts` |
| Gomoku's two-player rules | `src/domain/gomoku/game.ts` |
| MonopolyBuddy's whole state machine | `src/domain/monopoly/game.ts` |
| The backend contract | `src/services/types.ts` |
| Firestore transactions, queries, presence | `src/adapters/firebase/rooms.ts` |
| The dev backend (two tabs can play each other) | `src/adapters/memory/index.ts` |
| Theme tokens, every shared class | `src/styles/global.css` |

## Adding a game

1. `src/domain/<game>/game.ts` exporting a `GameDefinition`.
2. Add it to `GAMES` in `src/domain/games.ts`.
3. `src/components/<game>/<Game>Room.tsx`, taking `{ room, uid }`.
4. Add it to the `Game` pick in `src/pages/RoomPage.tsx`.
5. Add its id to `d.game in ['gomoku', 'monopoly']` in `firestore.rules`.

For a game playable alone, set `solo: true` and add a branch to `SoloGame` in `src/App.tsx`
(the route `/g/:game/solo` already exists).

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

## Gotchas

- **`clean()`** in the Firebase adapter is a JSON round trip that strips `undefined` (Firestore
  refuses it). It would also flatten `Date`s, which is fine because game state stores times as
  epoch-millisecond numbers — keep it that way.
- **Firestore forbids an array directly inside an array.** `seats[].dice` is fine (array inside a
  map inside an array); `[[1,2]]` would not be. Gomoku's board is a flat 225-cell array for this
  reason.
- **`updatedAt` on a heartbeat**: see Rooms above. Changing that needs the rules changed too.
- **The board arrives as a fresh array on every snapshot**, including an opponent's heartbeat, so
  don't hang UI state off board identity (`GomokuBoard` watches `placing` instead).
- **`firestore.rules` is the whole project's rules file.** Deploying from here replaces
  CoffeeGlass's. See the warning in `README.md` and at the top of the file.
- **Dice** are rolled on the device (`throwDice()`) and passed in the action; the reducer only
  checks they're two numbers from 1 to 6.
- **`beforeinstallprompt` fires once and early**, usually before React has mounted, so
  `src/hooks/useInstall.ts` registers its listeners at module load and `main.tsx` imports it for
  that side effect. Moving the listener into a component loses the event and the Install button
  never appears. iOS Safari never fires it at all and needs the written-out share-sheet steps.

## Testing

```bash
npm test               # games, AI, room rules, and the memory adapter end to end
npm run test:rules     # firestore.rules against the emulator (needs Java installed)
```

`src/adapters/memory/rooms.test.ts` drives the room layer the way two phones would — create, ask,
approve, play out of turn, leave, hand over, reap. Point it at a new adapter to check it.
