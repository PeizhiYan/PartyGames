// Chinese chess's words, in every language. The shared two-player words are in the app's messages
// (`duel`).
import { byLanguage } from '../../i18n';

const en = {
  name: 'Chinese Chess',
  tagline: '象棋. Generals, cannons and the river. Play a friend, or the engine.',
  soloTitle: 'Play on this device',
  soloDescription: 'The engine at three strengths, or a friend on the same screen.',
  white: 'Red',
  black: 'Black',
  vsComputer: 'Chinese Chess vs the engine',
  twoPlayers: 'Chinese Chess · two players',
  computer: 'Engine',
  theComputer: 'The engine',
  computerWins: 'The engine wins.',
  help: {
    easy: 'Two plies deep and quick about it.',
    normal: 'Half a second of search per move.',
    hard: "Two and a half seconds per move. The original site's strength.",
  },
  /** How a game ended, as the rules store it (in English, shared) → as this reader sees it. */
  reasons: {
    'Checkmate.': 'Checkmate.',
    'No legal move left — that loses in xiangqi.': 'No legal move left — that loses in xiangqi.',
    'Draw by repetition.': 'Draw by repetition.',
    'Red loses for perpetual check.': 'Red loses for perpetual check.',
    'Black loses for perpetual check.': 'Black loses for perpetual check.',
    'Draw — neither side can give mate.': 'Draw — neither side can give mate.',
    'Draw — 50 moves without a capture.': 'Draw — 50 moves without a capture.',
    'Red resigned.': 'Red resigned.',
    'Black resigned.': 'Black resigned.',
  } as Record<string, string>,
  boardLabel: (moves: number) => `Chinese chess board, ${moves} moves played`,
  art: 'A Chinese chess board with pieces either side of the river',
  errors: {
    notAMove: 'That is not a move.',
    cannotMove: 'That piece cannot move there.',
    inCheck: 'That would leave your general in check.',
  },
};

export type XiangqiMessages = typeof en;

const zh: XiangqiMessages = {
  name: '中国象棋',
  tagline: '象棋。将帅、炮与楚河汉界。和朋友对弈，或挑战引擎。',
  soloTitle: '在本机上玩',
  soloDescription: '三档强度的引擎，或和朋友在同一块屏幕上对弈。',
  white: '红方',
  black: '黑方',
  vsComputer: '中国象棋 · 对引擎',
  twoPlayers: '中国象棋 · 双人',
  computer: '引擎',
  theComputer: '引擎',
  computerWins: '引擎赢了。',
  help: {
    easy: '只算两步，出手很快。',
    normal: '每步搜索半秒。',
    hard: '每步搜索两秒半，原网站的棋力。',
  },
  reasons: {
    'Checkmate.': '将死。',
    'No legal move left — that loses in xiangqi.': '无子可走——在象棋里这算输。',
    'Draw by repetition.': '重复局面，和棋。',
    'Red loses for perpetual check.': '红方长将，判负。',
    'Black loses for perpetual check.': '黑方长将，判负。',
    'Draw — neither side can give mate.': '和棋——双方都无法将死对方。',
    'Draw — 50 moves without a capture.': '和棋——五十回合没有吃子。',
    'Red resigned.': '红方认输。',
    'Black resigned.': '黑方认输。',
  },
  boardLabel: (moves) => `中国象棋棋盘，已走 ${moves} 步`,
  art: '楚河汉界两侧摆着棋子的象棋棋盘',
  errors: {
    notAMove: '这不是一步棋。',
    cannotMove: '这个子不能走到那里。',
    inCheck: '这样走会让你的将帅被将军。',
  },
};

const ja: XiangqiMessages = {
  name: 'シャンチー',
  tagline: '象棋（中国将棋）。帥・砲・そして河。友だちと対局、またはエンジンと。',
  soloTitle: 'この端末で遊ぶ',
  soloDescription: '3段階の強さのエンジン、または同じ画面で友だちと。',
  white: '赤',
  black: '黒',
  vsComputer: 'シャンチー · エンジン戦',
  twoPlayers: 'シャンチー · 2人対局',
  computer: 'エンジン',
  theComputer: 'エンジン',
  computerWins: 'エンジンの勝ち。',
  help: {
    easy: '2プライ先まで、素早く指します。',
    normal: '1手あたり0.5秒読みます。',
    hard: '1手あたり2.5秒読みます。元のサイトの強さです。',
  },
  reasons: {
    'Checkmate.': '詰み。',
    'No legal move left — that loses in xiangqi.': '指せる手がありません — シャンチーでは負けです。',
    'Draw by repetition.': '千日手で引き分け。',
    'Red loses for perpetual check.': '赤の連続王手で、赤の負け。',
    'Black loses for perpetual check.': '黒の連続王手で、黒の負け。',
    'Draw — neither side can give mate.': '引き分け — どちらも詰ませられません。',
    'Draw — 50 moves without a capture.': '引き分け — 50手のあいだ駒取りがありません。',
    'Red resigned.': '赤が投了しました。',
    'Black resigned.': '黒が投了しました。',
  },
  boardLabel: (moves) => `シャンチーの盤、${moves} 手目まで`,
  art: '河をはさんで駒が並ぶシャンチーの盤',
  errors: {
    notAMove: 'それは指し手ではありません。',
    cannotMove: 'その駒はそこへ動けません。',
    inCheck: 'その手では帥（将）が王手のままになります。',
  },
};

export const m = byLanguage({ en, zh, ja });

/** A stored end-of-game reason, in the reader's language (or as stored, if it is not one we know). */
export const reasonText = (reason: string): string => m().reasons[reason] ?? reason;
