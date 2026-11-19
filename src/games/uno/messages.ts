// UNO's words, in every language: the cards, what just happened at the table, and the rules.
import { byLanguage } from '../../i18n';
import { cardOf, type Color, type Kind } from './cards';
import type { UnoNote } from './rules';

/** Card faces whose name is a word, not a number. */
type Named = Exclude<Kind, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>;

const s = (n: number) => (n === 1 ? '' : 's');
const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

const en = {
  name: 'UNO',
  tagline: "Match the colour, match the number, and don't forget to call it. 2-10 players.",
  soloTitle: 'Play the computer',
  soloDescription: 'No room needed. One to five computer players.',
  setupBlurb: "Match the colour or the face. Don't forget to call it.",
  dealCards: 'Deal the cards',
  colors: { red: 'red', yellow: 'yellow', green: 'green', blue: 'blue' } satisfies Record<Color, string>,
  kinds: { skip: 'skip', reverse: 'reverse', draw2: 'draw two', wild: 'Wild', wild4: 'Wild draw four' } satisfies Record<Named, string>,
  /** "Blue 7", "Red skip"; a wild is just its name. */
  card: (color: string | null, face: string) => (color === null ? face : `${cap(color)} ${face}`),
  /** What just happened, worded from the note the rules stored (see `UnoNote`). */
  notes: {
    start: (card: string, who: string) => `${card} turned up. ${who} starts.`,
    played: (who: string, card: string, color: string | null) => `${who} played ${card}${color ? ` — ${color}` : ''}.`,
    out: (who: string, points: number) => `${who} is out of cards and scores ${points}.`,
    drewPenalty: (who: string, n: number) => `${who} drew ${n} and loses the turn.`,
    nothing: (who: string) => `${who} had nothing to draw and passes.`,
    drew: (who: string) => `${who} drew a card.`,
    drewPasses: (who: string) => `${who} drew a card and passes.`,
    passes: (who: string) => `${who} passes.`,
    uno: (who: string) => `${who} calls UNO!`,
    caught: (who: string, target: string) => `${who} caught ${target} without UNO — two cards.`,
  },
  someone: 'Someone',
  shouts: { skip: 'Skip!', reverse: 'Reverse!', draw2: '+2!', wild4: '+4!', caught: 'Caught!', uno: 'UNO!', out: 'Out!', color: (c: string) => `${cap(c)}!` },
  lobbyLine: 'Seven cards each. Match the colour or the face — first out wins the round.',
  atTable: (n: number) => `${n} at the table`,
  waitingSecond: 'Waiting for a second player…',
  deal: 'Deal',
  waitingDeal: 'Waiting for the host to deal…',
  drawCard: 'Draw a card',
  onPile: (card: string) => `On the pile: ${card}`,
  cardsCount: (n: number) => `${n} card${s(n)}`,
  catch: 'Catch!',
  pts: (n: number) => `${n} pts`,
  stackOrDraw: (n: number) => `Stack it, or draw ${n}`,
  playDrawn: 'Play the card you drew, or pass',
  drawN: (n: number) => `Draw ${n}`,
  pass: 'Pass',
  callUno: 'UNO!',
  watching: "You're watching this round. You'll be dealt in next round.",
  chooseColour: 'Choose a colour',
  youWinRound: 'You win the round!',
  winsRound: (name: string) => `${name} wins the round`,
  youReached: (target: number) => `You have reached ${target} — match won.`,
  reached: (name: string, target: number) => `${name} has reached ${target} — match won.`,
  dealNext: 'Deal the next round',
  waitingNext: 'Waiting for the host to deal the next round…',
  art: 'Five UNO cards fanned out',
  errors: {
    needTwo: 'UNO needs at least two players.',
    notUnderWay: 'The round is not under way.',
    notInHand: 'That card is not in your hand.',
    stackOrDraw: (n: number) => `Stack a matching draw card, or draw ${n}.`,
    onlyDrawn: 'You can only play the card you just drew — or pass.',
    noMatch: 'That card does not match.',
    nameColour: 'Name a colour for the wild.',
    alreadyDrew: 'You already drew — play that card or pass.',
    drawFirst: 'Draw a card first.',
    unoCards: 'UNO is for your last card or two.',
    notInRound: 'You are not in this round.',
    callInstead: 'Call UNO instead.',
    tooLate: 'Too late — they are covered.',
    finishRound: 'Finish this round first.',
  },
};

export type UnoMessages = typeof en;

const zh: UnoMessages = {
  name: 'UNO',
  tagline: '颜色相同或数字相同就能出，别忘了喊 UNO。2-10 人。',
  soloTitle: '和电脑玩',
  soloDescription: '不用开房间。一到五个电脑玩家。',
  setupBlurb: '颜色或牌面相同就能出。别忘了喊 UNO。',
  dealCards: '发牌',
  colors: { red: '红', yellow: '黄', green: '绿', blue: '蓝' },
  kinds: { skip: '跳过', reverse: '反转', draw2: '+2', wild: '变色', wild4: '变色 +4' },
  card: (color, face) => (color === null ? face : `${color}${face}`),
  notes: {
    start: (card, who) => `翻开了${card}。${who}先出。`,
    played: (who, card, color) => `${who}出了${card}${color ? `——${color}色` : ''}。`,
    out: (who, points) => `${who}出完了牌，得 ${points} 分。`,
    drewPenalty: (who, n) => `${who}摸了 ${n} 张，跳过本轮。`,
    nothing: (who) => `${who}没有牌可摸，过。`,
    drew: (who) => `${who}摸了一张牌。`,
    drewPasses: (who) => `${who}摸了一张牌，过。`,
    passes: (who) => `${who}过。`,
    uno: (who) => `${who}喊了 UNO！`,
    caught: (who, target) => `${who}抓到${target}没喊 UNO——罚两张。`,
  },
  someone: '有人',
  shouts: { skip: '跳过！', reverse: '反转！', draw2: '+2！', wild4: '+4！', caught: '被抓了！', uno: 'UNO！', out: '出完！', color: (c) => `${c}色！` },
  lobbyLine: '每人七张牌。颜色或牌面相同就能出——先出完的赢这一轮。',
  atTable: (n) => `桌上 ${n} 人`,
  waitingSecond: '等待第二位玩家……',
  deal: '发牌',
  waitingDeal: '等待房主发牌……',
  drawCard: '摸一张牌',
  onPile: (card) => `牌堆顶：${card}`,
  cardsCount: (n) => `${n} 张牌`,
  catch: '抓！',
  pts: (n) => `${n} 分`,
  stackOrDraw: (n) => `叠上去，或者摸 ${n} 张`,
  playDrawn: '出刚摸的牌，或者过',
  drawN: (n) => `摸 ${n} 张`,
  pass: '过',
  callUno: 'UNO！',
  watching: '你在观战这一轮，下一轮会给你发牌。',
  chooseColour: '选一个颜色',
  youWinRound: '这一轮你赢了！',
  winsRound: (name) => `${name}赢了这一轮`,
  youReached: (target) => `你达到了 ${target} 分——赢得整场比赛。`,
  reached: (name, target) => `${name}达到了 ${target} 分——赢得整场比赛。`,
  dealNext: '发下一轮',
  waitingNext: '等待房主发下一轮……',
  art: '扇形展开的五张 UNO 牌',
  errors: {
    needTwo: 'UNO 至少需要两位玩家。',
    notUnderWay: '这一轮还没开始。',
    notInHand: '你手里没有这张牌。',
    stackOrDraw: (n) => `叠一张相同的加牌，或者摸 ${n} 张。`,
    onlyDrawn: '只能出刚摸到的那张牌——或者过。',
    noMatch: '这张牌对不上。',
    nameColour: '请为变色牌选一个颜色。',
    alreadyDrew: '你已经摸过了——出那张牌或者过。',
    drawFirst: '先摸一张牌。',
    unoCards: '只剩一两张牌时才能喊 UNO。',
    notInRound: '你不在这一轮里。',
    callInstead: '你应该自己喊 UNO。',
    tooLate: '来不及了——对方已经喊过了。',
    finishRound: '先把这一轮打完。',
  },
};

const ja: UnoMessages = {
  name: 'UNO',
  tagline: '色か数字が同じなら出せる。UNO のコールを忘れずに。2〜10人。',
  soloTitle: 'コンピューターと遊ぶ',
  soloDescription: 'ルーム不要。コンピューター1〜5人と。',
  setupBlurb: '色か絵柄が同じなら出せます。UNO のコールを忘れずに。',
  dealCards: 'カードを配る',
  colors: { red: '赤', yellow: '黄', green: '緑', blue: '青' },
  kinds: { skip: 'スキップ', reverse: 'リバース', draw2: 'ドロー2', wild: 'ワイルド', wild4: 'ワイルドドロー4' },
  card: (color, face) => (color === null ? face : `${color}の${face}`),
  notes: {
    start: (card, who) => `${card}がめくられました。${who}から。`,
    played: (who, card, color) => `${who}が${card}を出しました${color ? ` — ${color}` : ''}。`,
    out: (who, points) => `${who}が上がり、${points}点獲得。`,
    drewPenalty: (who, n) => `${who}は${n}枚引いて、番を飛ばされました。`,
    nothing: (who) => `${who}は引くカードがなく、パス。`,
    drew: (who) => `${who}がカードを1枚引きました。`,
    drewPasses: (who) => `${who}は1枚引いてパス。`,
    passes: (who) => `${who}はパス。`,
    uno: (who) => `${who}が UNO！`,
    caught: (who, target) => `${who}が${target}の UNO 忘れを指摘 — 2枚。`,
  },
  someone: '誰か',
  shouts: { skip: 'スキップ！', reverse: 'リバース！', draw2: '+2！', wild4: '+4！', caught: 'バレた！', uno: 'UNO！', out: '上がり！', color: (c) => `${c}！` },
  lobbyLine: '1人7枚。色か絵柄を合わせて出し、最初に手札をなくした人がラウンドの勝ち。',
  atTable: (n) => `テーブルに${n}人`,
  waitingSecond: '2人目を待っています…',
  deal: '配る',
  waitingDeal: 'ホストが配るのを待っています…',
  drawCard: 'カードを1枚引く',
  onPile: (card) => `場のカード：${card}`,
  cardsCount: (n) => `${n}枚`,
  catch: '指摘！',
  pts: (n) => `${n}点`,
  stackOrDraw: (n) => `重ねるか、${n}枚引く`,
  playDrawn: '引いたカードを出すか、パス',
  drawN: (n) => `${n}枚引く`,
  pass: 'パス',
  callUno: 'UNO！',
  watching: 'このラウンドは観戦中です。次のラウンドから配られます。',
  chooseColour: '色を選ぶ',
  youWinRound: 'このラウンドはあなたの勝ち！',
  winsRound: (name) => `${name}がこのラウンドの勝ち`,
  youReached: (target) => `${target}点に到達 — マッチの勝利！`,
  reached: (name, target) => `${name}が${target}点に到達 — マッチの勝利。`,
  dealNext: '次のラウンドを配る',
  waitingNext: 'ホストが次のラウンドを配るのを待っています…',
  art: '扇形に広げた UNO のカード5枚',
  errors: {
    needTwo: 'UNO には2人以上必要です。',
    notUnderWay: 'ラウンドは始まっていません。',
    notInHand: 'そのカードは手札にありません。',
    stackOrDraw: (n) => `同じドローカードを重ねるか、${n}枚引いてください。`,
    onlyDrawn: '出せるのは今引いたカードだけです — またはパス。',
    noMatch: 'そのカードは出せません。',
    nameColour: 'ワイルドの色を選んでください。',
    alreadyDrew: 'もう引きました — そのカードを出すかパスしてください。',
    drawFirst: 'まずカードを引いてください。',
    unoCards: 'UNO は残り1〜2枚のときに言います。',
    notInRound: 'このラウンドに参加していません。',
    callInstead: '自分で UNO と言いましょう。',
    tooLate: '遅かった — もう UNO と言っています。',
    finishRound: 'まずこのラウンドを終えてください。',
  },
};

export const m = byLanguage({ en, zh, ja });

/** A card's name in the reader's language: "Blue 7", "红跳过", "ワイルド". */
export function cardName(id: number): string {
  const c = cardOf(id);
  const w = m();
  const face = /^[0-9]$/.test(c.kind) ? c.kind : w.kinds[c.kind as Named];
  return c.color === 'wild' ? face : w.card(w.colors[c.color], face);
}

/**
 * What just happened, worded for this reader. `nameOf` turns a uid into the name to show. A room
 * from before notes were data holds an English sentence; that is shown as it is.
 */
export function noteText(note: UnoNote | string | null, nameOf: (uid: string) => string): string {
  if (note === null) return '';
  if (typeof note === 'string') return note;
  const n = m().notes;
  const color = (c?: Color) => (c ? m().colors[c] : null);
  switch (note.k) {
    case 'start': return n.start(cardName(note.card), nameOf(note.who));
    case 'played': return n.played(nameOf(note.who), cardName(note.card), color(note.color));
    case 'out': return n.out(nameOf(note.who), note.points);
    case 'drewPenalty': return n.drewPenalty(nameOf(note.who), note.n);
    case 'nothing': return n.nothing(nameOf(note.who));
    case 'drew': return n.drew(nameOf(note.who));
    case 'drewPasses': return n.drewPasses(nameOf(note.who));
    case 'passes': return n.passes(nameOf(note.who));
    case 'uno': return n.uno(nameOf(note.who));
    case 'caught': return n.caught(nameOf(note.who), nameOf(note.target));
    default: return '';
  }
}
