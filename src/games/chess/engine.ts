/**
 * Chess: the board, every rule of movement, and what counts as the end of a game.
 *
 * Pure and deterministic — no DOM, no clock, no randomness — so the room reducer can validate a
 * move inside a transaction with it, and the AI in `./ai` can search with it. Legality is decided
 * the plain way: make the move, see whether the mover's king is attacked, unmake. It is not the
 * fastest way, but it is the one that gets castling-through-check and en-passant pins right
 * without special cases, and the perft test in `engine.test.ts` proves it.
 *
 * Squares are 0-63 with a1 = 0, b1 = 1 … h8 = 63. Pieces are signed: positive white, negative
 * black, magnitude 1-6 for pawn, knight, bishop, rook, queen, king. A move is
 * `from | (to << 6) | (promotion << 12)`, promotion being the piece type or 0.
 */

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export type Color = 1 | -1;
export const WHITE: Color = 1;
export const BLACK: Color = -1;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const fileOf = (sq: number): number => sq & 7;
export const rankOf = (sq: number): number => sq >> 3;
export const square = (file: number, rank: number): number => rank * 8 + file;

export const moveFrom = (mv: number): number => mv & 63;
export const moveTo = (mv: number): number => (mv >> 6) & 63;
export const movePromotion = (mv: number): number => (mv >> 12) & 7;
export const makeMoveCode = (from: number, to: number, promotion = 0): number => from | (to << 6) | (promotion << 12);

/** Castling rights as bits. */
const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;

const KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const BISHOP_DIRS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

interface Undo {
  mv: number;
  captured: number;
  /** The square the captured piece stood on — differs from `to` for en passant. */
  capturedAt: number;
  castling: number;
  ep: number;
  halfmove: number;
}

export class Board {
  squares = new Int8Array(64);
  turn: Color = WHITE;
  castling = 0;
  /** The square a pawn may capture en passant on, or -1. */
  ep = -1;
  /** Plies since the last capture or pawn move. */
  halfmove = 0;
  fullmove = 1;
  private history: Undo[] = [];

  static fromFen(fen: string): Board {
    const b = new Board();
    b.loadFen(fen);
    return b;
  }

  loadFen(fen: string): void {
    const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
    this.squares.fill(0);
    let rank = 7;
    let file = 0;
    for (const c of placement) {
      if (c === '/') { rank -= 1; file = 0; continue; }
      if (c >= '1' && c <= '8') { file += c.charCodeAt(0) - 48; continue; }
      const type = 'pnbrqk'.indexOf(c.toLowerCase()) + 1;
      this.squares[square(file, rank)] = c === c.toUpperCase() ? type : -type;
      file += 1;
    }
    this.turn = turn === 'b' ? BLACK : WHITE;
    this.castling = (castling?.includes('K') ? WK : 0) | (castling?.includes('Q') ? WQ : 0)
      | (castling?.includes('k') ? BK : 0) | (castling?.includes('q') ? BQ : 0);
    this.ep = ep && ep !== '-' ? square(ep.charCodeAt(0) - 97, ep.charCodeAt(1) - 49) : -1;
    this.halfmove = Number(half ?? 0) || 0;
    this.fullmove = Number(full ?? 1) || 1;
    this.history = [];
  }

  toFen(): string {
    let out = '';
    for (let rank = 7; rank >= 0; rank -= 1) {
      let empty = 0;
      for (let file = 0; file < 8; file += 1) {
        const pc = this.squares[square(file, rank)];
        if (pc === 0) { empty += 1; continue; }
        if (empty) { out += empty; empty = 0; }
        const letter = ' pnbrqk'[Math.abs(pc)];
        out += pc > 0 ? letter.toUpperCase() : letter;
      }
      if (empty) out += empty;
      if (rank) out += '/';
    }
    const rights = [[WK, 'K'], [WQ, 'Q'], [BK, 'k'], [BQ, 'q']]
      .filter(([bit]) => this.castling & (bit as number)).map(([, c]) => c).join('') || '-';
    const ep = this.ep >= 0 ? `${'abcdefgh'[fileOf(this.ep)]}${rankOf(this.ep) + 1}` : '-';
    return `${out} ${this.turn === WHITE ? 'w' : 'b'} ${rights} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  /** A compact key for repetition: everything that makes two positions "the same". */
  key(): string {
    return `${Array.from(this.squares).join(',')}|${this.turn}|${this.castling}|${this.ep}`;
  }

  kingSquare(color: Color): number {
    for (let sq = 0; sq < 64; sq += 1) if (this.squares[sq] === KING * color) return sq;
    return -1;
  }

  /** Whether `by` attacks `sq`. */
  attacked(sq: number, by: Color): boolean {
    const f = fileOf(sq);
    const r = rankOf(sq);
    const s = this.squares;
    // Pawns attack diagonally forward: a white pawn on r-1 hits r.
    const pr = r - by;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && s[square(f - 1, pr)] === PAWN * by) return true;
      if (f < 7 && s[square(f + 1, pr)] === PAWN * by) return true;
    }
    for (const [df, dr] of KNIGHT_STEPS) {
      const nf = f + df;
      const nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && s[square(nf, nr)] === KNIGHT * by) return true;
    }
    for (const [df, dr] of KING_STEPS) {
      const nf = f + df;
      const nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && s[square(nf, nr)] === KING * by) return true;
    }
    for (const [df, dr] of BISHOP_DIRS) {
      let nf = f + df;
      let nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const pc = s[square(nf, nr)];
        if (pc !== 0) {
          if (pc === BISHOP * by || pc === QUEEN * by) return true;
          break;
        }
        nf += df;
        nr += dr;
      }
    }
    for (const [df, dr] of ROOK_DIRS) {
      let nf = f + df;
      let nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const pc = s[square(nf, nr)];
        if (pc !== 0) {
          if (pc === ROOK * by || pc === QUEEN * by) return true;
          break;
        }
        nf += df;
        nr += dr;
      }
    }
    return false;
  }

  inCheck(): boolean {
    const k = this.kingSquare(this.turn);
    return k >= 0 && this.attacked(k, -this.turn as Color);
  }

  /** Every move that obeys the piece's movement, before checking what it does to the king. */
  pseudoMoves(): number[] {
    const out: number[] = [];
    const s = this.squares;
    const us = this.turn;
    for (let from = 0; from < 64; from += 1) {
      const pc = s[from];
      if (pc === 0 || Math.sign(pc) !== us) continue;
      const f = fileOf(from);
      const r = rankOf(from);
      const type = Math.abs(pc);
      if (type === PAWN) {
        const dir = us;
        const startRank = us === WHITE ? 1 : 6;
        const lastRank = us === WHITE ? 7 : 0;
        const r1 = r + dir;
        if (r1 >= 0 && r1 < 8 && s[square(f, r1)] === 0) {
          const to = square(f, r1);
          if (r1 === lastRank) for (const p of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(makeMoveCode(from, to, p));
          else out.push(makeMoveCode(from, to));
          if (r === startRank && s[square(f, r + 2 * dir)] === 0) out.push(makeMoveCode(from, square(f, r + 2 * dir)));
        }
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (nf < 0 || nf > 7 || r1 < 0 || r1 > 7) continue;
          const to = square(nf, r1);
          const target = s[to];
          if ((target !== 0 && Math.sign(target) === -us) || to === this.ep) {
            if (r1 === lastRank) for (const p of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(makeMoveCode(from, to, p));
            else out.push(makeMoveCode(from, to));
          }
        }
      } else if (type === KNIGHT || type === KING) {
        for (const [df, dr] of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
          const nf = f + df;
          const nr = r + dr;
          if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
          const to = square(nf, nr);
          if (s[to] === 0 || Math.sign(s[to]) === -us) out.push(makeMoveCode(from, to));
        }
        if (type === KING) this.castlingMoves(from, out);
      } else {
        const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
        for (const [df, dr] of dirs) {
          let nf = f + df;
          let nr = r + dr;
          while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
            const to = square(nf, nr);
            const target = s[to];
            if (target === 0) out.push(makeMoveCode(from, to));
            else {
              if (Math.sign(target) === -us) out.push(makeMoveCode(from, to));
              break;
            }
            nf += df;
            nr += dr;
          }
        }
      }
    }
    return out;
  }

  /** Castling, with every condition checked here: rights, empty path, not in or through check. */
  private castlingMoves(from: number, out: number[]): void {
    const us = this.turn;
    const home = us === WHITE ? 0 : 7;
    if (from !== square(4, home)) return;
    const them = -us as Color;
    const kingSide = us === WHITE ? WK : BK;
    const queenSide = us === WHITE ? WQ : BQ;
    const s = this.squares;
    if (this.attacked(from, them)) return;
    if (this.castling & kingSide
      && s[square(5, home)] === 0 && s[square(6, home)] === 0
      && s[square(7, home)] === ROOK * us
      && !this.attacked(square(5, home), them) && !this.attacked(square(6, home), them)) {
      out.push(makeMoveCode(from, square(6, home)));
    }
    if (this.castling & queenSide
      && s[square(3, home)] === 0 && s[square(2, home)] === 0 && s[square(1, home)] === 0
      && s[square(0, home)] === ROOK * us
      && !this.attacked(square(3, home), them) && !this.attacked(square(2, home), them)) {
      out.push(makeMoveCode(from, square(2, home)));
    }
  }

  /** Plays a pseudo-legal move; returns false and leaves the board untouched if it exposes the king. */
  make(mv: number): boolean {
    const from = moveFrom(mv);
    const to = moveTo(mv);
    const promotion = movePromotion(mv);
    const s = this.squares;
    const pc = s[from];
    const us = this.turn;
    const type = Math.abs(pc);
    let capturedAt = to;
    if (type === PAWN && to === this.ep && s[to] === 0) capturedAt = square(fileOf(to), rankOf(from));
    const captured = s[capturedAt];
    const undo: Undo = { mv, captured, capturedAt, castling: this.castling, ep: this.ep, halfmove: this.halfmove };

    s[capturedAt] = 0;
    s[from] = 0;
    s[to] = promotion ? promotion * us : pc;
    // The rook comes along when the king moves two files.
    if (type === KING && Math.abs(fileOf(to) - fileOf(from)) === 2) {
      const home = rankOf(from);
      if (fileOf(to) === 6) { s[square(5, home)] = s[square(7, home)]; s[square(7, home)] = 0; }
      else { s[square(3, home)] = s[square(0, home)]; s[square(0, home)] = 0; }
    }
    // Rights are lost when a king or rook moves, or a rook is captured on its home square.
    if (type === KING) this.castling &= us === WHITE ? ~(WK | WQ) : ~(BK | BQ);
    for (const sq of [from, capturedAt]) {
      if (sq === square(7, 0)) this.castling &= ~WK;
      else if (sq === square(0, 0)) this.castling &= ~WQ;
      else if (sq === square(7, 7)) this.castling &= ~BK;
      else if (sq === square(0, 7)) this.castling &= ~BQ;
    }
    this.ep = type === PAWN && Math.abs(rankOf(to) - rankOf(from)) === 2 ? square(fileOf(from), (rankOf(from) + rankOf(to)) / 2) : -1;
    this.halfmove = type === PAWN || captured !== 0 ? 0 : this.halfmove + 1;
    this.history.push(undo);
    this.turn = -us as Color;
    if (us === BLACK) this.fullmove += 1;

    // Our own king must not be left attacked.
    const k = this.kingSquare(us);
    if (k >= 0 && this.attacked(k, -us as Color)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake(): void {
    const undo = this.history.pop();
    if (!undo) return;
    const { mv, captured, capturedAt } = undo;
    const from = moveFrom(mv);
    const to = moveTo(mv);
    const promotion = movePromotion(mv);
    this.turn = -this.turn as Color;
    const us = this.turn;
    if (us === BLACK) this.fullmove -= 1;
    const s = this.squares;
    const moved = s[to];
    s[from] = promotion ? PAWN * us : moved;
    s[to] = 0;
    s[capturedAt] = captured;
    if (Math.abs(moved) === KING && Math.abs(fileOf(to) - fileOf(from)) === 2) {
      const home = rankOf(from);
      if (fileOf(to) === 6) { s[square(7, home)] = s[square(5, home)]; s[square(5, home)] = 0; }
      else { s[square(0, home)] = s[square(3, home)]; s[square(3, home)] = 0; }
    }
    this.castling = undo.castling;
    this.ep = undo.ep;
    this.halfmove = undo.halfmove;
  }

  /** Every move that can actually be played from here. */
  legalMoves(): number[] {
    const out: number[] = [];
    for (const mv of this.pseudoMoves()) {
      if (this.make(mv)) {
        this.unmake();
        out.push(mv);
      }
    }
    return out;
  }

  /** Whether the move is legal here, by promotion too — a pawn reaching the last rank must say what it becomes. */
  isLegal(mv: number): boolean {
    return this.legalMoves().includes(mv);
  }

  /** The last capture, if the last move made was one. */
  lastCaptured(): number {
    return this.history.length ? this.history[this.history.length - 1].captured : 0;
  }

  /**
   * Whether neither side could ever mate: king v king, king+minor v king, or king+bishop v
   * king+bishop with both bishops on the same colour.
   */
  insufficientMaterial(): boolean {
    const minors: { color: Color; bishopShade: number | null }[] = [];
    for (let sq = 0; sq < 64; sq += 1) {
      const pc = this.squares[sq];
      const type = Math.abs(pc);
      if (type === 0 || type === KING) continue;
      if (type === PAWN || type === ROOK || type === QUEEN) return false;
      minors.push({ color: Math.sign(pc) as Color, bishopShade: type === BISHOP ? (fileOf(sq) + rankOf(sq)) & 1 : null });
      if (minors.length > 2) return false;
    }
    if (minors.length <= 1) return true;
    const [a, b] = minors;
    return a.color !== b.color && a.bishopShade !== null && a.bishopShade === b.bishopShade;
  }
}

/** Counts leaf nodes to `depth` — the standard way to prove a move generator. */
export function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const mv of board.pseudoMoves()) {
    if (!board.make(mv)) continue;
    nodes += depth === 1 ? 1 : perft(board, depth - 1);
    board.unmake();
  }
  return nodes;
}

/** Algebraic name of a square, for messages and tests. */
export const squareName = (sq: number): string => `${'abcdefgh'[fileOf(sq)]}${rankOf(sq) + 1}`;
