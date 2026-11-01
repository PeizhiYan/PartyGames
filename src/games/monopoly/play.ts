/**
 * Board mode: moving round the ring and everything that happens when you land.
 *
 * Every function here is pure — state in, state out — so the whole game can be replayed and
 * tested without a browser, and so the backend can run it inside a transaction.
 *
 * What is deliberately **not** here: auctions, trading and mortgages. Each needs a negotiation
 * flow of its own, and a game between friends works without them. An unwanted property is simply
 * declined and stays with the bank.
 */
import { isOwnable } from './boards';
import {
  activeSeats, boardFor, deedsOf, groupSpaces, hasMonopoly, rentFor, seatOf,
  type DraftEntry, type Entry, type MonopolyState, type Seat,
} from './state';

/** Ids come from the clock and the actor, so nothing here needs randomness. */
const makeId = (now: number, uid: string, tag: string) => `${tag}-${now.toString(36)}-${uid.slice(0, 6)}`;

const MAX_LOG = 300;
const append = (log: Entry[], entry: Entry): Entry[] => {
  const next = [...log, entry];
  return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
};

const record = (state: MonopolyState, uid: string, balance: number, now: number) => ({
  ...state.history,
  [uid]: [...(state.history[uid] ?? []), { t: now, b: balance }],
});

const withSeat = (state: MonopolyState, uid: string, patch: Partial<Seat>): Seat[] =>
  state.seats.map((s) => (s.uid === uid ? { ...s, ...patch } : s));

/* ── Money, and running out of it ─────────────────────────────────────────── */

/**
 * Moves money, and handles the player not having it.
 *
 * A player who cannot pay is bankrupt: their cash goes to whoever they owed, their deeds go back
 * to the bank, and they are out. (A real game would auction the deeds; see the note at the top.)
 */
export function payOrBust(
  state: MonopolyState,
  from: string,
  to: string | null,
  amount: number,
  entry: DraftEntry | null,
  now: number,
): MonopolyState {
  const payer = seatOf(state, from);
  if (!payer || amount <= 0) return state;
  const affordable = Math.min(amount, payer.balance);
  const busted = payer.balance < amount;

  const seats = withSeat(state, from, { balance: payer.balance - affordable });
  let next: MonopolyState = { ...state, seats };
  next = { ...next, history: record(next, from, payer.balance - affordable, now) };

  if (to) {
    const payee = seatOf(next, to);
    if (payee) {
      next = { ...next, seats: withSeat(next, to, { balance: payee.balance + affordable }) };
      next = { ...next, history: record(next, to, payee.balance + affordable, now) };
    }
  }
  if (entry) {
    next = { ...next, log: append(next.log, { ...entry, id: makeId(now, from, 'tx'), at: now } as Entry) };
  }
  return busted ? goBankrupt(next, from) : next;
}

/** Out of the game: deeds back to the bank, nothing left to pay with. */
function goBankrupt(state: MonopolyState, uid: string): MonopolyState {
  const owned = { ...state.owned };
  const houses = { ...state.houses };
  for (const index of deedsOf(state, uid)) {
    delete owned[index];
    delete houses[index];
  }
  return { ...state, owned, houses, seats: withSeat(state, uid, { balance: 0, bankrupt: true }) };
}

/** The game is over once only one player is still solvent. */
export function settleIfOver(state: MonopolyState): MonopolyState {
  if (state.phase !== 'playing' || activeSeats(state).length > 1) return state;
  return { ...state, phase: 'results', pending: null, turn: null };
}

/* ── Cards ────────────────────────────────────────────────────────────────── */

/**
 * One deck for both Chance and Community Chest, and one set of cards for every board.
 *
 * Amounts are fractions of that board's salary rather than fixed numbers, so the same card is
 * worth the same in Vancouver dollars and in hundreds of yen.
 */
type CardEffect =
  | { kind: 'collect'; of: number }
  | { kind: 'pay'; of: number }
  | { kind: 'goTo'; target: 'go' | 'jail' }
  | { kind: 'move'; by: number }
  | { kind: 'repairs'; of: number };

const DECK: { text: string; effect: CardEffect }[] = [
  { text: 'Bank error in your favour. Collect half a salary.', effect: { kind: 'collect', of: 0.5 } },
  { text: 'Doctor’s fee. Pay a quarter salary.', effect: { kind: 'pay', of: 0.25 } },
  { text: 'Advance to Go.', effect: { kind: 'goTo', target: 'go' } },
  { text: 'Go directly to jail.', effect: { kind: 'goTo', target: 'jail' } },
  { text: 'Take a walk — move forward three spaces.', effect: { kind: 'move', by: 3 } },
  { text: 'You left something behind. Go back two spaces.', effect: { kind: 'move', by: -2 } },
  { text: 'It is your birthday. Collect a quarter salary.', effect: { kind: 'collect', of: 0.25 } },
  { text: 'School fees. Pay half a salary.', effect: { kind: 'pay', of: 0.5 } },
  { text: 'Street repairs. Pay a tenth of a salary for every house you own.', effect: { kind: 'repairs', of: 0.1 } },
  { text: 'You won a crossword competition. Collect a tenth of a salary.', effect: { kind: 'collect', of: 0.1 } },
  { text: 'Hospital fees. Pay a tenth of a salary.', effect: { kind: 'pay', of: 0.1 } },
  { text: 'Dividend from your holdings. Collect half a salary.', effect: { kind: 'collect', of: 0.5 } },
];

/**
 * Which card comes next. Mixed from the seed set when the game started and the number of draws so
 * far — so the order is different every game but still a pure function of the state, which is
 * what lets the reducer stay testable and run inside a transaction.
 */
function pickCard(state: MonopolyState): (typeof DECK)[number] {
  const mixed = Math.imul(state.seed ^ (state.draws + 1), 2654435761) >>> 0;
  return DECK[mixed % DECK.length];
}

function drawCard(state: MonopolyState, uid: string, now: number): MonopolyState {
  const board = boardFor(state);
  const card = pickCard(state);
  const amount = (of: number) => Math.max(1, Math.round(board.salary * of));
  let next: MonopolyState = { ...state, draws: state.draws + 1, card: { text: card.text, at: now } };

  switch (card.effect.kind) {
    case 'collect': {
      const seat = seatOf(next, uid)!;
      const balance = seat.balance + amount(card.effect.of);
      next = { ...next, seats: withSeat(next, uid, { balance }) };
      next = { ...next, history: record(next, uid, balance, now) };
      return { ...next, log: append(next.log, { id: makeId(now, uid, 'tx'), at: now, kind: 'fromBank', to: uid, amount: amount(card.effect.of), note: 'Card' }) };
    }
    case 'pay':
      return payOrBust(next, uid, null, amount(card.effect.of),
        { kind: 'payBank', from: uid, amount: amount(card.effect.of), note: 'Card' }, now);
    case 'repairs': {
      const houses = deedsOf(next, uid).reduce((n, i) => n + (next.houses[i] ?? 0), 0);
      const due = houses * amount(card.effect.of);
      return due > 0
        ? payOrBust(next, uid, null, due, { kind: 'payBank', from: uid, amount: due, note: 'Repairs' }, now)
        : next;
    }
    case 'goTo':
      return card.effect.target === 'jail'
        ? sendToJail(next, uid)
        : land(moveTo(next, uid, 0, true, now), uid, 0, now);
    case 'move': {
      const seat = seatOf(next, uid)!;
      const to = (seat.position + card.effect.by + board.spaces.length) % board.spaces.length;
      // Going back past Go does not pay a salary, so only a forward wrap counts.
      return land(moveTo(next, uid, to, card.effect.by > 0, now), uid, 0, now);
    }
  }
}

/* ── Moving ───────────────────────────────────────────────────────────────── */

export function sendToJail(state: MonopolyState, uid: string): MonopolyState {
  const board = boardFor(state);
  const jail = board.spaces.findIndex((s) => s.kind === 'jail');
  return {
    ...state,
    seats: withSeat(state, uid, { position: jail < 0 ? 0 : jail, jailTurns: 3 }),
    doubles: 0,
    pending: null,
  };
}

/** Puts the token on a space, paying a salary if the move passed the start. */
function moveTo(state: MonopolyState, uid: string, to: number, mayPassGo: boolean, now: number): MonopolyState {
  const board = boardFor(state);
  const seat = seatOf(state, uid);
  if (!seat) return state;
  const passed = mayPassGo && to <= seat.position && to !== seat.position;
  let next: MonopolyState = { ...state, seats: withSeat(state, uid, { position: to }) };
  if (!passed) return next;
  const balance = seat.balance + board.salary;
  next = { ...next, seats: withSeat(next, uid, { position: to, balance }) };
  next = { ...next, history: record(next, uid, balance, now) };
  return { ...next, log: append(next.log, { id: makeId(now, uid, 'tx'), at: now, kind: 'fromBank', to: uid, amount: board.salary, note: 'Passing Go' }) };
}

/** Whatever the space does to whoever just arrived on it. */
function land(state: MonopolyState, uid: string, diceTotal: number, now: number): MonopolyState {
  const board = boardFor(state);
  const seat = seatOf(state, uid);
  if (!seat) return state;
  const index = seat.position;
  const space = board.spaces[index];
  if (!space) return state;

  if (space.kind === 'gotojail') return sendToJail(state, uid);
  if (space.kind === 'tax') {
    return payOrBust(state, uid, null, space.amount,
      { kind: 'payBank', from: uid, amount: space.amount, note: space.name }, now);
  }
  if (space.kind === 'chance' || space.kind === 'chest') return drawCard(state, uid, now);
  if (!isOwnable(space)) return state;

  const owner = state.owned[index];
  if (!owner) {
    // Nobody owns it: offer it, but only if they could actually pay.
    return seat.balance >= space.price
      ? { ...state, pending: { kind: 'buy', space: index, price: space.price } }
      : state;
  }
  if (owner === uid) return state;
  const rent = rentFor(state, index, diceTotal);
  if (rent <= 0) return state;
  return payOrBust(state, uid, owner, rent,
    { kind: 'rent', from: uid, to: owner, amount: rent, note: space.name, space: index }, now);
}

/**
 * A turn: roll, move, and resolve. Jail is handled first — doubles get you out, otherwise you can
 * sit it out, and the third failed attempt costs the fine.
 */
export function rollAndMove(state: MonopolyState, uid: string, dice: [number, number], now: number): MonopolyState {
  const board = boardFor(state);
  const seat = seatOf(state, uid);
  if (!seat) return state;
  const total = dice[0] + dice[1];
  const isDouble = dice[0] === dice[1];
  const rolled: MonopolyState = { ...state, lastRoll: { uid, dice, total, at: now }, card: null };

  if (seat.jailTurns > 0) {
    if (isDouble) {
      const freed: MonopolyState = { ...rolled, seats: withSeat(rolled, uid, { jailTurns: 0 }), doubles: 0 };
      return land(moveTo(freed, uid, (seat.position + total) % board.spaces.length, true, now), uid, total, now);
    }
    const left = seat.jailTurns - 1;
    if (left > 0) return { ...rolled, seats: withSeat(rolled, uid, { jailTurns: left }) };
    // Out of attempts: pay the fine and leave next turn.
    return payOrBust({ ...rolled, seats: withSeat(rolled, uid, { jailTurns: 0 }) }, uid, null, board.jailFine,
      { kind: 'payBank', from: uid, amount: board.jailFine, note: 'Bail' }, now);
  }

  // Three doubles in a row is suspicious enough to be arrested for.
  const doubles = isDouble ? state.doubles + 1 : 0;
  if (doubles >= 3) return sendToJail({ ...rolled, doubles: 0 }, uid);

  const moved = moveTo({ ...rolled, doubles }, uid, (seat.position + total) % board.spaces.length, true, now);
  return land(moved, uid, total, now);
}

/** Buying the space you are standing on, after being offered it. */
export function buyPending(state: MonopolyState, uid: string, now: number): MonopolyState {
  const pending = state.pending;
  if (!pending) return state;
  const board = boardFor(state);
  const space = board.spaces[pending.space];
  const seat = seatOf(state, uid);
  if (!seat || !space || !isOwnable(space)) return { ...state, pending: null };

  const balance = seat.balance - pending.price;
  let next: MonopolyState = {
    ...state,
    pending: null,
    owned: { ...state.owned, [pending.space]: uid },
    seats: withSeat(state, uid, { balance }),
  };
  next = { ...next, history: record(next, uid, balance, now) };
  return {
    ...next,
    log: append(next.log, {
      id: makeId(now, uid, 'tx'), at: now, kind: 'buy',
      from: uid, amount: pending.price, note: space.name, space: pending.space,
    }),
  };
}

/* ── Building ─────────────────────────────────────────────────────────────── */

/**
 * Whether a house may go on this space right now: the whole group has to be held by one player,
 * and houses go on evenly — you cannot put a second on one property while another in the set
 * still has none.
 */
export function canBuild(state: MonopolyState, uid: string, index: number): boolean {
  const board = boardFor(state);
  const space = board.spaces[index];
  if (space?.kind !== 'property') return false;
  if (state.owned[index] !== uid || !hasMonopoly(state, uid, space.group)) return false;
  const here = state.houses[index] ?? 0;
  if (here >= 5) return false;
  const lowest = Math.min(...groupSpaces(board, space.group).map((i) => state.houses[i] ?? 0));
  if (here > lowest) return false;
  const seat = seatOf(state, uid);
  return !!seat && seat.balance >= (board.groups[space.group]?.houseCost ?? Infinity);
}

export function build(state: MonopolyState, uid: string, index: number, now: number): MonopolyState {
  const board = boardFor(state);
  const space = board.spaces[index];
  if (space?.kind !== 'property' || !canBuild(state, uid, index)) return state;
  const cost = board.groups[space.group].houseCost;
  const seat = seatOf(state, uid)!;
  const balance = seat.balance - cost;
  let next: MonopolyState = {
    ...state,
    houses: { ...state.houses, [index]: (state.houses[index] ?? 0) + 1 },
    seats: withSeat(state, uid, { balance }),
  };
  next = { ...next, history: record(next, uid, balance, now) };
  return {
    ...next,
    log: append(next.log, {
      id: makeId(now, uid, 'tx'), at: now, kind: 'build',
      from: uid, amount: cost, note: space.name, space: index,
    }),
  };
}

/* ── Whose turn ───────────────────────────────────────────────────────────── */

/** Rolling a double buys another go — unless it landed you in jail. */
export const rollsAgain = (state: MonopolyState, uid: string): boolean => {
  const seat = seatOf(state, uid);
  return state.doubles > 0 && !!seat && seat.jailTurns === 0;
};

export function endTurn(state: MonopolyState): MonopolyState {
  const playing = state.order.filter((uid) => !seatOf(state, uid)?.bankrupt);
  if (playing.length === 0) return state;
  const at = state.turn ? playing.indexOf(state.turn) : -1;
  const next = playing[(at + 1) % playing.length];
  return { ...state, turn: next, doubles: 0, rolled: false, pending: null, card: null };
}
