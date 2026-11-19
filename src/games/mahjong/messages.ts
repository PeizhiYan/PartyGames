// Mahjong's words, in every language: tiles, calls, the scoring lines, what just happened, rules.
import { byLanguage } from '../../i18n';
import { kindOf, rankOfKind, suitOfKind } from './tiles';
import type { MahjongNote } from './rules';

const en = {
  name: 'Mahjong',
  tagline: '麻将. Four players, Guangdong-style scoring. Play friends, computers, or both.',
  soloTitle: 'Play three computers',
  soloDescription: 'No room needed. You and three computer players.',
  setupBlurb: 'Mahjong is always played four at a table: you and three computer players.',
  sitDown: 'Sit down and deal',
  suits: { bamboo: 'bamboo', characters: 'characters', dots: 'dots' },
  /** "3 bamboo" */
  suited: (rank: number, suit: string) => `${rank} ${suit}`,
  winds: { East: 'East wind', South: 'South wind', West: 'West wind', North: 'North wind' } as Record<string, string>,
  /** The one-letter wind on a seat's badge. */
  windBadge: { East: 'E', South: 'S', West: 'W', North: 'N' } as Record<string, string>,
  dragons: ['Red dragon', 'Green dragon', 'White dragon'],
  calls: { pong: '碰 Pong', chow: '吃 Chow', kong: '槓 Kong', win: '胡 Mahjong' },
  shouts: { pong: '碰 Pong!', chow: '吃 Chow!', kong: '槓 Kong!', win: '胡 Mahjong!' },
  meldKinds: { pong: 'pong', chow: 'chow', kong: 'kong' } as Record<string, string>,
  /** The scoring lines a finished hand stores (in English, shared) → as this reader sees them. */
  fanLines: {
    'Thirteen orphans': 'Thirteen orphans', 'Seven pairs': 'Seven pairs', Win: 'Win', 'Self-drawn': 'Self-drawn',
    'All pongs': 'All pongs', 'All honours': 'All honours', 'Full flush': 'Full flush', 'Half flush': 'Half flush',
    'Dragon pong': 'Dragon pong', 'Concealed kong': 'Concealed kong', Kong: 'Kong',
  } as Record<string, string>,
  notes: {
    drawnHand: 'The wall is down to its last tiles — this hand is a draw.',
    selfDrawWin: (who: string, fan: number) => `${who} draws the winning tile — ${fan} fan.`,
    discardWin: (who: string, from: string, tile: string, fan: number) => `${who} wins on ${from}'s ${tile} — ${fan} fan.`,
    call: (who: string, call: string, tile: string) => `${who} calls ${call} on ${tile}.`,
    start: (who: string) => `${who} is East and starts.`,
    discards: (who: string, tile: string) => `${who} discards ${tile}.`,
    kong: (who: string, tile: string) => `${who} declares a kong of ${tile}.`,
  },
  someone: 'Someone',
  emptySeat: 'Empty seat',
  seated: 'seated',
  inWall: 'in the wall',
  hand: (n: number) => `Hand ${n}`,
  lobbyLine: 'Four sets and a pair wins. Chow from the player on your left; pong, kong or win on anyone.',
  deal: 'Deal',
  waitingMore: (n: number) => `Waiting for ${n} more…`,
  waitingDeal: 'Waiting for the host to deal…',
  fillHint: 'Or tap “Add computer” to fill a seat with a computer player.',
  cover: (name: string) => `Play ${name}'s turn (they left)`,
  discarded: (name: string) => `${name} discarded `,
  callIt: '. Call it?',
  pass: 'Pass',
  tapToDiscard: 'Your turn — tap a tile to discard',
  tapAgain: 'Tap it again to discard',
  callOrPass: 'Call it, or pass',
  waitingCalls: 'Waiting for calls…',
  tileAria: (tile: string, mine: boolean) => `${tile}${mine ? ' — tap twice to discard' : ''}`,
  justDrawn: (tile: string) => `${tile}, just drawn`,
  discard: (tile: string) => `Discard ${tile}`,
  tiles: (n: number) => `${n} tiles`,
  pts: (n: number) => `${n} pts`,
  drawnHandTitle: 'A drawn hand',
  youWin: '胡 Mahjong — you win!',
  wins: (name: string) => `${name} wins`,
  wallRanOut: 'The wall ran out before anyone went out.',
  selfDrawn: 'Self-drawn.',
  onYourDiscard: 'On your discard.',
  onDiscard: (name: string) => `On ${name}'s discard.`,
  fan: (n: number) => `${n} fan`,
  total: (limit: boolean) => `Total${limit ? ' (limit)' : ''}`,
  fanPoints: (fan: number, points: number) => `${fan} fan · ${points} points`,
  dealNext: 'Deal the next hand',
  waitingNext: 'Waiting for the host to deal the next hand…',
  art: 'A winning mahjong hand on green felt',
  errors: {
    notUnderWay: 'The hand is not under way.',
    waitClaims: 'Wait for the discard to be claimed or passed.',
    needFour: 'Mahjong needs exactly four players.',
    notInHand: 'That tile is not in your hand.',
    notWinning: 'That is not a winning hand yet.',
    noKong: 'You cannot make a kong with that.',
    nothingToClaim: 'There is nothing to claim.',
    answered: 'You have already answered.',
    cannotClaim: 'You cannot claim that tile that way.',
    noCover: 'There is no turn to cover.',
    finishHand: 'Finish this hand first.',
  },
};

export type MahjongMessages = typeof en;

const zh: MahjongMessages = {
  name: '麻将',
  tagline: '四人一桌，简化广东麻将计分。和朋友、电脑，或一起玩。',
  soloTitle: '和三个电脑玩',
  soloDescription: '不用开房间。你和三个电脑玩家。',
  setupBlurb: '麻将总是四人一桌：你和三个电脑玩家。',
  sitDown: '入座发牌',
  suits: { bamboo: '条', characters: '万', dots: '筒' },
  suited: (rank, suit) => `${'一二三四五六七八九'[rank - 1]}${suit}`,
  winds: { East: '东风', South: '南风', West: '西风', North: '北风' },
  windBadge: { East: '东', South: '南', West: '西', North: '北' },
  dragons: ['红中', '发财', '白板'],
  calls: { pong: '碰', chow: '吃', kong: '杠', win: '胡' },
  shouts: { pong: '碰！', chow: '吃！', kong: '杠！', win: '胡了！' },
  meldKinds: { pong: '碰', chow: '吃', kong: '杠' },
  fanLines: {
    'Thirteen orphans': '十三幺', 'Seven pairs': '七对', Win: '胡牌', 'Self-drawn': '自摸',
    'All pongs': '对对胡', 'All honours': '字一色', 'Full flush': '清一色', 'Half flush': '混一色',
    'Dragon pong': '箭刻', 'Concealed kong': '暗杠', Kong: '明杠',
  },
  notes: {
    drawnHand: '牌墙只剩最后几张——这一局流局。',
    selfDrawWin: (who, fan) => `${who}自摸胡牌——${fan} 番。`,
    discardWin: (who, from, tile, fan) => `${who}胡了${from}打出的${tile}——${fan} 番。`,
    call: (who, call, tile) => `${who}${call}了${tile}。`,
    start: (who) => `${who}坐东，先出牌。`,
    discards: (who, tile) => `${who}打出${tile}。`,
    kong: (who, tile) => `${who}开杠：${tile}。`,
  },
  someone: '有人',
  emptySeat: '空位',
  seated: '已入座',
  inWall: '牌墙余牌',
  hand: (n) => `第 ${n} 局`,
  lobbyLine: '四组加一对即可胡牌。只能吃上家的牌；碰、杠、胡任何人的牌都行。',
  deal: '发牌',
  waitingMore: (n) => `还差 ${n} 人……`,
  waitingDeal: '等待房主发牌……',
  fillHint: '或者点「添加电脑」让电脑玩家坐上空位。',
  cover: (name) => `替${name}出牌（对方已离开）`,
  discarded: (name) => `${name}打出了`,
  callIt: '。要吃碰吗？',
  pass: '过',
  tapToDiscard: '轮到你了——点一张牌打出',
  tapAgain: '再点一次打出',
  callOrPass: '吃碰杠胡，或者过',
  waitingCalls: '等待其他人吃碰……',
  tileAria: (tile, mine) => `${tile}${mine ? '——点两次打出' : ''}`,
  justDrawn: (tile) => `${tile}，刚摸到`,
  discard: (tile) => `打出${tile}`,
  tiles: (n) => `${n} 张牌`,
  pts: (n) => `${n} 分`,
  drawnHandTitle: '流局',
  youWin: '胡了——你赢了！',
  wins: (name) => `${name}胡了`,
  wallRanOut: '牌墙摸完了，没人胡牌。',
  selfDrawn: '自摸。',
  onYourDiscard: '胡的是你打出的牌。',
  onDiscard: (name) => `胡的是${name}打出的牌。`,
  fan: (n) => `${n} 番`,
  total: (limit) => `合计${limit ? '（满番）' : ''}`,
  fanPoints: (fan, points) => `${fan} 番 · ${points} 分`,
  dealNext: '发下一局',
  waitingNext: '等待房主发下一局……',
  art: '绿色桌布上的一手胡牌',
  errors: {
    notUnderWay: '这一局还没开始。',
    waitClaims: '等别人吃碰或者过。',
    needFour: '麻将需要正好四位玩家。',
    notInHand: '你手里没有这张牌。',
    notWinning: '还不是胡牌的牌型。',
    noKong: '这样凑不成杠。',
    nothingToClaim: '现在没有可以吃碰的牌。',
    answered: '你已经回应过了。',
    cannotClaim: '不能这样吃碰这张牌。',
    noCover: '现在没有需要代打的回合。',
    finishHand: '先把这一局打完。',
  },
};

const ja: MahjongMessages = {
  name: '麻雀',
  tagline: '4人卓、簡易広東ルールの点数計算。友だち、コンピューター、またはその両方と。',
  soloTitle: 'コンピューター3人と遊ぶ',
  soloDescription: 'ルーム不要。あなたとコンピューター3人で。',
  setupBlurb: '麻雀はいつも4人で打ちます：あなたとコンピューター3人です。',
  sitDown: '席について配牌',
  suits: { bamboo: '索', characters: '萬', dots: '筒' },
  suited: (rank, suit) => `${rank}${suit}`,
  winds: { East: '東', South: '南', West: '西', North: '北' },
  windBadge: { East: '東', South: '南', West: '西', North: '北' },
  dragons: ['中', '發', '白'],
  calls: { pong: 'ポン', chow: 'チー', kong: 'カン', win: 'ロン' },
  shouts: { pong: 'ポン！', chow: 'チー！', kong: 'カン！', win: 'ロン！' },
  meldKinds: { pong: 'ポン', chow: 'チー', kong: 'カン' },
  fanLines: {
    'Thirteen orphans': '国士無双', 'Seven pairs': '七対子', Win: '和了', 'Self-drawn': 'ツモ',
    'All pongs': '対々和', 'All honours': '字一色', 'Full flush': '清一色', 'Half flush': '混一色',
    'Dragon pong': '三元牌の刻子', 'Concealed kong': '暗槓', Kong: '明槓',
  },
  notes: {
    drawnHand: '山の残りがわずかになりました — この局は流局です。',
    selfDrawWin: (who, fan) => `${who}がツモ和了 — ${fan}番。`,
    discardWin: (who, from, tile, fan) => `${who}が${from}の${tile}でロン — ${fan}番。`,
    call: (who, call, tile) => `${who}が${tile}を${call}。`,
    start: (who) => `${who}が親で、最初の番です。`,
    discards: (who, tile) => `${who}が${tile}を切りました。`,
    kong: (who, tile) => `${who}が${tile}をカン。`,
  },
  someone: '誰か',
  emptySeat: '空席',
  seated: '着席',
  inWall: '山の残り',
  hand: (n) => `第${n}局`,
  lobbyLine: '4面子1雀頭で和了。チーは上家からだけ、ポン・カン・ロンは誰からでも。',
  deal: '配牌',
  waitingMore: (n) => `あと${n}人待っています…`,
  waitingDeal: 'ホストの配牌を待っています…',
  fillHint: '「コンピューターを追加」で空席にコンピューターを座らせることもできます。',
  cover: (name) => `${name}の番を代わりに打つ（退出済み）`,
  discarded: (name) => `${name}が切った`,
  callIt: '。鳴きますか？',
  pass: 'パス',
  tapToDiscard: 'あなたの番 — 牌をタップして切る',
  tapAgain: 'もう一度タップで切る',
  callOrPass: '鳴くか、パス',
  waitingCalls: '鳴きを待っています…',
  tileAria: (tile, mine) => `${tile}${mine ? ' — 2回タップで切る' : ''}`,
  justDrawn: (tile) => `${tile}（今ツモった牌）`,
  discard: (tile) => `${tile}を切る`,
  tiles: (n) => `${n}枚`,
  pts: (n) => `${n}点`,
  drawnHandTitle: '流局',
  youWin: '和了 — あなたの勝ち！',
  wins: (name) => `${name}の和了`,
  wallRanOut: '誰も和了しないまま山が尽きました。',
  selfDrawn: 'ツモ。',
  onYourDiscard: 'あなたの捨て牌でロン。',
  onDiscard: (name) => `${name}の捨て牌でロン。`,
  fan: (n) => `${n}番`,
  total: (limit) => `合計${limit ? '（上限）' : ''}`,
  fanPoints: (fan, points) => `${fan}番 · ${points}点`,
  dealNext: '次の局を配る',
  waitingNext: 'ホストが次の局を配るのを待っています…',
  art: '緑のフェルトの上の和了形',
  errors: {
    notUnderWay: '局は始まっていません。',
    waitClaims: '捨て牌が鳴かれるかパスされるまで待ってください。',
    needFour: '麻雀にはちょうど4人必要です。',
    notInHand: 'その牌は手牌にありません。',
    notWinning: 'まだ和了の形ではありません。',
    noKong: 'その牌ではカンできません。',
    nothingToClaim: '鳴ける牌はありません。',
    answered: 'もう返事をしています。',
    cannotClaim: 'その牌はその形では鳴けません。',
    noCover: '代わりに打つ番はありません。',
    finishHand: 'まずこの局を終えてください。',
  },
};

export const m = byLanguage({ en, zh, ja });

const WIND_KEYS = ['East', 'South', 'West', 'North'];

/** A tile's name in the reader's language: "3 bamboo", "三条", "3索". */
export function tileName(tile: number): string {
  const kind = kindOf(tile);
  const w = m();
  if (kind < 27) return w.suited(rankOfKind(kind), w.suits[suitOfKind(kind)!]);
  if (kind < 31) return w.winds[WIND_KEYS[kind - 27]];
  return w.dragons[kind - 31];
}

/** A stored scoring line, in the reader's language. */
export const fanLine = (label: string): string => m().fanLines[label] ?? label;

/**
 * What just happened, worded for this reader. `nameOf` turns a uid into the name to show. A room
 * from before notes were data holds an English sentence; that is shown as it is.
 */
export function noteText(note: MahjongNote | string | null, nameOf: (uid: string) => string): string {
  if (note === null) return '';
  if (typeof note === 'string') return note;
  const n = m().notes;
  switch (note.k) {
    case 'drawnHand': return n.drawnHand;
    case 'selfDrawWin': return n.selfDrawWin(nameOf(note.who), note.fan);
    case 'discardWin': return n.discardWin(nameOf(note.who), nameOf(note.from), tileName(note.tile), note.fan);
    case 'call': return n.call(nameOf(note.who), m().calls[note.call], tileName(note.tile));
    case 'start': return n.start(nameOf(note.who));
    case 'discards': return n.discards(nameOf(note.who), tileName(note.tile));
    case 'kong': return n.kong(nameOf(note.who), tileName(note.tile));
    default: return '';
  }
}
