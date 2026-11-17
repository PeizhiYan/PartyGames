/**
 * The computer's chess: alpha-beta with piece-square evaluation, captures searched to quiet
 * (quiescence), most-valuable-victim move ordering, and iterative deepening against a time
 * budget. Not a strong engine, but a sound one — it never hangs a piece for nothing and it
 * sees short mates — and three strengths are three time budgets.
 *
 * Runs on the main thread like the others; the screen paints "thinking…" first.
 */
import {
  BISHOP, Board, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, fileOf, moveTo, rankOf, type Color,
} from './engine';

export type Difficulty = 'easy' | 'normal' | 'hard';

const LEVELS: Record<Difficulty, { depth: number; millis: number }> = {
  easy: { depth: 1, millis: 60 },
  normal: { depth: 4, millis: 700 },
  hard: { depth: 6, millis: 2500 },
};

const VALUE = [0, 100, 320, 330, 500, 900, 20000];
const MATE = 100000;

/* Piece-square tables from white's side, a8 first (the usual way they are written). */
const PST: Record<number, number[]> = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [KING]: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/** The table index for a square, seen from `color`'s side. Tables are written a8-first. */
const pstIndex = (sq: number, color: Color): number => {
  const rank = color === WHITE ? 7 - rankOf(sq) : rankOf(sq);
  return rank * 8 + fileOf(sq);
};

/** Material plus position, from the side to move's point of view. */
function evaluate(board: Board): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq += 1) {
    const pc = board.squares[sq];
    if (pc === 0) continue;
    const color = Math.sign(pc) as Color;
    const type = Math.abs(pc);
    score += color * (VALUE[type] + PST[type][pstIndex(sq, color)]);
  }
  return board.turn * score;
}

/** Captures first, biggest victim first, so alpha-beta cuts early. */
function ordered(board: Board, moves: number[]): number[] {
  const keyed = moves.map((mv) => {
    const victim = Math.abs(board.squares[moveTo(mv)]);
    return { mv, score: victim ? VALUE[victim] * 10 - VALUE[Math.abs(board.squares[mv & 63])] : 0 };
  });
  keyed.sort((a, b) => b.score - a.score);
  return keyed.map((k) => k.mv);
}

class Searcher {
  nodes = 0;
  private deadline: number;

  constructor(private board: Board, private random: () => number, budgetMs: number) {
    this.deadline = Date.now() + budgetMs;
  }

  outOfTime(): boolean {
    return (this.nodes & 1023) === 0 && Date.now() > this.deadline;
  }

  quiesce(alpha: number, beta: number): number {
    this.nodes += 1;
    const stand = evaluate(this.board);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    for (const mv of ordered(this.board, this.board.pseudoMoves())) {
      if (this.board.squares[moveTo(mv)] === 0) continue;
      if (!this.board.make(mv)) continue;
      const score = -this.quiesce(-beta, -alpha);
      this.board.unmake();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  search(depth: number, alpha: number, beta: number, ply: number): number {
    if (depth <= 0) return this.quiesce(alpha, beta);
    this.nodes += 1;
    let legal = 0;
    let best = -Infinity;
    for (const mv of ordered(this.board, this.board.pseudoMoves())) {
      if (!this.board.make(mv)) continue;
      legal += 1;
      const score = -this.search(depth - 1, -beta, -alpha, ply + 1);
      this.board.unmake();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
      if (this.outOfTime()) break;
    }
    if (legal === 0) return this.board.inCheck() ? -MATE + ply : 0;
    return best;
  }

  /** The root: every legal move scored, best first, with a pinch of randomness among equals. */
  root(depth: number): { mv: number; score: number } | null {
    let best: { mv: number; score: number } | null = null;
    let alpha = -Infinity;
    for (const mv of ordered(this.board, this.board.legalMoves())) {
      this.board.make(mv);
      let score = -this.search(depth - 1, -Infinity, -alpha, 1);
      this.board.unmake();
      // Tiny jitter so the same opening is not played every game.
      if (Math.abs(score) < MATE / 2) score += this.random() * 6 - 3;
      if (!best || score > best.score) {
        best = { mv, score };
        alpha = score;
      }
      if (this.outOfTime()) break;
    }
    return best;
  }
}

/** The computer's move from this position, or 0 if it has none. */
export function chooseMove(board: Board, difficulty: Difficulty, random: () => number = Math.random): number {
  const level = LEVELS[difficulty];
  const searcher = new Searcher(board, random, level.millis);
  let best: { mv: number; score: number } | null = null;
  const started = Date.now();
  for (let depth = 1; depth <= level.depth; depth += 1) {
    const found = searcher.root(depth);
    if (!found) break;
    // A result from an iteration that ran out of time is partial; keep the last full one.
    if (best && Date.now() - started > level.millis) break;
    best = found;
    if (Math.abs(found.score) > MATE / 2) break;
  }
  return best?.mv ?? 0;
}
