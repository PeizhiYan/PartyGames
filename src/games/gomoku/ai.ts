/**
 * The Gomoku computer opponent, ported from the original JS version in
 * PeizhiYan.github.io/js_codes/gomoku (game_logic.js + minimax.js).
 *
 * The original scored a position by running 2D convolutions over the board with hand-made filters.
 * Each filter was a contiguous run of N cells (weight 1 each) plus a "shoulder" cell just outside
 * either end, weighted 10 at the start and 1000 at the end. Those deliberately different weights
 * made every (left end, right end) combination land on a unique total, which is how the filters
 * told an open run from a half-open or dead one — e.g. for a three: 3 = open, -7 or -997 = one end
 * blocked, -1007 = both ends blocked.
 *
 * That is precisely "find each maximal run of one player's stones and look at what sits on both
 * ends", so this port scans lines directly instead of convolving. It keeps the original's weights
 * (see PATTERN_SCORE), its offense + defense + centre-bias move scoring, and its minimax search
 * with alpha-beta pruning at even depths — but it runs orders of magnitude faster, which is what
 * makes the "insight" heat map affordable to redraw after every move on a phone.
 */
import {
  CELLS, DIRECTIONS, SIZE, colOf, idx, inBounds, other, rowOf,
  type Board, type Player,
} from './board';

/** The original's pattern weights, by run length and how many open ends it has. */
const PATTERN_SCORE = {
  five: 99999,
  openFour: 5000,
  halfFour: 2000,
  openThree: 1000,
  halfThree: 150,
  openTwo: 10,
  halfTwo: 3,
} as const;

/** Only empty cells within this many cells of a stone are candidate moves during tree search. */
const SEARCH_RADIUS = 2;
/** Branching cap at every tree-search node. */
const CANDIDATES_PER_NODE = 10;
/** Comfortably dominates any non-terminal board score. */
const WIN_SCORE = 10_000_000;

export type Difficulty = 'easy' | 'normal' | 'hard';

/**
 * Search depth per difficulty, in plies. Always even: an even depth ends on the simulated
 * opponent's best reply, so every move the computer considers has been tested against "what would
 * they do about it" before it is trusted. Depth 0 is the original's single-ply heuristic.
 * (Depth 6 was tried in the original and dropped: 30s+ per move.)
 */
const DEPTH: Record<Difficulty, number> = { easy: 0, normal: 2, hard: 4 };

/**
 * Easy mode plays the Nth-best move instead of the best one, so it is beatable without being
 * random enough to look broken.
 */
const EASY_SLOPPINESS = 3;

/** Score the maximal run of `player`'s stones that starts at `at` going in direction (dr, dc). */
function runScore(board: Board, at: number, dr: number, dc: number, player: Player): number {
  const row = rowOf(at);
  const col = colOf(at);
  // Only score a run from its first stone, so each run is counted once per direction.
  const beforeR = row - dr;
  const beforeC = col - dc;
  if (inBounds(beforeR, beforeC) && board[idx(beforeR, beforeC)] === player) return 0;

  let length = 0;
  let r = row;
  let c = col;
  while (inBounds(r, c) && board[idx(r, c)] === player) {
    length++;
    r += dr;
    c += dc;
  }
  if (length >= 5) return PATTERN_SCORE.five;

  // An end is "open" only if the cell just past it is on the board and empty.
  const openStart = inBounds(beforeR, beforeC) && board[idx(beforeR, beforeC)] === 0;
  const openEnd = inBounds(r, c) && board[idx(r, c)] === 0;
  const openEnds = (openStart ? 1 : 0) + (openEnd ? 1 : 0);
  if (openEnds === 0) return 0; // dead run: it can never reach five

  switch (length) {
    case 4: return openEnds === 2 ? PATTERN_SCORE.openFour : PATTERN_SCORE.halfFour;
    case 3: return openEnds === 2 ? PATTERN_SCORE.openThree : PATTERN_SCORE.halfThree;
    case 2: return openEnds === 2 ? PATTERN_SCORE.openTwo : PATTERN_SCORE.halfTwo;
    default: return 0; // a lone stone is worth nothing on its own
  }
}

/** What the whole board is worth to `player` right now. The original's `boardValue()`. */
export function boardValue(board: Board, player: Player): number {
  let total = 0;
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== player) continue;
    // runScore only scores a run from its first stone, so each run is counted exactly once.
    for (const [dr, dc] of DIRECTIONS) total += runScore(board, i, dr, dc, player);
  }
  return total;
}

/**
 * What playing `cell` would be worth to `player`. Scores only the four lines through the cell:
 * everything else on the board is unchanged, so it is the same constant for every candidate and
 * cannot affect which one wins. (The original recomputed the whole board each time.)
 */
export function cellValue(board: Board, cell: number, player: Player): number {
  if (board[cell] !== 0) return -1;
  const row = rowOf(cell);
  const col = colOf(cell);
  board[cell] = player; // put the stone down, score, take it back: no board copy per candidate
  let score = 0;
  for (const [dr, dc] of DIRECTIONS) {
    // Walk back to the start of the line segment this cell sits in, then score the run from there.
    let r = row;
    let c = col;
    while (inBounds(r - dr, c - dc) && board[idx(r - dr, c - dc)] === player) { r -= dr; c -= dc; }
    score += runScore(board, idx(r, c), dr, dc, player);
  }
  board[cell] = 0;
  return score;
}

/**
 * A small pull toward the centre, as in the original. Without it, candidates that tie — and early
 * on almost all of them do — fall back to scan order, which drifts the computer's stones into the
 * top-left corner. Capped at ~2, well below the smallest real pattern score (3), so it only ever
 * breaks ties.
 */
function centerBias(cell: number): number {
  const dr = (SIZE - 1) / 2 - rowOf(cell);
  const dc = (SIZE - 1) / 2 - colOf(cell);
  const d2 = dr * dr + dc * dc;
  return d2 === 0 ? 2 : Math.min(2, 2 / d2);
}

/**
 * How good each empty cell looks for `player`, for the "insight" heat map: what the move wins them
 * (offense) plus what it denies the opponent (defense), the same sum the move chooser ranks by.
 * Occupied cells are 0.
 */
export function heatMap(board: Board, player: Player): number[] {
  const opponent = other(player);
  const out = new Array<number>(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== 0) continue;
    out[i] = cellValue(board, i, player) + cellValue(board, i, opponent) + centerBias(i);
  }
  return out;
}

function allEmptyCells(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (board[i] === 0) out.push(i);
  return out;
}

/**
 * Empty cells worth searching: those near a stone. Restricting the branching this way is what keeps
 * depth-4 search tractable. On an empty board there is nothing to anchor to, so offer the centre.
 */
function candidates(board: Board): number[] {
  const seen = new Set<number>();
  let anyStone = false;
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === 0) continue;
    anyStone = true;
    const row = rowOf(i);
    const col = colOf(i);
    for (let dr = -SEARCH_RADIUS; dr <= SEARCH_RADIUS; dr++) {
      for (let dc = -SEARCH_RADIUS; dc <= SEARCH_RADIUS; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(r, c) || board[idx(r, c)] !== 0) continue;
        seen.add(idx(r, c));
      }
    }
  }
  // Only an empty board falls back to the centre. A *full* board also has no candidates, and
  // offering the centre there would hand the search an occupied cell to play on.
  if (!anyStone) return [idx((SIZE - 1) / 2, (SIZE - 1) / 2)];
  return [...seen];
}

/**
 * Rank cells by the cheap one-move heuristic, best first. Scoring defense as well as offense
 * matters: a cell that must be blocked (the open end of the opponent's three) can look worthless
 * on offense alone and get pruned away before the search ever looks at it.
 */
function ranked(cells: number[], board: Board, player: Player): { cell: number; score: number }[] {
  const opponent = other(player);
  return cells
    .map((cell) => ({
      cell,
      score: cellValue(board, cell, player) + cellValue(board, cell, opponent) + centerBias(cell),
    }))
    .sort((a, b) => b.score - a.score);
}

function wins(board: Board, cell: number, player: Player): boolean {
  const row = rowOf(cell);
  const col = colOf(cell);
  for (const [dr, dc] of DIRECTIONS) {
    let run = 1;
    for (const sign of [1, -1]) {
      for (let step = 1; step < 5; step++) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (!inBounds(r, c) || board[idx(r, c)] !== player) break;
        run++;
      }
    }
    if (run >= 5) return true;
  }
  return false;
}

/**
 * Minimax with alpha-beta pruning. The board is mutated in place for each trial move and restored
 * straight after, so no node copies the board. `depthLeft` also breaks ties between equal outcomes
 * in favour of winning sooner and losing later.
 */
function search(
  board: Board, me: Player, depthLeft: number, alpha: number, beta: number, myTurn: boolean,
): { score: number; cell: number | null } {
  const mover = myTurn ? me : other(me);
  const options = ranked(candidates(board), board, mover).slice(0, CANDIDATES_PER_NODE);
  if (options.length === 0) return { score: 0, cell: null };

  let bestCell = options[0].cell;
  let bestScore = myTurn ? -Infinity : Infinity;

  for (const { cell } of options) {
    board[cell] = mover;
    let score: number;
    if (wins(board, cell, mover)) {
      score = myTurn ? WIN_SCORE + depthLeft : -WIN_SCORE - depthLeft;
    } else if (depthLeft <= 1) {
      score = boardValue(board, me) - boardValue(board, other(me));
    } else {
      score = search(board, me, depthLeft - 1, alpha, beta, !myTurn).score;
    }
    board[cell] = 0;

    if (myTurn) {
      if (score > bestScore) { bestScore = score; bestCell = cell; }
      if (bestScore > alpha) alpha = bestScore;
    } else {
      if (score < bestScore) { bestScore = score; bestCell = cell; }
      if (bestScore < beta) beta = bestScore;
    }
    if (alpha >= beta) break; // the opponent already has something better elsewhere
  }
  return { score: bestScore, cell: bestCell };
}

/**
 * The computer's move for `player`, or null if the board is full. The board is left exactly as it
 * was found.
 */
export function chooseMove(board: Board, player: Player, difficulty: Difficulty): number | null {
  const depth = DEPTH[difficulty];
  if (depth === 0) {
    const options = ranked(allEmptyCells(board), board, player);
    if (options.length === 0) return null;
    // Still take a win or a forced block outright; only middling moves get played sloppily.
    if (options[0].score >= PATTERN_SCORE.halfFour) return options[0].cell;
    const reach = Math.min(EASY_SLOPPINESS, options.length);
    return options[Math.floor(Math.random() * reach)].cell;
  }
  return search(board.slice(), player, depth, -Infinity, Infinity, true).cell;
}
