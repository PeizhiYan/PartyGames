# Plan: Yahtzee, UNO and Mahjong

Written for: the model finishing these three games. Read `CLAUDE.md` first — it is short and
everything below assumes it. Then read these, in this order, because the new games copy them:

1. `src/games/chess/rules.ts` + `Solo.tsx` + `Room.tsx` — the room/solo pattern every game uses.
2. `src/games/local.ts` — `useLocalGame`: a solo mode is the room reducer run on the device.
3. `src/games/monopoly/rules.ts` lines 150-215 — `syncSeats`, `requireOwner`, `start` with a seed.
4. `src/games/yahtzee/rules.ts` — already written (see "Yahtzee" below).

## Working rules (from the owner, non-negotiable)

- Work on branch **`playtest`**. Never commit to `main`. **Do not open a PR** unless asked.
- Commit after each game lands, with a bump of `version` in `package.json`: one new game = minor
  (`0.14.0 → 0.15.0 → 0.16.0 → 0.17.0`). The WIP commits already on the branch are fine.
- Before every commit: `npx tsc --noEmit && npm run lint && npm test && npm run build` all clean.
- No `Math.random()`, `Date.now()`, React or `firebase` inside a reducer. Randomness arrives on
  the action (`dice`, `seed`); the reducer only validates it.
- No emoji in game UI (the `emoji` field on the definition is the one exception — it is only
  used on the home/lobby cards). Draw things with SVG or the shared `Icon`.
- `tsconfig` has `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. A
  `switch` with fall-through will not compile; write a ladder of `if`s.
- A new game's `id` is not in `GameId` until it is registered, so a WIP `rules.ts` uses
  `id: 'name' as GameId` with a TODO (Yahtzee's does). Remove the cast when registering.

## Registering a game (the same four edits every time)

1. `src/types.ts` — add the id to the `GameId` union.
2. `src/games/registry.ts` — import the definition, add it to `GAMES_BY_ID` (order = home screen).
3. `src/games/screens.tsx` — import `Art`, `Room`, `Solo`; add `{ Room, Solo, Art }`.
4. `firestore.rules` — add the id to `d.game in [...]`.

Then: `README.md` Features bullet + delete the roadmap table row + credits if any; `CLAUDE.md`
"Where things live" tree + a short section of decisions for the game.

## Verifying visually (the harness, so you do not ship blind)

```bash
# 1. build once so the CSS exists
npm run build
# 2. render components to static HTML
cat > .render.tsx <<'TSX'
import { renderToStaticMarkup } from 'react-dom/server';
import Thing from './src/games/<game>/<Component>';
process.stdout.write(JSON.stringify({ a: renderToStaticMarkup(<Thing {...props} />) }));
TSX
SP=/tmp/render; mkdir -p $SP
npx esbuild .render.tsx --bundle --platform=node --format=cjs --jsx=automatic --loader:.css=empty \
  --define:import.meta.env='{"VITE_BACKEND":"memory"}' --outfile=$SP/r.cjs --log-level=error \
  && timeout 20 node $SP/r.cjs > $SP/r.json && rm .render.tsx
# 3. wrap in a page with ALL built css (there can be several files) and screenshot
python3 - <<'PY'
import json,glob
css=''.join(open(f).read() for f in glob.glob('dist/assets/*.css'))
d=json.load(open('/tmp/render/r.json'))
for mode in ('light','dark'):
    open(f'/tmp/render/{mode}.html','w').write(f'<!doctype html><html data-mode="{mode}" data-accent="sunset"><head><meta charset="utf-8"><style>{css}</style></head><body style="margin:0;padding:12px;max-width:420px">{d["a"]}</body></html>')
PY
google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=440,800 --screenshot=/tmp/render/light.png /tmp/render/light.html
```

Then look at the PNG. Components that use hooks render fine through `renderToStaticMarkup`;
anything that needs `useGameAction` (a `Room.tsx`) renders if you define `VITE_BACKEND=memory`
as above. Screenshots only show the first animation frame.

Also run the React-free check once per game (the adapters import `registry.ts`):

```bash
npx esbuild src/adapters/firebase/index.ts --bundle --platform=neutral --resolve-extensions=.ts,.tsx \
  --outfile=/dev/null --metafile=/tmp/meta.json --external:firebase/* --log-level=error \
  && python3 -c "import json;m=json.load(open('/tmp/meta.json'));print([k for k in m['inputs'] if k.endswith(('.tsx','.css')) or 'node_modules/react' in k] or 'clean')"
```

## The hidden-information decision (UNO, Mahjong)

**Decided: the trusted-client model.** Hands and the deck live in the room document; the UI
never shows another player's hand; someone who opens devtools can see it. This is the same
model the Hanoi leaderboard already runs on, and it is the right trade for a room of friends.
Two things make the later move to per-player documents mechanical, so do them from the start:

- Keep private things in their own top-level keys of the state: `hands: Record<uid, Card[]>`
  and `deck: Card[]`. Nothing else in the state may mention a specific card in a hand.
- Every UI component takes the *viewer's* uid and reads only `hands[viewer]`; other players
  get `hands[uid].length` and nothing more. Grep for `hands[` before committing: it must only
  be indexed by the viewer or by `.length`.

Shuffling: the `start` action carries a `seed` (from `newSeed()` on the device, like Monopoly).
The reducer shuffles with a seeded PRNG. Put this in `src/games/shuffle.ts` and share it:

```ts
/** mulberry32: a small seeded PRNG so a shuffle is a pure function of its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

Test it: same seed → same order; different seed → different order; it is a permutation.

Drawing from the deck is deterministic (take from the end), so no action needs randomness
after `start`. When the deck runs out in UNO, reshuffle the discard pile (minus its top) with
`seed + draws` so it stays reproducible.

---

## 1. Yahtzee — DONE (v0.15.0)

Shipped as described below; kept for reference.

### Original plan

`src/games/yahtzee/rules.ts` exists and is complete; read it. Exports you will use:
`CATEGORIES`, `CATEGORY_LABEL`, `UPPER`, `LOWER`, `scoreFor`, `choices(seat, dice)`,
`jokerState`, `upperTotal/upperBonus/lowerTotal/grandTotal`, `openCategories`, `seatOf`,
`currentSeat`, `isMyTurn`, `ranking`, `throwFive()`, `ROLLS_PER_TURN`, types `YahtzeeState`,
`Seat`, `Dice`, `Category`. Actions: `start` (host), `roll {dice}`, `hold {index, held}`,
`score {category}`, `again` (host). Phases `lobby | playing | results`.

(`choices()` under the joker with no `mustUse` allows any open box; `scoreFor` gives an upper
box that does not match 0, which is correct — nothing to fix there.)

### Files to add

- `src/ui/Die.tsx` — a flat die for any game. Copy `FACES` and `Die` from
  `src/games/monopoly/Dice.tsx` (do not import across game folders), add props
  `held?: boolean` and `onToggle?: () => void`; render as a `<button>` when `onToggle` is set.
  Styles: reuse `.die` from `global.css`; add `.die.held` (accent ring) and `.die.rolling`
  already exists. Put new CSS in `src/games/yahtzee/Yahtzee.css`.
- `src/games/yahtzee/ai.ts` — `export function chooseHolds(dice, seat, rollsLeft): boolean[]`
  and `export function chooseCategory(seat, dice): Category`. Heuristic, no search:
  - Category: take `choices(seat, dice)`; prefer, in order: yahtzee 50; largeStraight 40;
    fullHouse 25; smallStraight 30 (if large is already filled or dice can't improve);
    an upper box scoring ≥ 3×face (keeps bonus pace); fourKind/threeKind if sum ≥ 25/20;
    chance if sum ≥ 22; otherwise the open box with the lowest *expected loss*: zero `yahtzee`
    first if ones/twos are filled, else `ones`, `twos`, … Keep it readable: a list of rules.
  - Holds: if ≥ 2 of a kind, hold the largest group (prefer the higher face on ties, unless
    that group's upper box and the n-of-kind boxes are all filled); if 4 of a straight is
    present and a straight box is open, hold those four; else hold nothing on the first roll,
    and on the second hold the highest two dice only if chance is the best remaining box.
  Tests: it always returns a legal category (one of `choices`), and holds are a 5-array.
- `src/games/yahtzee/Table.tsx` — the shared screen, used by both Room and Solo:
  props `{ state, uid, act, busy, error, owner: boolean, players: RoomPlayer[], rolling?: boolean }`.
  Layout, top to bottom: turn pill ("Your turn · 2 rolls left" / "Ben's turn"); the five dice
  in a row (tappable to hold on your turn after a roll); a Roll button (primary, disabled when
  `rolls === 3` or not your turn); the scorecard as a table — rows are the 13 categories plus
  "Upper bonus", "Yahtzee bonus", "Total"; one column per seat, the current seat highlighted
  (`.score-side.turn` style). On your turn after a roll, each open cell in your column is a
  button showing the score it *would* get (grey if 0) — tapping it plays `score`. Results
  phase: a ranked list (`.rank-row`, winner with `Icon name="trophy"`), and for the host an
  "Again" button (`again`). Lobby phase: seated players list + host "Start" (`start`);
  non-host sees "Waiting for the host…". Keep tables scrollable horizontally on phones
  (`overflow-x: auto` wrapper) — six columns do not fit at 390px.
- `src/games/yahtzee/Room.tsx` — `useGameAction(room.id)` → `<Table …/>`. `owner =
  isOwner(room, uid)` from `src/rooms/rules`.
- `src/games/yahtzee/Solo.tsx` — `useLocalGame(yahtzee, players, uid)`; a `Segmented` for
  1/2/3 computer players (names "Dot", "Pip", "Ace"); on mount (and on "again") the human is
  owner, so `act({type:'start'})` after seats exist. A driver `useEffect`: when
  `isMyTurn(state, computerUid)` for any computer seat, after 500 ms: if `rolls === 0` roll
  (`act({type:'roll', dice: throwFive()}, cpu)`); else compute holds; if rolls < 3 and holds
  leave something to roll, apply holds (one `hold` act per changed die) then roll; else
  `score`. Use `generation` to drop stale timers. Copy the pattern from `chess/Solo.tsx`.
- `src/games/yahtzee/Art.tsx` — five large dice in a row showing 5-5-5-5-5, slightly rotated,
  on a green felt gradient; inside x 120-520, y 34-166.
- `src/games/yahtzee/rules.test.ts` — `scoreFor` for every category (include a full house that
  is also three of a kind; small straight inside 1-2-3-4-6; large straight 2-6); joker: second
  Yahtzee with box = 50 pays a bonus and must use the matching upper box when open; with the
  upper box filled it may take a full house for 25; `roll` only replaces unheld dice; `hold`
  refused before the first roll; `score` passes the turn and resets holds; everyone filling 13
  boxes → `results` and `ranking` order; `again` resets cards. Use the `ctx()` helper style
  from `chess/rules.test.ts`.

Register, docs, `v0.15.0`, commit.

---

## 2. UNO — DONE (v0.16.0)

Shipped largely as planned; the house rules actually chosen are at the top of
`src/games/uno/rules.ts`. 

### Original plan

### Rules (`src/games/uno/rules.ts`)

Deck: 108 cards. `Card = { color: 'red'|'yellow'|'green'|'blue'|'wild'; kind: '0'..'9' |
'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' }`. Build with `buildDeck()`: per colour one 0,
two each of 1-9, two skip, two reverse, two draw2; four wild, four wild4. Give every card an
`id: number` (its index in `buildDeck()`), and store cards in state **as ids only** — the UI
looks the card up. That keeps the document small and avoids objects in arrays of arrays.

State:
```ts
interface UnoState {
  phase: 'lobby' | 'playing' | 'results';
  seats: { uid; name; photoURL?; score: number }[];
  hands: Record<string, number[]>;   // uid -> card ids (PRIVATE, see decision above)
  deck: number[];                     // card ids, draw from the end
  discard: number[];                  // card ids, top is last
  turn: number;                       // index into seats
  direction: 1 | -1;
  activeColor: Color | null;          // after a wild; else the top card's colour
  pendingDraw: number;                // stacked draw2/draw4 to be taken by the next player (0 if none)
  drewThisTurn: boolean;              // drew a card and may now play it or pass
  uno: Record<string, boolean>;       // uid -> called UNO on their last-but-one card
  seed: number; draws: number;        // for reshuffles
  winner: string | null; round: number;
}
```
Actions: `start {seed}` (host; deals 7 each, flips a non-wild4 first card — if the first card is
an action card apply it to the first player as the real rules do, or keep it simple: redraw until
a number card; document which), `play {card: id, color?: Color}` (colour required for wilds),
`draw` (draws `max(1, pendingDraw)`; if `pendingDraw` was >0 the turn passes; else `drewThisTurn`
and the player may play that card or `pass`), `pass` (only after drawing), `callUno` (sets
`uno[uid]`, allowed when hand length is 2 and it is your turn, or 1 right after playing), `catch
{uid}` (anyone: if that player has 1 card and `uno[uid]` is false, they draw 2), `again` (host).
Legal play: matches `activeColor` or the top card's kind, or is wild; `wild4` is always allowed
(skip the challenge rule — document it). Effects: skip → next player skipped; reverse → flip
direction (with 2 players acts as skip); draw2/wild4 → `pendingDraw += 2/4`, next player must
`draw` (no stacking across kinds — keep it: stacking draw2 on draw2 allowed, wild4 on wild4
allowed, nothing else). Winning: hand empty → `results`, winner scores the sum of everyone else's
hands (number face value, action 20, wilds 50). After `results`, `again` deals a new round with
`seed + 1`, scores accumulate, first to 500 is announced but play can continue.

`onPlayersChanged`: seats follow the room only in `lobby`. A player who leaves mid-game keeps
their seat and is skipped (`absent: true`) — simplest safe behaviour; document it.

Tests: deck is 108 with the right counts; dealing from a seed is deterministic; a play must
match; wild sets colour; skip/reverse/draw2 effects; draw-then-play-or-pass; stacking draw2;
UNO call and catch; winner and scoring; reshuffle when the deck empties (force it with a small
deck in a test by playing many `draw`s — or export `reshuffle` and test it directly).

### AI (`src/games/uno/ai.ts`)
`chooseAction(state, uid): UnoAction`. If `pendingDraw > 0` → draw. Else playable cards: prefer
draw2/skip/reverse when the next player has ≤ 2 cards; prefer the colour you hold most of;
play number cards before wilds; keep wild4 for when nothing else fits. Wild colour = the colour
with the most cards in hand. Call UNO whenever hand will be 1. If nothing is playable → `draw`,
then if the drawn card is playable play it, else `pass`. Also `catch` any opponent at 1 card who
did not call (do this from the Solo driver, 30% of the time, so it is not relentless).

### UI
- `src/games/uno/Card.tsx` — an SVG card: rounded rect in the colour, white ellipse, the glyph
  (digit, or drawn symbols for skip ⊘-style circle-slash, reverse two arrows, draw2 "+2",
  wild4 "+4", wild a four-colour quadrant). Props `{ card, size, faceDown? }`. No emoji.
- `src/games/uno/Table.tsx` (shared): opponents around the top as chips (name, card count, a
  small fan of face-down cards, "UNO!" badge); centre: deck (tappable = draw) and discard top
  with the active colour ring; your hand along the bottom as a horizontally scrollable row of
  cards, playable ones raised; wild → a colour picker `Sheet`. Buttons: Pass (when
  `drewThisTurn`), UNO (when hand ≤ 2), Catch on an opponent chip when applicable. Results:
  ranking by score, host "Next round".
- `Room.tsx`, `Solo.tsx` (1-3 computers, driver every 700 ms), `Art.tsx` (a fan of four
  colourful cards), `Uno.css`. `wide` is not needed.

Register, docs (including the trusted-client note in README's roadmap section — rewrite "The
thing that blocks UNO and Mahjong" into "How hidden hands work"), `v0.16.0`, commit.

---

## 3. Mahjong — DONE (v0.17.0)

Shipped as planned, with dragon pongs added to the fan table. All five games are in.

### Original plan (Chinese, simplified Guangdong-style scoring)

Pick **one** variant and say so in the docs: 136 tiles (no flowers/seasons), 4 players, chow
only from the player on your left, pong/kong from anyone, standard hands = 4 sets + 1 pair,
plus seven pairs and thirteen orphans. Scoring: 1 fan base; +1 self-draw; +1 all pongs; +1
all one suit with honours (half flush), +3 pure one suit; +1 per kong; seven pairs 2 fan;
thirteen orphans 8 fan; dealer pays/receives double. Points = 2^fan × 1 base. Keep the table
in one `scoring.ts` with a test per line.

### Tiles (`src/games/mahjong/tiles.ts`)
`Tile = number` 0-135. `tileKind(t)` = `Math.floor(t / 4)` gives 34 kinds: 0-8 bamboo 1-9,
9-17 characters 1-9, 18-26 dots 1-9, 27-30 winds E S W N, 31-33 dragons red green white.
Helpers: `isSuit`, `suitOf`, `rankOf`, `isHonour`, `sortTiles`.

### Rules (`src/games/mahjong/rules.ts`)
State: `phase`, `seats[4]` (uid, name, score), `wall: Tile[]` (draw from the end; the last 14
are the dead wall — stop when 14 remain → draw/exhaustive draw), `hands: Record<uid, Tile[]>`
(PRIVATE), `melds: Record<uid, { kind: 'chow'|'pong'|'kong'; tiles: Tile[]; from?: uid }[]>`
(public), `discards: Record<uid, Tile[]>` (public, in order), `turn`, `dealer`, `lastDiscard:
{ tile, by } | null`, `claimWindow: { tile, by, claims: Record<uid, Claim> } | null`, `drawn:
Tile | null` (the tile just drawn, shown separately), `seed`, `winner`, `winTiles`, `fan`.

Turn loop: the player to move has 14 tiles (13 + drawn) → `discard {tile}` → opens a
`claimWindow` in which the other three may `claim {kind: 'win'|'kong'|'pong'|'chow', tiles?}` or
`pass`. Resolve when all three have answered (or the room owner/driver sends `resolveClaims`
after everyone passed — do it inside `claim`/`pass`: when the third answer lands, resolve).
Priority: win > kong = pong > chow (chow only for the next player). Winner of the claim takes
the tile into a meld and becomes the player to move (a pong/chow then discards; a kong draws a
replacement from the dead wall end first). No claims → next player `draw`s. A player holding 14
may `declareWin` (self-draw) or `declareKong` (concealed four, or adding to an own pong).
Dealer rotates on a non-dealer win; game ends after one round of dealers (4 hands) or on `again`.

`winningHand(tiles: Tile[], melds): boolean` — recursive: remove a pair, then greedily remove
pongs/chows from the sorted remainder; plus the seven-pairs and thirteen-orphans checks. Put it
in `hand.ts` with tests from known hands (and known near-misses).

`onPlayersChanged`: exactly 4 seats; in `lobby` seats follow the room; the game cannot start with
fewer than 4 in a room, so Solo always has 3 computers.

### AI (`src/games/mahjong/ai.ts`)
Discard heuristic (classic "efficiency"): score each tile by how many partners it has in hand
(same kind ×3, neighbours ×2, second neighbours ×1), honours with no pair ×0; discard the lowest,
tie-break by what has been discarded most (safer). Claims: win always; pong/kong when it
completes a set and the hand stays within one suit if already half-flush-ish; chow only when
it reduces "shanten" — approximate with: after the chow, the number of lone tiles decreases.
Keep it simple and *always legal*; tests check legality on random seeded games (play 50 seeded
games to completion with four AIs and assert no `GameRuleError` and a result every time — this
is the most valuable test for the whole rule set).

### UI
- `Tile.tsx`: an SVG tile with the suit drawn: bamboo as green sticks (1 bamboo = a bird-ish
  blob is fine), characters as the Chinese numeral + 萬 in red/black text (allowed: these are
  real characters, like xiangqi's), dots as circles, winds/dragons as characters 東南西北 /
  中發 and a blank-framed white. Props `{ tile, size, faceDown? }`.
- `Table.tsx` (shared, **set `wide` on the screens for this game** so desktop gets the room):
  the viewer's hand along the bottom (tappable to discard on your turn; the drawn tile set
  apart on the right); the three opponents' melds and face-down counts on the other edges;
  every player's discards in rows in the middle; a claim bar when `claimWindow` is open and the
  viewer may claim (buttons: Chow (with a picker if several), Pong, Kong, Win, Pass); a
  "declare" bar on your own turn when `winningHand` or a kong is available. Results: the
  winning hand shown face up, fan breakdown, scores.
- `Room.tsx`, `Solo.tsx` (always 3 computers; driver every 600 ms; the driver also answers
  claim windows for computers), `Art.tsx` (a few tiles fanned on green), `Mahjong.css`.

Register, docs, `v0.17.0`, commit.

---

## Checklist per game (print it, tick it)

- [ ] `rules.ts` pure; tests green; `id` cast removed when registering
- [ ] `ai.ts` with a legality test
- [ ] `Table.tsx` shared by `Room.tsx` and `Solo.tsx`; Solo uses `useLocalGame`
- [ ] `Art.tsx` inside the safe zone; rendered and looked at
- [ ] Board/table rendered and looked at in light and dark, phone width
- [ ] The four registration edits; React-free registry check
- [ ] `README.md` feature bullet, roadmap row removed, credits; `CLAUDE.md` tree + decisions
- [ ] version bump, `tsc`/`lint`/`test`/`build` clean, commit on `playtest`
