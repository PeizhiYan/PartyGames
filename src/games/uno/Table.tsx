import { useMemo, useState, type CSSProperties } from 'react';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
import Seat from '../cast/Seat';
import Confetti from '../cast/Confetti';
import { assignSpecies } from '../cast/cast';
import { bubbleFor, expressionFor, useMoments, type Detect, type Moment } from '../cast/moments';
import { isComputer } from '../local';
import UnoCard, { INK } from './Card';
import { COLORS, cardOf, isWild, type Color } from './cards';
import {
  TARGET, catchable, currentSeat, handOf, matchWinner, playableCards, ranking, topCard,
  type UnoAction, type UnoState,
} from './rules';
import { newSeed } from '../shuffle';
import { firstName } from '../../lib/format';
import './Uno.css';

export interface TableProps {
  state: UnoState;
  uid: string;
  act: (action: UnoAction) => unknown;
  busy: boolean;
  error: string;
  /** The host deals each round. */
  owner: boolean;
}

/** Display order for a hand: by colour, then by face. Purely cosmetic — the state keeps deal order. */
const ORDER = [...COLORS, 'wild'] as string[];
const sortHand = (hand: number[]) => [...hand].sort((a, b) => {
  const ca = cardOf(a);
  const cb = cardOf(b);
  return ORDER.indexOf(ca.color) - ORDER.indexOf(cb.color) || ca.kind.localeCompare(cb.kind, undefined, { numeric: true });
});

/** A card's resting tilt on the pile, from its id, so the pile looks thrown-down and stays put. */
const tilt = (id: number) => ((id * 47) % 31) - 15;

const SHOUT: Record<string, string> = { skip: 'Skip!', reverse: 'Reverse!', draw2: '+2!', wild4: '+4!' };

/**
 * What just happened at the table, for the bubbles, faces and flying cards. Reads the viewer's own
 * hand to deal new cards in, and only counts for everyone else.
 */
const detector = (viewer: string): Detect<UnoState> => (prev, next) => {
  const out: Omit<Moment, 'id'>[] = [];
  if (next.phase !== 'playing' && next.phase !== 'results') return out;
  const played = next.discard.length > prev.discard.length || (next.discard[next.discard.length - 1] !== prev.discard[prev.discard.length - 1] && next.round === prev.round);
  if (played && prev.phase === 'playing') {
    const by = prev.seats[prev.turn]?.uid;
    const card = topCard(next);
    const c = cardOf(card);
    if (by) {
      out.push({
        kind: 'play', uid: by, data: { card }, ttl: 900,
        text: isWild(card) ? `${next.activeColor[0].toUpperCase()}${next.activeColor.slice(1)}!` : SHOUT[c.kind],
        tone: c.kind === 'wild4' || c.kind === 'draw2' ? 'hot' : undefined,
        expression: c.kind === 'wild4' || c.kind === 'draw2' || c.kind === 'skip' ? 'happy' : undefined,
      });
      if (c.kind === 'draw2' || c.kind === 'wild4' || c.kind === 'skip') {
        const victim = next.seats[next.turn]?.uid;
        if (victim && victim !== by && c.kind !== 'skip') out.push({ kind: 'victim', uid: victim, expression: 'surprised', ttl: 1600 });
      }
    }
  }
  for (const s of next.seats) {
    const before = handOf(prev, s.uid).length;
    const after = handOf(next, s.uid).length;
    if (after > before && next.round === prev.round && prev.phase === 'playing') {
      const ownTurn = prev.seats[prev.turn]?.uid === s.uid;
      const fresh = s.uid === viewer ? handOf(next, viewer).filter((id) => !handOf(prev, viewer).includes(id)) : [];
      out.push({
        kind: 'draw', uid: s.uid, data: { n: after - before, cards: fresh }, ttl: 1200,
        text: ownTurn ? undefined : 'Caught!', tone: ownTurn ? undefined : 'hot',
        expression: after - before >= 2 ? 'sad' : undefined,
      });
    }
    if (next.uno[s.uid] && !prev.uno[s.uid]) out.push({ kind: 'uno', uid: s.uid, text: 'UNO!', tone: 'hot', expression: 'happy', ttl: 1800 });
  }
  if (next.phase === 'results' && prev.phase === 'playing' && next.winner) {
    out.push({ kind: 'win', uid: next.winner, text: 'Out!', tone: 'gold', expression: 'happy', ttl: 3000 });
  }
  return out;
};

/** Where a seat sits round the oval, in % of the table: you at the bottom, play running clockwise. */
function seatAt(offset: number, n: number): { x: number; y: number } {
  const angle = Math.PI / 2 + (offset / n) * Math.PI * 2;
  return { x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
}

/**
 * UNO round a table: everyone's face in a seat round a felt oval, the deck and the pile in the
 * middle, your hand below. Shared by the room and the solo game.
 *
 * Reads only the viewer's own hand. For everyone else it reads `.length` and nothing more — the
 * rule that keeps a later move to per-player documents mechanical (see CLAUDE.md).
 */
export default function UnoTable({ state, uid, act, busy, error, owner }: TableProps) {
  const [wildCard, setWildCard] = useState<number | null>(null);
  const detect = useMemo(() => detector(uid), [uid]);
  const moments = useMoments(state, detect);
  const looks = assignSpecies(state.seats.map((s) => s.uid));
  const seated = state.seats.some((s) => s.uid === uid);
  const n = state.seats.length;
  const myIndex = Math.max(0, state.seats.findIndex((s) => s.uid === uid));
  const current = currentSeat(state);
  const myTurn = state.phase === 'playing' && current?.uid === uid;
  const hand = sortHand(handOf(state, uid));
  const playable = new Set(playableCards(state, uid));
  const top = state.discard.length ? topCard(state) : null;
  const seatPos = (u: string) => {
    const i = state.seats.findIndex((s) => s.uid === u);
    return seatAt((i - myIndex + n) % Math.max(n, 1), Math.max(n, 1));
  };
  const freshCards = new Set(moments.filter((m) => m.kind === 'draw' && m.uid === uid).flatMap((m) => (m.data?.cards as number[]) ?? []));
  const playMoment = [...moments].reverse().find((m) => m.kind === 'play');
  const seatSize = n > 6 ? 38 : n > 4 ? 44 : 50;
  // Scores only once somebody has one: "0 pts" under every face at the start is noise.
  const anyScore = state.seats.some((s) => s.score > 0);

  function play(card: number) {
    if (!myTurn || !playable.has(card) || busy) return;
    if (isWild(card)) { setWildCard(card); return; }
    act({ type: 'play', card });
  }

  const face = (u: string) => expressionFor(moments, u,
    state.phase === 'results' ? (u === state.winner ? 'happy' : 'sad')
      : u === current?.uid && isComputer(u) ? 'thinking' : 'idle');

  // The pile: the last few cards, each at its own tilt; the newest flies in from whoever played it.
  const pile = state.discard.slice(-4);
  const from = playMoment?.uid ? seatPos(playMoment.uid) : null;

  return (
    <div className="ut">
      <div className={`ut-table${n > 6 ? ' crowded' : ''}`}
        style={{ '--rim': state.phase === 'lobby' ? '#3b2f5c' : INK[state.activeColor] } as CSSProperties}>
        <div className="ut-felt" />
        {state.phase === 'playing' && (
          <svg className={`ut-direction${state.direction === -1 ? ' ccw' : ''}`} viewBox="0 0 100 100" aria-hidden>
            <ellipse cx="50" cy="50" rx="31" ry="27" />
            {[0, 90, 180, 270].map((a) => (
              <path key={a} d="M0 -3 L5 0 L0 3 Z" transform={`translate(${50 + 31 * Math.cos((a * Math.PI) / 180)} ${50 + 27 * Math.sin((a * Math.PI) / 180)}) rotate(${a + 90})`} />
            ))}
          </svg>
        )}

        {state.phase !== 'lobby' && top !== null && (
          <div className="ut-centre">
            <button type="button" className="ut-deck" aria-label="Draw a card"
              disabled={!myTurn || state.drawn !== null || busy || state.phase !== 'playing'} onClick={() => act({ type: 'draw' })}>
              <span className="ut-deck-stack" aria-hidden><UnoCard faceDown width={50} /><UnoCard faceDown width={50} /></span>
              <UnoCard faceDown width={50} />
              <span className="ut-deck-count">{state.deck.length}</span>
            </button>
            <div className="ut-pile" aria-label={`On the pile: ${cardOf(top).kind}`}>
              {pile.map((id, i) => {
                const newest = i === pile.length - 1;
                const flying = newest && from && playMoment?.data?.card === id;
                return (
                  <span key={id} className={`ut-pile-card${flying ? ' landing' : ''}`}
                    style={{
                      '--tilt': `${tilt(id)}deg`,
                      '--fx': from ? `${from.x - 50}cqw` : '0px',
                      '--fy': from ? `${from.y - 50}cqh` : '0px',
                      zIndex: i,
                    } as CSSProperties}>
                    <UnoCard id={id} width={58} />
                  </span>
                );
              })}
              {state.pendingDraw > 0 && <span className="ut-pending">+{state.pendingDraw}</span>}
            </div>
          </div>
        )}

        {state.phase === 'lobby' && (
          <div className="ut-centre ut-lobby-centre">
            <strong>{n} at the table</strong>
            {owner
              ? <button type="button" className="primary" disabled={busy || n < 2} onClick={() => act({ type: 'start', seed: newSeed() })}>
                  {n < 2 ? 'Waiting for a second player…' : 'Deal'}
                </button>
              : <span className="muted">Waiting for the host to deal…</span>}
          </div>
        )}

        {/* Cards flying from the deck to whoever drew them. */}
        {moments.filter((m) => m.kind === 'draw').map((m) => {
          const to = seatPos(m.uid!);
          const count = Math.min(4, (m.data?.n as number) ?? 1);
          return Array.from({ length: count }, (_, k) => (
            <span key={`${m.id}-${k}`} className="ut-flying"
              style={{ '--tx': `${to.x - 44}cqw`, '--ty': `${to.y - 50}cqh`, animationDelay: `${k * 90}ms` } as CSSProperties}>
              <UnoCard faceDown width={34} />
            </span>
          ));
        })}

        {state.seats.map((s, i) => {
          const pos = seatAt((i - myIndex + n) % n, n);
          const count = handOf(state, s.uid).length;
          const isMe = s.uid === uid;
          return (
            <div key={s.uid} className={`ut-seat${isMe ? ' me' : ''}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <Seat uid={s.uid} species={looks[s.uid]} name={isMe ? 'You' : firstName(s.name)} size={seatSize}
                expression={face(s.uid)} turn={state.phase === 'playing' && current?.uid === s.uid} away={s.absent}
                bubble={bubbleFor(moments, s.uid)}
                meta={state.phase === 'lobby' || !anyScore ? undefined : `${s.score} pts`}>
                {state.phase === 'playing' && !isMe && (
                  <span className="ut-backs" aria-label={`${count} cards`}>
                    {Array.from({ length: Math.min(count, 7) }, (_, k) => (
                      <span key={k} style={{ '--k': k - Math.min(count, 7) / 2 } as CSSProperties}><UnoCard faceDown width={16} /></span>
                    ))}
                    <b>{count}</b>
                  </span>
                )}
                {state.phase === 'playing' && state.uno[s.uid] && count <= 2 && <span className="uno-badge ut-uno">UNO</span>}
                {seated && !isMe && catchable(state, s.uid) && (
                  <button type="button" className="ut-catch" disabled={busy} onClick={() => act({ type: 'catch', uid: s.uid })}>Catch!</button>
                )}
              </Seat>
            </div>
          );
        })}
        {state.phase === 'results' && <Confetti />}
      </div>

      <p className="uno-last" role="status">{state.phase === 'lobby' ? 'Seven cards each. Match the colour or the face — first out wins the round.' : state.last}</p>
      {error && <p className="error row center">{error}</p>}

      {state.phase === 'playing' && (seated ? (
        <section className={`ut-me${myTurn ? ' turn' : ''}`}>
          <div className="ut-me-head">
            <span className="turn-pill">
              {myTurn
                ? (state.pendingDraw > 0 ? `Stack it, or draw ${state.pendingDraw}` : state.drawn !== null ? 'Play the card you drew, or pass' : 'Your turn')
                : `${firstName(current?.name ?? '')}'s turn`}
            </span>
            <span className="ut-color" style={{ color: INK[state.activeColor] }}>
              <i style={{ background: INK[state.activeColor] }} />{state.activeColor}
            </span>
          </div>
          <div className={`uno-hand${myTurn ? ' mine-to-play' : ''}`}>
            {hand.map((id, i) => (
              <button key={id} type="button" className={`${playable.has(id) ? 'playable' : ''}${freshCards.has(id) ? ' dealt' : ''}`}
                style={{ '--i': i } as CSSProperties}
                disabled={!myTurn || !playable.has(id) || busy} onClick={() => play(id)}>
                <UnoCard id={id} width={54} />
              </button>
            ))}
          </div>
          <div className="uno-actions">
            {myTurn && state.drawn === null && (
              <button type="button" disabled={busy} onClick={() => act({ type: 'draw' })}>
                {state.pendingDraw > 0 ? `Draw ${state.pendingDraw}` : 'Draw a card'}
              </button>
            )}
            {myTurn && state.drawn !== null && (
              <button type="button" disabled={busy} onClick={() => act({ type: 'pass' })}>Pass</button>
            )}
            {hand.length > 0 && hand.length <= 2 && !state.uno[uid] && (
              <button type="button" className="uno-call" disabled={busy} onClick={() => act({ type: 'callUno' })}>UNO!</button>
            )}
          </div>
        </section>
      ) : <p className="empty">You're watching this round. You'll be dealt in next round.</p>)}

      {state.phase === 'results' && <Results state={state} uid={uid} owner={owner} busy={busy} act={act} />}

      <Sheet open={wildCard !== null} title="Choose a colour" onClose={() => setWildCard(null)}>
        <div className="uno-colors">
          {COLORS.map((color: Color) => (
            <button key={color} type="button" style={{ background: INK[color] }} disabled={busy}
              onClick={() => {
                if (wildCard !== null) act({ type: 'play', card: wildCard, color });
                setWildCard(null);
              }}>
              {color}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Results({ state, uid, owner, busy, act }: Pick<TableProps, 'state' | 'uid' | 'owner' | 'busy' | 'act'>) {
  const champ = matchWinner(state);
  const roundWinner = state.seats.find((s) => s.uid === state.winner);
  return (
    <section className="ut-results">
      <h2 style={{ margin: 0 }}>{roundWinner?.uid === uid ? 'You win the round!' : `${firstName(roundWinner?.name ?? '')} wins the round`}</h2>
      {champ && <p style={{ margin: 0 }}><strong>{champ.uid === uid ? 'You have' : `${firstName(champ.name)} has`} reached {TARGET} — match won.</strong></p>}
      <ol className="ut-scores">
        {ranking(state).map((s) => (
          <li key={s.uid}>
            <span>{s.uid === uid ? 'You' : firstName(s.name)}</span>
            <strong className="tabular">{s.score}</strong>
          </li>
        ))}
      </ol>
      {owner
        ? <button type="button" className="primary" disabled={busy} onClick={() => act({ type: 'again', seed: newSeed() })}>
            <Icon name="undo" size={16} /> Deal the next round
          </button>
        : <p className="empty" style={{ margin: 0 }}>Waiting for the host to deal the next round…</p>}
    </section>
  );
}
