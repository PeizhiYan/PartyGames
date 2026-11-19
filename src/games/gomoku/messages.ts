// Gomoku's words, in every language. The shared two-player words (turns, takebacks, rematches) are
// in the app's messages under `duel`.
import { byLanguage } from '../../i18n';

const en = {
  name: 'Gomoku',
  tagline: 'Five in a row. Play a friend, or take on the computer.',
  soloTitle: 'Play on this device',
  soloDescription: 'The computer at three difficulties, or a friend on the same screen.',
  black: 'Black',
  white: 'White',
  draw: "It's a draw — the board is full.",
  computerWins: 'The computer wins.',
  toPlay: (stone: string) => `${stone} to play`,
  vsComputer: 'Gomoku vs the computer',
  twoPlayers: 'Gomoku · two players',
  computer: 'Computer',
  undoStone: 'Undo the last stone',
  help: {
    easy: 'One move ahead, and it will let things slide.',
    normal: 'Looks two moves ahead, including your reply.',
    hard: 'Looks four moves ahead. Takes a moment to think.',
  },
  insight: 'Insight',
  insightHelp: 'Shade the board by how much each point is worth.',
  off: 'Off',
  on: 'On',
  undoBoth: 'That takes their stone and your reply back off the board, and the turn returns to them.',
  undoOne: 'That takes their stone back off the board, and the turn returns to them.',
  boardLabel: (n: number) => `Gomoku board, ${n} stones played`,
  art: 'A gomoku board with five black stones in a row',
  errors: {
    notACell: 'That is not a cell.',
    occupied: 'There is already a stone there.',
    noStone: 'You have not played a stone yet.',
  },
};

export type GomokuMessages = typeof en;

const zh: GomokuMessages = {
  name: '五子棋',
  tagline: '五子连珠。和朋友对弈，或挑战电脑。',
  soloTitle: '在本机上玩',
  soloDescription: '三档难度的电脑，或和朋友在同一块屏幕上对弈。',
  black: '黑方',
  white: '白方',
  draw: '和棋——棋盘下满了。',
  computerWins: '电脑赢了。',
  toPlay: (stone) => `轮到${stone}`,
  vsComputer: '五子棋 · 对电脑',
  twoPlayers: '五子棋 · 双人',
  computer: '电脑',
  undoStone: '悔一步棋',
  help: {
    easy: '只看一步，常会放过机会。',
    normal: '看两步，包括你的应对。',
    hard: '看四步，要想一会儿。',
  },
  insight: '洞察',
  insightHelp: '按每个点的价值给棋盘着色。',
  off: '关',
  on: '开',
  undoBoth: '这会撤回对方的一子和你的应手，轮到对方再下。',
  undoOne: '这会撤回对方的一子，轮到对方再下。',
  boardLabel: (n) => `五子棋棋盘，已下 ${n} 子`,
  art: '棋盘上五颗黑子连成一线',
  errors: {
    notACell: '那里不是棋盘上的点。',
    occupied: '那里已经有子了。',
    noStone: '你还没有落子。',
  },
};

const ja: GomokuMessages = {
  name: '五目並べ',
  tagline: '五つ並べたら勝ち。友だちと対局、またはコンピューターに挑戦。',
  soloTitle: 'この端末で遊ぶ',
  soloDescription: '3段階の強さのコンピューター、または同じ画面で友だちと。',
  black: '黒',
  white: '白',
  draw: '引き分け — 盤が埋まりました。',
  computerWins: 'コンピューターの勝ち。',
  toPlay: (stone) => `${stone}の番`,
  vsComputer: '五目並べ · コンピューター戦',
  twoPlayers: '五目並べ · 2人対局',
  computer: 'コンピューター',
  undoStone: '最後の一手を戻す',
  help: {
    easy: '一手先だけ。見逃しも多めです。',
    normal: 'あなたの応手も含めて二手先まで読みます。',
    hard: '四手先まで読みます。少し考えます。',
  },
  insight: 'ヒント',
  insightHelp: '各点の価値で盤を色分けします。',
  off: 'オフ',
  on: 'オン',
  undoBoth: '相手の石とあなたの応手を盤から戻し、相手の番に戻ります。',
  undoOne: '相手の石を盤から戻し、相手の番に戻ります。',
  boardLabel: (n) => `五目並べの盤、${n} 手目まで`,
  art: '黒石が五つ並んだ五目並べの盤',
  errors: {
    notACell: 'そこは盤上の点ではありません。',
    occupied: 'そこにはもう石があります。',
    noStone: 'まだ石を置いていません。',
  },
};

export const m = byLanguage({ en, zh, ja });
