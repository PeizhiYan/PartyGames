/**
 * The Xiangqi engine: board representation, move generation, legality, evaluation and search.
 *
 * A straight port of the XiangQi Wizard Light engine that `../PeizhiYan.github.io/js_codes/
 * chinese_chess` runs (`position.js` + `search.js`), kept as close to the original as TypeScript
 * allows so its behaviour — and its known strength — carry over. The opening book (`book.js`,
 * 300KB of positions) is deliberately left behind: it would triple the app's bundle for a few
 * more varied first moves.
 *
 * Nothing here touches the DOM or the clock except `Search.searchMain`, which is given a time
 * budget — that function is the AI and is only ever called from `ai.ts`. The `Position` class
 * is what the room reducer uses to validate moves, and it is deterministic.
 *
 * Board layout: a 16x16 grid of 256 squares, of which the 9x10 board occupies files 3-11 and
 * ranks 3-12. A square is `file + rank * 16`. Red (side 0) sits at the bottom (ranks 10-12) and
 * moves first; black (side 1) at the top. A move is `src + (dst << 8)`.
 */

export const MATE_VALUE = 10000;
export const BAN_VALUE = MATE_VALUE - 100;
export const WIN_VALUE = MATE_VALUE - 200;
const NULL_SAFE_MARGIN = 400;
const NULL_OKAY_MARGIN = 200;
const DRAW_VALUE = 20;
const ADVANCED_VALUE = 3;

export const PIECE_KING = 0;
export const PIECE_ADVISOR = 1;
export const PIECE_BISHOP = 2;
export const PIECE_KNIGHT = 3;
export const PIECE_ROOK = 4;
export const PIECE_CANNON = 5;
export const PIECE_PAWN = 6;

export const RANK_TOP = 3;
export const RANK_BOTTOM = 12;
export const FILE_LEFT = 3;
export const FILE_RIGHT = 11;

export const STARTUP_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

/* ── Square geometry ──────────────────────────────────────────────────────── */

export const RANK_Y = (sq: number): number => sq >> 4;
export const FILE_X = (sq: number): number => sq & 15;
export const COORD_XY = (x: number, y: number): number => x + (y << 4);
export const SQUARE_FLIP = (sq: number): number => 254 - sq;
const SQUARE_FORWARD = (sq: number, sd: number): number => sq - 16 + (sd << 5);
const HOME_HALF = (sq: number, sd: number): boolean => (sq & 0x80) !== (sd << 7);
const AWAY_HALF = (sq: number, sd: number): boolean => (sq & 0x80) === (sd << 7);
const SAME_HALF = (a: number, b: number): boolean => ((a ^ b) & 0x80) === 0;
const SAME_RANK = (a: number, b: number): boolean => ((a ^ b) & 0xf0) === 0;
const SAME_FILE = (a: number, b: number): boolean => ((a ^ b) & 0x0f) === 0;
export const SIDE_TAG = (sd: number): number => 8 + (sd << 3);
export const OPP_SIDE_TAG = (sd: number): number => 16 - (sd << 3);

export const SRC = (mv: number): number => mv & 255;
export const DST = (mv: number): number => mv >> 8;
export const MOVE = (src: number, dst: number): number => src + (dst << 8);

const IN_BOARD_ = new Uint8Array(256);
const IN_FORT_ = new Uint8Array(256);
for (let y = RANK_TOP; y <= RANK_BOTTOM; y += 1) {
  for (let x = FILE_LEFT; x <= FILE_RIGHT; x += 1) {
    IN_BOARD_[COORD_XY(x, y)] = 1;
    if (x >= 6 && x <= 8 && (y <= 5 || y >= 10)) IN_FORT_[COORD_XY(x, y)] = 1;
  }
}
export const IN_BOARD = (sq: number): boolean => IN_BOARD_[sq] !== 0;
export const IN_FORT = (sq: number): boolean => IN_FORT_[sq] !== 0;

const KING_DELTA = [-16, -1, 1, 16];
const ADVISOR_DELTA = [-17, -15, 15, 17];
const KNIGHT_DELTA = [[-33, -31], [-18, 14], [-14, 18], [31, 33]];
const KNIGHT_CHECK_DELTA = [[-33, -18], [-31, -14], [14, 31], [18, 33]];
const MVV_VALUE = [50, 10, 10, 30, 40, 30, 20, 0];

/** Which single step a king (1), advisor (2) or bishop (3) may take, indexed by `dst - src + 256`. */
const LEGAL_SPAN = new Uint8Array(512);
for (const d of KING_DELTA) LEGAL_SPAN[256 + d] = 1;
for (const d of ADVISOR_DELTA) LEGAL_SPAN[256 + d] = 2;
for (const d of [-34, -30, 30, 34]) LEGAL_SPAN[256 + d] = 3;
/** The square a knight's leg has to be empty at, as an offset from its source. */
const KNIGHT_PIN_ = new Int8Array(512);
for (const [d, pin] of [[-33, -16], [-31, -16], [-18, -1], [-14, 1], [14, -1], [18, 1], [31, 16], [33, 16]]) {
  KNIGHT_PIN_[256 + d] = pin;
}

const KING_SPAN = (a: number, b: number): boolean => LEGAL_SPAN[b - a + 256] === 1;
const ADVISOR_SPAN = (a: number, b: number): boolean => LEGAL_SPAN[b - a + 256] === 2;
const BISHOP_SPAN = (a: number, b: number): boolean => LEGAL_SPAN[b - a + 256] === 3;
const BISHOP_PIN = (a: number, b: number): number => (a + b) >> 1;
const KNIGHT_PIN = (a: number, b: number): number => a + KNIGHT_PIN_[b - a + 256];
const MVV_LVA = (pc: number, lva: number): number => MVV_VALUE[pc & 7] - lva;

/* ── Piece-square tables ──────────────────────────────────────────────────── */

/**
 * Position values, as the original tabulates them: ten ranks of nine files, from red's point of
 * view with black's back rank first. Expanded into the 256-square layout below. King and pawn
 * share a table, as do advisor and bishop.
 */
const KING_PAWN = [
  9, 9, 9, 11, 13, 11, 9, 9, 9,
  19, 24, 34, 42, 44, 42, 34, 24, 19,
  19, 24, 32, 37, 37, 37, 32, 24, 19,
  19, 23, 27, 29, 30, 29, 27, 23, 19,
  14, 18, 20, 27, 29, 27, 20, 18, 14,
  7, 0, 13, 0, 16, 0, 13, 0, 7,
  7, 0, 7, 0, 15, 0, 7, 0, 7,
  0, 0, 0, 1, 1, 1, 0, 0, 0,
  0, 0, 0, 2, 2, 2, 0, 0, 0,
  0, 0, 0, 11, 15, 11, 0, 0, 0,
];
const ADVISOR_BISHOP = [
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 20, 0, 0, 0, 20, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  18, 0, 0, 20, 23, 20, 0, 0, 18,
  0, 0, 0, 0, 23, 0, 0, 0, 0,
  0, 0, 20, 20, 0, 20, 20, 0, 0,
];
const KNIGHT = [
  90, 90, 90, 96, 90, 96, 90, 90, 90,
  90, 96, 103, 97, 94, 97, 103, 96, 90,
  92, 98, 99, 103, 99, 103, 99, 98, 92,
  93, 108, 100, 107, 100, 107, 100, 108, 93,
  90, 100, 99, 103, 104, 103, 99, 100, 90,
  90, 98, 101, 102, 103, 102, 101, 98, 90,
  92, 94, 98, 95, 98, 95, 98, 94, 92,
  93, 92, 94, 95, 92, 95, 94, 92, 93,
  85, 90, 92, 93, 78, 93, 92, 90, 85,
  88, 85, 90, 88, 90, 88, 90, 85, 88,
];
const ROOK = [
  206, 208, 207, 213, 214, 213, 207, 208, 206,
  206, 212, 209, 216, 233, 216, 209, 212, 206,
  206, 208, 207, 214, 216, 214, 207, 208, 206,
  206, 213, 213, 216, 216, 216, 213, 213, 206,
  208, 211, 211, 214, 215, 214, 211, 211, 208,
  208, 212, 212, 214, 215, 214, 212, 212, 208,
  204, 209, 204, 212, 214, 212, 204, 209, 204,
  198, 208, 204, 212, 212, 212, 204, 208, 198,
  200, 208, 206, 212, 200, 212, 206, 208, 200,
  194, 206, 204, 212, 200, 212, 204, 206, 194,
];
const CANNON = [
  100, 100, 96, 91, 90, 91, 96, 100, 100,
  98, 98, 96, 92, 89, 92, 96, 98, 98,
  97, 97, 96, 91, 92, 91, 96, 97, 97,
  96, 99, 99, 98, 100, 98, 99, 99, 96,
  96, 96, 96, 96, 100, 96, 96, 96, 96,
  95, 96, 99, 96, 100, 96, 99, 96, 95,
  96, 96, 96, 96, 96, 96, 96, 96, 96,
  97, 96, 100, 99, 101, 99, 100, 96, 97,
  96, 97, 98, 98, 98, 98, 98, 97, 96,
  96, 96, 97, 99, 99, 99, 97, 96, 96,
];

const expand = (table: number[]): Int16Array => {
  const out = new Int16Array(256);
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) out[COORD_XY(x + FILE_LEFT, y + RANK_TOP)] = table[y * 9 + x];
  }
  return out;
};
const PIECE_VALUE = [KING_PAWN, ADVISOR_BISHOP, ADVISOR_BISHOP, KNIGHT, ROOK, CANNON, KING_PAWN].map(expand);

/* ── Zobrist keys, from the same RC4 stream as the original ───────────────── */

class RC4 {
  private x = 0;
  private y = 0;
  private state: number[] = [];

  constructor(key: number[]) {
    for (let i = 0; i < 256; i += 1) this.state.push(i);
    let j = 0;
    for (let i = 0; i < 256; i += 1) {
      j = (j + this.state[i] + key[i % key.length]) & 0xff;
      this.swap(i, j);
    }
  }

  private swap(i: number, j: number): void {
    const t = this.state[i];
    this.state[i] = this.state[j];
    this.state[j] = t;
  }

  nextByte(): number {
    this.x = (this.x + 1) & 0xff;
    this.y = (this.y + this.state[this.x]) & 0xff;
    this.swap(this.x, this.y);
    return this.state[(this.state[this.x] + this.state[this.y]) & 0xff];
  }

  nextLong(): number {
    const n0 = this.nextByte();
    const n1 = this.nextByte();
    const n2 = this.nextByte();
    const n3 = this.nextByte();
    return n0 + (n1 << 8) + (n2 << 16) + ((n3 << 24) & 0xffffffff);
  }
}

const rc4 = new RC4([0]);
const ZOBRIST_KEY_PLAYER = rc4.nextLong();
rc4.nextLong();
const ZOBRIST_LOCK_PLAYER = rc4.nextLong();
const ZOBRIST_KEY_TABLE: number[][] = [];
const ZOBRIST_LOCK_TABLE: number[][] = [];
for (let i = 0; i < 14; i += 1) {
  const keys: number[] = [];
  const locks: number[] = [];
  for (let j = 0; j < 256; j += 1) {
    keys.push(rc4.nextLong());
    rc4.nextLong();
    locks.push(rc4.nextLong());
  }
  ZOBRIST_KEY_TABLE.push(keys);
  ZOBRIST_LOCK_TABLE.push(locks);
}

/* ── FEN ──────────────────────────────────────────────────────────────────── */

const FEN_PIECE = '        KABNRCP kabnrcp ';

function charToPiece(c: string): number {
  switch (c) {
    case 'K': return PIECE_KING;
    case 'A': return PIECE_ADVISOR;
    case 'B': case 'E': return PIECE_BISHOP;
    case 'H': case 'N': return PIECE_KNIGHT;
    case 'R': return PIECE_ROOK;
    case 'C': return PIECE_CANNON;
    case 'P': return PIECE_PAWN;
    default: return -1;
  }
}

/* ── The position ─────────────────────────────────────────────────────────── */

export class Position {
  sdPlayer = 0;
  squares = new Uint8Array(256);
  zobristKey = 0;
  zobristLock = 0;
  vlWhite = 0;
  vlBlack = 0;
  distance = 0;
  mvList: number[] = [0];
  pcList: number[] = [0];
  keyList: number[] = [0];
  chkList: boolean[] = [false];

  static fromFen(fen: string): Position {
    const pos = new Position();
    pos.fromFen(fen);
    return pos;
  }

  clearBoard(): void {
    this.sdPlayer = 0;
    this.squares = new Uint8Array(256);
    this.zobristKey = this.zobristLock = 0;
    this.vlWhite = this.vlBlack = 0;
  }

  setIrrev(): void {
    this.mvList = [0];
    this.pcList = [0];
    this.keyList = [0];
    this.chkList = [this.checked()];
    this.distance = 0;
  }

  addPiece(sq: number, pc: number, del = false): void {
    this.squares[sq] = del ? 0 : pc;
    let pcAdjust: number;
    if (pc < 16) {
      pcAdjust = pc - 8;
      this.vlWhite += del ? -PIECE_VALUE[pcAdjust][sq] : PIECE_VALUE[pcAdjust][sq];
    } else {
      pcAdjust = pc - 16;
      this.vlBlack += del ? -PIECE_VALUE[pcAdjust][SQUARE_FLIP(sq)] : PIECE_VALUE[pcAdjust][SQUARE_FLIP(sq)];
      pcAdjust += 7;
    }
    this.zobristKey ^= ZOBRIST_KEY_TABLE[pcAdjust][sq];
    this.zobristLock ^= ZOBRIST_LOCK_TABLE[pcAdjust][sq];
  }

  private movePiece(mv: number): void {
    const sqSrc = SRC(mv);
    const sqDst = DST(mv);
    let pc = this.squares[sqDst];
    this.pcList.push(pc);
    if (pc > 0) this.addPiece(sqDst, pc, true);
    pc = this.squares[sqSrc];
    this.addPiece(sqSrc, pc, true);
    this.addPiece(sqDst, pc, false);
    this.mvList.push(mv);
  }

  private undoMovePiece(): void {
    const mv = this.mvList.pop()!;
    const sqSrc = SRC(mv);
    const sqDst = DST(mv);
    let pc = this.squares[sqDst];
    this.addPiece(sqDst, pc, true);
    this.addPiece(sqSrc, pc, false);
    pc = this.pcList.pop()!;
    if (pc > 0) this.addPiece(sqDst, pc, false);
  }

  changeSide(): void {
    this.sdPlayer = 1 - this.sdPlayer;
    this.zobristKey ^= ZOBRIST_KEY_PLAYER;
    this.zobristLock ^= ZOBRIST_LOCK_PLAYER;
  }

  /** Plays a pseudo-legal move. Returns false — and leaves the position unchanged — if it would leave the mover in check. */
  makeMove(mv: number): boolean {
    const zobristKey = this.zobristKey;
    this.movePiece(mv);
    if (this.checked()) {
      this.undoMovePiece();
      return false;
    }
    this.keyList.push(zobristKey);
    this.changeSide();
    this.chkList.push(this.checked());
    this.distance += 1;
    return true;
  }

  undoMakeMove(): void {
    this.distance -= 1;
    this.chkList.pop();
    this.changeSide();
    this.keyList.pop();
    this.undoMovePiece();
  }

  nullMove(): void {
    this.mvList.push(0);
    this.pcList.push(0);
    this.keyList.push(this.zobristKey);
    this.changeSide();
    this.chkList.push(false);
    this.distance += 1;
  }

  undoNullMove(): void {
    this.distance -= 1;
    this.chkList.pop();
    this.changeSide();
    this.keyList.pop();
    this.pcList.pop();
    this.mvList.pop();
  }

  fromFen(fen: string): void {
    this.clearBoard();
    let y = RANK_TOP;
    let x = FILE_LEFT;
    let index = 0;
    if (index === fen.length) { this.setIrrev(); return; }
    let c = fen.charAt(index);
    while (c !== ' ') {
      if (c === '/') {
        x = FILE_LEFT;
        y += 1;
        if (y > RANK_BOTTOM) break;
      } else if (c >= '1' && c <= '9') {
        for (let k = 0; k < c.charCodeAt(0) - 48; k += 1) {
          if (x >= FILE_RIGHT) break;
          x += 1;
        }
      } else if (c >= 'A' && c <= 'Z') {
        if (x <= FILE_RIGHT) {
          const pt = charToPiece(c);
          if (pt >= 0) this.addPiece(COORD_XY(x, y), pt + 8);
          x += 1;
        }
      } else if (c >= 'a' && c <= 'z') {
        if (x <= FILE_RIGHT) {
          const pt = charToPiece(c.toUpperCase());
          if (pt >= 0) this.addPiece(COORD_XY(x, y), pt + 16);
          x += 1;
        }
      }
      index += 1;
      if (index === fen.length) { this.setIrrev(); return; }
      c = fen.charAt(index);
    }
    index += 1;
    if (index === fen.length) { this.setIrrev(); return; }
    if (this.sdPlayer === (fen.charAt(index) === 'b' ? 0 : 1)) this.changeSide();
    this.setIrrev();
  }

  toFen(): string {
    let fen = '';
    for (let y = RANK_TOP; y <= RANK_BOTTOM; y += 1) {
      let k = 0;
      for (let x = FILE_LEFT; x <= FILE_RIGHT; x += 1) {
        const pc = this.squares[COORD_XY(x, y)];
        if (pc > 0) {
          if (k > 0) { fen += String.fromCharCode(48 + k); k = 0; }
          fen += FEN_PIECE.charAt(pc);
        } else {
          k += 1;
        }
      }
      if (k > 0) fen += String.fromCharCode(48 + k);
      fen += '/';
    }
    return `${fen.substring(0, fen.length - 1)} ${this.sdPlayer === 0 ? 'w' : 'b'}`;
  }

  /**
   * Every pseudo-legal move for the side to move. With `vls` given, only captures, each scored
   * by most-valuable-victim / least-valuable-attacker into `vls`.
   */
  generateMoves(vls: number[] | null): number[] {
    const mvs: number[] = [];
    const pcSelfSide = SIDE_TAG(this.sdPlayer);
    const pcOppSide = OPP_SIDE_TAG(this.sdPlayer);
    const squares = this.squares;
    for (let sqSrc = 0; sqSrc < 256; sqSrc += 1) {
      const pcSrc = squares[sqSrc];
      if ((pcSrc & pcSelfSide) === 0) continue;
      switch (pcSrc - pcSelfSide) {
        case PIECE_KING:
          for (let i = 0; i < 4; i += 1) {
            const sqDst = sqSrc + KING_DELTA[i];
            if (!IN_FORT(sqDst)) continue;
            const pcDst = squares[sqDst];
            if (vls === null) {
              if ((pcDst & pcSelfSide) === 0) mvs.push(MOVE(sqSrc, sqDst));
            } else if ((pcDst & pcOppSide) !== 0) {
              mvs.push(MOVE(sqSrc, sqDst));
              vls.push(MVV_LVA(pcDst, 5));
            }
          }
          break;
        case PIECE_ADVISOR:
          for (let i = 0; i < 4; i += 1) {
            const sqDst = sqSrc + ADVISOR_DELTA[i];
            if (!IN_FORT(sqDst)) continue;
            const pcDst = squares[sqDst];
            if (vls === null) {
              if ((pcDst & pcSelfSide) === 0) mvs.push(MOVE(sqSrc, sqDst));
            } else if ((pcDst & pcOppSide) !== 0) {
              mvs.push(MOVE(sqSrc, sqDst));
              vls.push(MVV_LVA(pcDst, 1));
            }
          }
          break;
        case PIECE_BISHOP:
          for (let i = 0; i < 4; i += 1) {
            let sqDst = sqSrc + ADVISOR_DELTA[i];
            if (!(IN_BOARD(sqDst) && HOME_HALF(sqDst, this.sdPlayer) && squares[sqDst] === 0)) continue;
            sqDst += ADVISOR_DELTA[i];
            const pcDst = squares[sqDst];
            if (vls === null) {
              if ((pcDst & pcSelfSide) === 0) mvs.push(MOVE(sqSrc, sqDst));
            } else if ((pcDst & pcOppSide) !== 0) {
              mvs.push(MOVE(sqSrc, sqDst));
              vls.push(MVV_LVA(pcDst, 1));
            }
          }
          break;
        case PIECE_KNIGHT:
          for (let i = 0; i < 4; i += 1) {
            let sqDst = sqSrc + KING_DELTA[i];
            if (squares[sqDst] > 0) continue;
            for (let j = 0; j < 2; j += 1) {
              sqDst = sqSrc + KNIGHT_DELTA[i][j];
              if (!IN_BOARD(sqDst)) continue;
              const pcDst = squares[sqDst];
              if (vls === null) {
                if ((pcDst & pcSelfSide) === 0) mvs.push(MOVE(sqSrc, sqDst));
              } else if ((pcDst & pcOppSide) !== 0) {
                mvs.push(MOVE(sqSrc, sqDst));
                vls.push(MVV_LVA(pcDst, 1));
              }
            }
          }
          break;
        case PIECE_ROOK:
          for (let i = 0; i < 4; i += 1) {
            const delta = KING_DELTA[i];
            let sqDst = sqSrc + delta;
            while (IN_BOARD(sqDst)) {
              const pcDst = squares[sqDst];
              if (pcDst === 0) {
                if (vls === null) mvs.push(MOVE(sqSrc, sqDst));
              } else {
                if ((pcDst & pcOppSide) !== 0) {
                  mvs.push(MOVE(sqSrc, sqDst));
                  if (vls !== null) vls.push(MVV_LVA(pcDst, 4));
                }
                break;
              }
              sqDst += delta;
            }
          }
          break;
        case PIECE_CANNON:
          for (let i = 0; i < 4; i += 1) {
            const delta = KING_DELTA[i];
            let sqDst = sqSrc + delta;
            while (IN_BOARD(sqDst)) {
              const pcDst = squares[sqDst];
              if (pcDst === 0) {
                if (vls === null) mvs.push(MOVE(sqSrc, sqDst));
              } else {
                break;
              }
              sqDst += delta;
            }
            sqDst += delta;
            while (IN_BOARD(sqDst)) {
              const pcDst = squares[sqDst];
              if (pcDst > 0) {
                if ((pcDst & pcOppSide) !== 0) {
                  mvs.push(MOVE(sqSrc, sqDst));
                  if (vls !== null) vls.push(MVV_LVA(pcDst, 4));
                }
                break;
              }
              sqDst += delta;
            }
          }
          break;
        case PIECE_PAWN: {
          let sqDst = SQUARE_FORWARD(sqSrc, this.sdPlayer);
          if (IN_BOARD(sqDst)) {
            const pcDst = squares[sqDst];
            if (vls === null) {
              if ((pcDst & pcSelfSide) === 0) mvs.push(MOVE(sqSrc, sqDst));
            } else if ((pcDst & pcOppSide) !== 0) {
              mvs.push(MOVE(sqSrc, sqDst));
              vls.push(MVV_LVA(pcDst, 2));
            }
          }
          if (AWAY_HALF(sqSrc, this.sdPlayer)) {
            for (let delta = -1; delta <= 1; delta += 2) {
              sqDst = sqSrc + delta;
              if (!IN_BOARD(sqDst)) continue;
              const pcDst = squares[sqDst];
              if (vls === null) {
                if ((pcDst & pcSelfSide) === 0) mvs.push(MOVE(sqSrc, sqDst));
              } else if ((pcDst & pcOppSide) !== 0) {
                mvs.push(MOVE(sqSrc, sqDst));
                vls.push(MVV_LVA(pcDst, 2));
              }
            }
          }
          break;
        }
        default:
          break;
      }
    }
    return mvs;
  }

  /** Whether the move obeys the piece's movement. Says nothing about leaving the king in check. */
  legalMove(mv: number): boolean {
    const sqSrc = SRC(mv);
    const pcSrc = this.squares[sqSrc];
    const pcSelfSide = SIDE_TAG(this.sdPlayer);
    if ((pcSrc & pcSelfSide) === 0) return false;
    const sqDst = DST(mv);
    if (!IN_BOARD(sqDst)) return false;
    const pcDst = this.squares[sqDst];
    if ((pcDst & pcSelfSide) !== 0) return false;

    switch (pcSrc - pcSelfSide) {
      case PIECE_KING:
        return IN_FORT(sqDst) && KING_SPAN(sqSrc, sqDst);
      case PIECE_ADVISOR:
        return IN_FORT(sqDst) && ADVISOR_SPAN(sqSrc, sqDst);
      case PIECE_BISHOP:
        return SAME_HALF(sqSrc, sqDst) && BISHOP_SPAN(sqSrc, sqDst) && this.squares[BISHOP_PIN(sqSrc, sqDst)] === 0;
      case PIECE_KNIGHT: {
        const sqPin = KNIGHT_PIN(sqSrc, sqDst);
        return sqPin !== sqSrc && this.squares[sqPin] === 0;
      }
      case PIECE_ROOK:
      case PIECE_CANNON: {
        let delta: number;
        if (SAME_RANK(sqSrc, sqDst)) delta = sqDst < sqSrc ? -1 : 1;
        else if (SAME_FILE(sqSrc, sqDst)) delta = sqDst < sqSrc ? -16 : 16;
        else return false;
        let sqPin = sqSrc + delta;
        while (sqPin !== sqDst && this.squares[sqPin] === 0) sqPin += delta;
        if (sqPin === sqDst) return pcDst === 0 || pcSrc - pcSelfSide === PIECE_ROOK;
        if (pcDst === 0 || pcSrc - pcSelfSide !== PIECE_CANNON) return false;
        sqPin += delta;
        while (sqPin !== sqDst && this.squares[sqPin] === 0) sqPin += delta;
        return sqPin === sqDst;
      }
      case PIECE_PAWN:
        if (AWAY_HALF(sqDst, this.sdPlayer) && (sqDst === sqSrc - 1 || sqDst === sqSrc + 1)) return true;
        return sqDst === SQUARE_FORWARD(sqSrc, this.sdPlayer);
      default:
        return false;
    }
  }

  /** Whether the side to move is in check. */
  checked(): boolean {
    const pcSelfSide = SIDE_TAG(this.sdPlayer);
    const pcOppSide = OPP_SIDE_TAG(this.sdPlayer);
    const squares = this.squares;
    for (let sqSrc = 0; sqSrc < 256; sqSrc += 1) {
      if (squares[sqSrc] !== pcSelfSide + PIECE_KING) continue;
      if (squares[SQUARE_FORWARD(sqSrc, this.sdPlayer)] === pcOppSide + PIECE_PAWN) return true;
      for (let delta = -1; delta <= 1; delta += 2) {
        if (squares[sqSrc + delta] === pcOppSide + PIECE_PAWN) return true;
      }
      for (let i = 0; i < 4; i += 1) {
        if (squares[sqSrc + ADVISOR_DELTA[i]] !== 0) continue;
        for (let j = 0; j < 2; j += 1) {
          if (squares[sqSrc + KNIGHT_CHECK_DELTA[i][j]] === pcOppSide + PIECE_KNIGHT) return true;
        }
      }
      for (let i = 0; i < 4; i += 1) {
        const delta = KING_DELTA[i];
        let sqDst = sqSrc + delta;
        while (IN_BOARD(sqDst)) {
          const pcDst = squares[sqDst];
          if (pcDst > 0) {
            if (pcDst === pcOppSide + PIECE_ROOK || pcDst === pcOppSide + PIECE_KING) return true;
            break;
          }
          sqDst += delta;
        }
        sqDst += delta;
        while (IN_BOARD(sqDst)) {
          const pcDst = squares[sqDst];
          if (pcDst > 0) {
            if (pcDst === pcOppSide + PIECE_CANNON) return true;
            break;
          }
          sqDst += delta;
        }
      }
      return false;
    }
    return false;
  }

  /** No legal move at all: checkmate or stalemate, both of which lose in xiangqi. */
  isMate(): boolean {
    const mvs = this.generateMoves(null);
    for (let i = 0; i < mvs.length; i += 1) {
      if (this.makeMove(mvs[i])) {
        this.undoMakeMove();
        return false;
      }
    }
    return true;
  }

  /** Every move that can actually be played from here. */
  legalMoves(): number[] {
    const out: number[] = [];
    for (const mv of this.generateMoves(null)) {
      if (this.makeMove(mv)) {
        this.undoMakeMove();
        out.push(mv);
      }
    }
    return out;
  }

  mateValue(): number { return this.distance - MATE_VALUE; }
  banValue(): number { return this.distance - BAN_VALUE; }
  drawValue(): number { return (this.distance & 1) === 0 ? -DRAW_VALUE : DRAW_VALUE; }

  evaluate(): number {
    const vl = (this.sdPlayer === 0 ? this.vlWhite - this.vlBlack : this.vlBlack - this.vlWhite) + ADVANCED_VALUE;
    return vl === this.drawValue() ? vl - 1 : vl;
  }

  nullOkay(): boolean { return (this.sdPlayer === 0 ? this.vlWhite : this.vlBlack) > NULL_OKAY_MARGIN; }
  nullSafe(): boolean { return (this.sdPlayer === 0 ? this.vlWhite : this.vlBlack) > NULL_SAFE_MARGIN; }
  inCheck(): boolean { return this.chkList[this.chkList.length - 1]; }
  captured(): boolean { return this.pcList[this.pcList.length - 1] > 0; }

  repValue(vlRep: number): number {
    const vlReturn = ((vlRep & 2) === 0 ? 0 : this.banValue()) + ((vlRep & 4) === 0 ? 0 : -this.banValue());
    return vlReturn === 0 ? this.drawValue() : vlReturn;
  }

  /**
   * Repetition, looking back `recur` occurrences: 0 for none, else 1 plus 2 if this side has been
   * checking throughout (perpetual check, which loses) and 4 if the other side has.
   */
  repStatus(recur_: number): number {
    let recur = recur_;
    let selfSide = false;
    let perpCheck = true;
    let oppPerpCheck = true;
    let index = this.mvList.length - 1;
    while (this.mvList[index] > 0 && this.pcList[index] === 0) {
      if (selfSide) {
        perpCheck = perpCheck && this.chkList[index];
        if (this.keyList[index] === this.zobristKey) {
          recur -= 1;
          if (recur === 0) return 1 + (perpCheck ? 2 : 0) + (oppPerpCheck ? 4 : 0);
        }
      } else {
        oppPerpCheck = oppPerpCheck && this.chkList[index];
      }
      selfSide = !selfSide;
      index -= 1;
    }
    return 0;
  }

  historyIndex(mv: number): number {
    return ((this.squares[SRC(mv)] - 8) << 8) + DST(mv);
  }

  /** Whether either side still has a piece that can give mate (knight, rook, cannon or pawn). */
  hasAttackingMaterial(): boolean {
    for (let sq = 0; sq < 256; sq += 1) {
      if (IN_BOARD(sq) && (this.squares[sq] & 7) > 2) return true;
    }
    return false;
  }
}

/* ── Search ───────────────────────────────────────────────────────────────── */

const SHELL_STEP = [0, 1, 4, 13, 40, 121, 364, 1093];

function shellSort(mvs: number[], vls: number[]): void {
  let stepLevel = 1;
  while (SHELL_STEP[stepLevel] < mvs.length) stepLevel += 1;
  stepLevel -= 1;
  while (stepLevel > 0) {
    const step = SHELL_STEP[stepLevel];
    for (let i = step; i < mvs.length; i += 1) {
      const mvBest = mvs[i];
      const vlBest = vls[i];
      let j = i - step;
      while (j >= 0 && vlBest > vls[j]) {
        mvs[j + step] = mvs[j];
        vls[j + step] = vls[j];
        j -= step;
      }
      mvs[j + step] = mvBest;
      vls[j + step] = vlBest;
    }
    stepLevel -= 1;
  }
}

const PHASE_HASH = 0;
const PHASE_KILLER_1 = 1;
const PHASE_KILLER_2 = 2;
const PHASE_GEN_MOVES = 3;
const PHASE_REST = 4;

class MoveSort {
  mvs: number[] = [];
  vls: number[] = [];
  mvHash = 0;
  mvKiller1 = 0;
  mvKiller2 = 0;
  phase = PHASE_HASH;
  index = 0;
  singleReply = false;

  constructor(
    mvHash: number,
    private pos: Position,
    killerTable: number[][],
    private historyTable: number[],
  ) {
    if (pos.inCheck()) {
      this.phase = PHASE_REST;
      const mvsAll = pos.generateMoves(null);
      for (const mv of mvsAll) {
        if (!pos.makeMove(mv)) continue;
        pos.undoMakeMove();
        this.mvs.push(mv);
        this.vls.push(mv === mvHash ? 0x7fffffff : historyTable[pos.historyIndex(mv)]);
      }
      shellSort(this.mvs, this.vls);
      this.singleReply = this.mvs.length === 1;
    } else {
      this.mvHash = mvHash;
      this.mvKiller1 = killerTable[pos.distance][0];
      this.mvKiller2 = killerTable[pos.distance][1];
    }
  }

  /**
   * The next move to try: the hash move, then the two killers, then everything else by history
   * score. The original is a switch that falls through phase to phase; written as a ladder of
   * ifs here because the project forbids fallthrough, with the same order and the same early
   * returns.
   */
  next(): number {
    if (this.phase === PHASE_HASH) {
      this.phase = PHASE_KILLER_1;
      if (this.mvHash > 0) return this.mvHash;
    }
    if (this.phase === PHASE_KILLER_1) {
      this.phase = PHASE_KILLER_2;
      if (this.mvKiller1 !== this.mvHash && this.mvKiller1 > 0 && this.pos.legalMove(this.mvKiller1)) {
        return this.mvKiller1;
      }
    }
    if (this.phase === PHASE_KILLER_2) {
      this.phase = PHASE_GEN_MOVES;
      if (this.mvKiller2 !== this.mvHash && this.mvKiller2 > 0 && this.pos.legalMove(this.mvKiller2)) {
        return this.mvKiller2;
      }
    }
    if (this.phase === PHASE_GEN_MOVES) {
      this.phase = PHASE_REST;
      this.mvs = this.pos.generateMoves(null);
      this.vls = [];
      for (const mv of this.mvs) this.vls.push(this.historyTable[this.pos.historyIndex(mv)]);
      shellSort(this.mvs, this.vls);
      this.index = 0;
    }
    while (this.index < this.mvs.length) {
      const mv = this.mvs[this.index];
      this.index += 1;
      if (mv !== this.mvHash && mv !== this.mvKiller1 && mv !== this.mvKiller2) return mv;
    }
    return 0;
  }
}

const LIMIT_DEPTH = 10;
const NULL_DEPTH = 1;
const RANDOMNESS = 8;
const HASH_ALPHA = 1;
const HASH_BETA = 2;
const HASH_PV = 3;

interface HashItem { depth: number; flag: number; vl: number; mv: number; zobristLock: number }

/**
 * Alpha-beta with a transposition table, killer moves, history heuristic, null-move pruning and
 * quiescence — the original's search, verbatim. `random` is injectable so tests can make the
 * tie-breaking deterministic.
 */
export class Search {
  private hashMask: number;
  private hashTable: HashItem[] = [];
  private killerTable: number[][] = [];
  private historyTable: number[] = [];
  private mvResult = 0;
  allNodes = 0;
  allMillis = 0;

  constructor(private pos: Position, hashLevel: number, private random: () => number = Math.random) {
    this.hashMask = (1 << hashLevel) - 1;
  }

  private getHashItem(): HashItem {
    return this.hashTable[this.pos.zobristKey & this.hashMask];
  }

  private probeHash(vlAlpha: number, vlBeta: number, depth: number, mv: number[]): number {
    const hash = this.getHashItem();
    if (hash.zobristLock !== this.pos.zobristLock) {
      mv[0] = 0;
      return -MATE_VALUE;
    }
    mv[0] = hash.mv;
    let mate = false;
    if (hash.vl > WIN_VALUE) {
      if (hash.vl <= BAN_VALUE) return -MATE_VALUE;
      hash.vl -= this.pos.distance;
      mate = true;
    } else if (hash.vl < -WIN_VALUE) {
      if (hash.vl >= -BAN_VALUE) return -MATE_VALUE;
      hash.vl += this.pos.distance;
      mate = true;
    } else if (hash.vl === this.pos.drawValue()) {
      return -MATE_VALUE;
    }
    if (hash.depth < depth && !mate) return -MATE_VALUE;
    if (hash.flag === HASH_BETA) return hash.vl >= vlBeta ? hash.vl : -MATE_VALUE;
    if (hash.flag === HASH_ALPHA) return hash.vl <= vlAlpha ? hash.vl : -MATE_VALUE;
    return hash.vl;
  }

  private recordHash(flag: number, vl: number, depth: number, mv: number): void {
    const hash = this.getHashItem();
    if (hash.depth > depth) return;
    hash.flag = flag;
    hash.depth = depth;
    if (vl > WIN_VALUE) {
      if (mv === 0 && vl <= BAN_VALUE) return;
      hash.vl = vl + this.pos.distance;
    } else if (vl < -WIN_VALUE) {
      if (mv === 0 && vl >= -BAN_VALUE) return;
      hash.vl = vl - this.pos.distance;
    } else if (vl === this.pos.drawValue() && mv === 0) {
      return;
    } else {
      hash.vl = vl;
    }
    hash.mv = mv;
    hash.zobristLock = this.pos.zobristLock;
  }

  private setBestMove(mv: number, depth: number): void {
    this.historyTable[this.pos.historyIndex(mv)] += depth * depth;
    const mvsKiller = this.killerTable[this.pos.distance];
    if (mvsKiller[0] !== mv) {
      mvsKiller[1] = mvsKiller[0];
      mvsKiller[0] = mv;
    }
  }

  private searchQuiesc(vlAlpha_: number, vlBeta: number): number {
    let vlAlpha = vlAlpha_;
    this.allNodes += 1;
    let vl = this.pos.mateValue();
    if (vl >= vlBeta) return vl;
    const vlRep = this.pos.repStatus(1);
    if (vlRep > 0) return this.pos.repValue(vlRep);
    if (this.pos.distance === LIMIT_DEPTH) return this.pos.evaluate();
    let vlBest = -MATE_VALUE;
    let mvs: number[] = [];
    const vls: number[] = [];
    if (this.pos.inCheck()) {
      mvs = this.pos.generateMoves(null);
      for (const mv of mvs) vls.push(this.historyTable[this.pos.historyIndex(mv)]);
      shellSort(mvs, vls);
    } else {
      vl = this.pos.evaluate();
      if (vl > vlBest) {
        if (vl >= vlBeta) return vl;
        vlBest = vl;
        vlAlpha = Math.max(vl, vlAlpha);
      }
      mvs = this.pos.generateMoves(vls);
      shellSort(mvs, vls);
      for (let i = 0; i < mvs.length; i += 1) {
        if (vls[i] < 10 || (vls[i] < 20 && HOME_HALF(DST(mvs[i]), this.pos.sdPlayer))) {
          mvs.length = i;
          break;
        }
      }
    }
    for (const mv of mvs) {
      if (!this.pos.makeMove(mv)) continue;
      vl = -this.searchQuiesc(-vlBeta, -vlAlpha);
      this.pos.undoMakeMove();
      if (vl > vlBest) {
        if (vl >= vlBeta) return vl;
        vlBest = vl;
        vlAlpha = Math.max(vl, vlAlpha);
      }
    }
    return vlBest === -MATE_VALUE ? this.pos.mateValue() : vlBest;
  }

  private searchFull(vlAlpha_: number, vlBeta: number, depth: number, noNull: boolean): number {
    let vlAlpha = vlAlpha_;
    if (depth <= 0) return this.searchQuiesc(vlAlpha, vlBeta);
    this.allNodes += 1;
    let vl = this.pos.mateValue();
    if (vl >= vlBeta) return vl;
    const vlRep = this.pos.repStatus(1);
    if (vlRep > 0) return this.pos.repValue(vlRep);
    const mvHash = [0];
    vl = this.probeHash(vlAlpha, vlBeta, depth, mvHash);
    if (vl > -MATE_VALUE) return vl;
    if (this.pos.distance === LIMIT_DEPTH) return this.pos.evaluate();
    if (!noNull && !this.pos.inCheck() && this.pos.nullOkay()) {
      this.pos.nullMove();
      vl = -this.searchFull(-vlBeta, 1 - vlBeta, depth - NULL_DEPTH - 1, true);
      this.pos.undoNullMove();
      if (vl >= vlBeta && (this.pos.nullSafe() || this.searchFull(vlAlpha, vlBeta, depth - NULL_DEPTH, true) >= vlBeta)) {
        return vl;
      }
    }
    let hashFlag = HASH_ALPHA;
    let vlBest = -MATE_VALUE;
    let mvBest = 0;
    const sort = new MoveSort(mvHash[0], this.pos, this.killerTable, this.historyTable);
    let mv: number;
    while ((mv = sort.next()) > 0) {
      if (!this.pos.makeMove(mv)) continue;
      const newDepth = this.pos.inCheck() || sort.singleReply ? depth : depth - 1;
      if (vlBest === -MATE_VALUE) {
        vl = -this.searchFull(-vlBeta, -vlAlpha, newDepth, false);
      } else {
        vl = -this.searchFull(-vlAlpha - 1, -vlAlpha, newDepth, false);
        if (vl > vlAlpha && vl < vlBeta) vl = -this.searchFull(-vlBeta, -vlAlpha, newDepth, false);
      }
      this.pos.undoMakeMove();
      if (vl > vlBest) {
        vlBest = vl;
        if (vl >= vlBeta) {
          hashFlag = HASH_BETA;
          mvBest = mv;
          break;
        }
        if (vl > vlAlpha) {
          vlAlpha = vl;
          hashFlag = HASH_PV;
          mvBest = mv;
        }
      }
    }
    if (vlBest === -MATE_VALUE) return this.pos.mateValue();
    this.recordHash(hashFlag, vlBest, depth, mvBest);
    if (mvBest > 0) this.setBestMove(mvBest, depth);
    return vlBest;
  }

  private searchRoot(depth: number): number {
    let vlBest = -MATE_VALUE;
    const sort = new MoveSort(this.mvResult, this.pos, this.killerTable, this.historyTable);
    let mv: number;
    while ((mv = sort.next()) > 0) {
      if (!this.pos.makeMove(mv)) continue;
      const newDepth = this.pos.inCheck() ? depth : depth - 1;
      let vl: number;
      if (vlBest === -MATE_VALUE) {
        vl = -this.searchFull(-MATE_VALUE, MATE_VALUE, newDepth, true);
      } else {
        vl = -this.searchFull(-vlBest - 1, -vlBest, newDepth, false);
        if (vl > vlBest) vl = -this.searchFull(-MATE_VALUE, -vlBest, newDepth, true);
      }
      this.pos.undoMakeMove();
      if (vl > vlBest) {
        vlBest = vl;
        this.mvResult = mv;
        if (vlBest > -WIN_VALUE && vlBest < WIN_VALUE) {
          vlBest += Math.floor(this.random() * RANDOMNESS) - Math.floor(this.random() * RANDOMNESS);
          vlBest = vlBest === this.pos.drawValue() ? vlBest - 1 : vlBest;
        }
      }
    }
    this.setBestMove(this.mvResult, depth);
    return vlBest;
  }

  private searchUnique(vlBeta: number, depth: number): boolean {
    const sort = new MoveSort(this.mvResult, this.pos, this.killerTable, this.historyTable);
    sort.next();
    let mv: number;
    while ((mv = sort.next()) > 0) {
      if (!this.pos.makeMove(mv)) continue;
      const vl = -this.searchFull(-vlBeta, 1 - vlBeta, this.pos.inCheck() ? depth : depth - 1, false);
      this.pos.undoMakeMove();
      if (vl >= vlBeta) return false;
    }
    return true;
  }

  /**
   * The best move found by iterative deepening up to `depth` plies, stopping once `millis` have
   * been spent, a forced win is seen, or there is only one sensible reply. Returns 0 when the
   * side to move has no legal move.
   */
  searchMain(depth: number, millis: number): number {
    this.hashTable = [];
    for (let i = 0; i <= this.hashMask; i += 1) this.hashTable.push({ depth: 0, flag: 0, vl: 0, mv: 0, zobristLock: 0 });
    this.killerTable = [];
    for (let i = 0; i < LIMIT_DEPTH; i += 1) this.killerTable.push([0, 0]);
    this.historyTable = new Array<number>(4096).fill(0);
    this.mvResult = 0;
    this.allNodes = 0;
    this.pos.distance = 0;
    const t = Date.now();
    for (let i = 1; i <= depth; i += 1) {
      const vl = this.searchRoot(i);
      this.allMillis = Date.now() - t;
      if (this.allMillis > millis) break;
      if (vl > WIN_VALUE || vl < -WIN_VALUE) break;
      if (this.searchUnique(1 - WIN_VALUE, i)) break;
    }
    return this.mvResult;
  }
}
