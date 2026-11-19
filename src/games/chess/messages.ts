// Chess's words, in every language. The shared two-player words are in the app's messages (`duel`).
import { byLanguage } from '../../i18n';

const en = {
  name: 'Chess',
  tagline: 'The classic. Play a friend, or the computer at three strengths.',
  soloTitle: 'Play on this device',
  soloDescription: 'The computer at three strengths, or a friend on the same screen.',
  white: 'White',
  black: 'Black',
  vsComputer: 'Chess vs the computer',
  twoPlayers: 'Chess · two players',
  computer: 'Computer',
  computerWins: 'The computer wins.',
  help: {
    easy: 'One move ahead. It will blunder.',
    normal: 'Four plies ahead, captures to the end.',
    hard: 'Six plies in a couple of seconds. It sees short mates.',
  },
  /**
   * How a game ended. The rules store the English sentence in the shared state (every player sees
   * the same state, whatever their language), and each screen shows it in its own.
   */
  reasons: {
    'Checkmate.': 'Checkmate.',
    'Stalemate.': 'Stalemate.',
    'Draw — not enough material to mate.': 'Draw — not enough material to mate.',
    'Draw — fifty moves without a capture or pawn move.': 'Draw — fifty moves without a capture or pawn move.',
    'Draw by threefold repetition.': 'Draw by threefold repetition.',
    'White resigned.': 'White resigned.',
    'Black resigned.': 'Black resigned.',
  } as Record<string, string>,
  boardLabel: (moves: number) => `Chess board, ${moves} moves in`,
  promoteTo: 'Promote to',
  pieces: { knight: 'knight', bishop: 'bishop', rook: 'rook', queen: 'queen' },
  art: 'A chess board mid-game',
  errors: {
    notAMove: 'That is not a move.',
    notAllowed: 'That move is not allowed.',
  },
};

export type ChessMessages = typeof en;

const zh: ChessMessages = {
  name: '国际象棋',
  tagline: '经典棋局。和朋友对弈，或挑战三档难度的电脑。',
  soloTitle: '在本机上玩',
  soloDescription: '三档难度的电脑，或和朋友在同一块屏幕上对弈。',
  white: '白方',
  black: '黑方',
  vsComputer: '国际象棋 · 对电脑',
  twoPlayers: '国际象棋 · 双人',
  computer: '电脑',
  computerWins: '电脑赢了。',
  help: {
    easy: '只看一步，会出昏招。',
    normal: '看四个半回合，吃子算到底。',
    hard: '几秒内看六个半回合，能看出短杀。',
  },
  reasons: {
    'Checkmate.': '将死。',
    'Stalemate.': '逼和。',
    'Draw — not enough material to mate.': '和棋——双方子力都不足以将死。',
    'Draw — fifty moves without a capture or pawn move.': '和棋——五十回合无吃子也无兵走动。',
    'Draw by threefold repetition.': '三次重复局面，和棋。',
    'White resigned.': '白方认输。',
    'Black resigned.': '黑方认输。',
  },
  boardLabel: (moves) => `国际象棋棋盘，第 ${moves} 回合`,
  promoteTo: '升变为',
  pieces: { knight: '马', bishop: '象', rook: '车', queen: '后' },
  art: '对局中的国际象棋棋盘',
  errors: {
    notAMove: '这不是一步棋。',
    notAllowed: '这步棋不合规则。',
  },
};

const ja: ChessMessages = {
  name: 'チェス',
  tagline: '定番のボードゲーム。友だちと対局、または3段階の強さのコンピューターと。',
  soloTitle: 'この端末で遊ぶ',
  soloDescription: '3段階の強さのコンピューター、または同じ画面で友だちと。',
  white: '白',
  black: '黒',
  vsComputer: 'チェス · コンピューター戦',
  twoPlayers: 'チェス · 2人対局',
  computer: 'コンピューター',
  computerWins: 'コンピューターの勝ち。',
  help: {
    easy: '一手先だけ。悪手も指します。',
    normal: '4プライ先まで、駒取りは最後まで読みます。',
    hard: '数秒で6プライ先まで。短い詰みを見抜きます。',
  },
  reasons: {
    'Checkmate.': 'チェックメイト。',
    'Stalemate.': 'ステイルメイト。',
    'Draw — not enough material to mate.': '引き分け — どちらもメイトできる駒がありません。',
    'Draw — fifty moves without a capture or pawn move.': '引き分け — 50手のあいだ駒取りもポーンの前進もありません。',
    'Draw by threefold repetition.': '同一局面3回で引き分け。',
    'White resigned.': '白が投了しました。',
    'Black resigned.': '黒が投了しました。',
  },
  boardLabel: (moves) => `チェス盤、${moves} 手目`,
  promoteTo: '昇格先',
  pieces: { knight: 'ナイト', bishop: 'ビショップ', rook: 'ルーク', queen: 'クイーン' },
  art: '対局中のチェス盤',
  errors: {
    notAMove: 'それは指し手ではありません。',
    notAllowed: 'その手は指せません。',
  },
};

export const m = byLanguage({ en, zh, ja });

/** A stored end-of-game reason, in the reader's language (or as stored, if it is not one we know). */
export const reasonText = (reason: string): string => m().reasons[reason] ?? reason;
