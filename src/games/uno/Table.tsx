import { useState } from 'react';
import Avatar from '../../ui/Avatar';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
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

/**
 * The table: everyone else's card counts, the deck and the pile, and your own hand. Shared by
 * the room and the solo game.
 *
 * Reads only the viewer's own hand. For everyone else it reads `.length` and nothing more — that
 * is the rule that keeps a later move to per-player documents mechanical (see CLAUDE.md).
 */
export default function UnoTable({ state, uid, act, busy, error, owner }: TableProps) {
  const [wildCard, setWildCard] = useState<number | null>(null);
  const seated = state.seats.some((s) => s.uid === uid);

  if (state.phase === 'lobby') {
    return (
      <>
        <section className="card">
          <h3>Who's playing</h3>
          <div className="player-grid">
            {state.seats.map((s) => (
              <div key={s.uid} className="player-chip">
                <Avatar name={s.name} photoURL={s.photoURL} size={32} />
                <span className="grow truncate">{s.uid === uid ? 'You' : firstName(s.name)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9rem' }}>
            Seven cards each. Match the colour or the face; first out of cards wins the round and scores
            what everyone else is holding. First to {TARGET} takes the match.
          </p>
        </section>
        {owner
          ? <button type="button" className="primary block" disabled={busy || state.seats.length < 2}
              onClick={() => act({ type: 'start', seed: newSeed() })}>
              {state.seats.length < 2 ? 'Waiting for a second player…' : 'Deal'}
            </button>
          : <p className="empty">Waiting for the host to deal…</p>}
        {error && <p className="error">{error}</p>}
      </>
    );
  }

  const myIndex = state.seats.findIndex((s) => s.uid === uid);
  // Everyone else, in turn order starting after you.
  const others = state.seats.map((_, i) => state.seats[(Math.max(myIndex, 0) + 1 + i) % state.seats.length])
    .filter((s) => s.uid !== uid);
  const current = currentSeat(state);
  const myTurn = state.phase === 'playing' && current?.uid === uid;
  const hand = sortHand(handOf(state, uid));
  const playable = new Set(playableCards(state, uid));
  const top = topCard(state);

  function play(card: number) {
    if (!myTurn || !playable.has(card) || busy) return;
    if (isWild(card)) { setWildCard(card); return; }
    act({ type: 'play', card });
  }

  if (state.phase === 'results') {
    const champ = matchWinner(state);
    const roundWinner = state.seats.find((s) => s.uid === state.winner);
    return (
      <>
        <div className="col" style={{ alignItems: 'center', gap: 4, margin: '6px 0 16px' }}>
          <span className="trophy-mark" aria-hidden><Icon name="trophy" size={40} /></span>
          <h2 style={{ margin: 0 }}>{roundWinner?.uid === uid ? 'You win the round!' : `${firstName(roundWinner?.name ?? '')} wins the round`}</h2>
          <p className="muted" style={{ margin: 0 }}>{state.last}</p>
          {champ && <p style={{ margin: 0 }}><strong>{champ.uid === uid ? 'You have' : `${firstName(champ.name)} has`} reached {TARGET} — match won.</strong></p>}
        </div>
        {ranking(state).map((s, i) => (
          <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
            <span className="rank-medal" aria-hidden>{i === 0 ? <Icon name="trophy" size={22} /> : i + 1}</span>
            <Avatar name={s.name} photoURL={s.photoURL} size={30} />
            <span className="grow truncate"><strong>{s.uid === uid ? 'You' : firstName(s.name)}</strong></span>
            <strong className="tabular">{s.score}</strong>
          </div>
        ))}
        {owner
          ? <button type="button" className="primary block" disabled={busy} onClick={() => act({ type: 'again', seed: newSeed() })}>Deal the next round</button>
          : <p className="empty">Waiting for the host to deal the next round…</p>}
        {error && <p className="error">{error}</p>}
      </>
    );
  }

  return (
    <>
      <div className="uno-opponents">
        {others.map((s) => {
          const count = handOf(state, s.uid).length;
          return (
            <div key={s.uid} className={`uno-opp${current?.uid === s.uid ? ' turn' : ''}${s.absent ? ' absent' : ''}`}>
              <Avatar name={s.name} photoURL={s.photoURL} size={30} />
              <span className="grow" style={{ minWidth: 0 }}>
                <strong className="truncate" style={{ display: 'block', fontSize: '0.9rem' }}>{firstName(s.name)}</strong>
                <small>
                  <span className="uno-count">{count} card{count === 1 ? '' : 's'}</span>
                  {s.absent ? ' · away' : ` · ${s.score} pts`}
                </small>
              </span>
              {state.uno[s.uid] && count <= 2 && <span className="uno-badge">UNO</span>}
              {seated && catchable(state, s.uid) && (
                <button type="button" className="small" disabled={busy} onClick={() => act({ type: 'catch', uid: s.uid })}>Catch</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="row center" style={{ marginBottom: 8 }}>
        <span className="turn-pill">
          {myTurn
            ? (state.pendingDraw > 0 ? `Your turn · stack it or draw ${state.pendingDraw}` : state.drawn !== null ? 'Play the card you drew, or pass' : 'Your turn')
            : `${firstName(current?.name ?? '')}'s turn`}
        </span>
      </div>

      <div className="uno-centre">
        <button type="button" className="uno-deck" aria-label="Draw a card"
          disabled={!myTurn || state.drawn !== null || busy} onClick={() => act({ type: 'draw' })}>
          <UnoCard faceDown width={64} />
          <span className="uno-deck-count">{state.deck.length} left</span>
        </button>
        <div>
          <div className="uno-pile" style={{ boxShadow: `0 0 0 4px ${INK[state.activeColor]}` }}>
            <UnoCard id={top} width={76} />
            {state.pendingDraw > 0 && <span className="uno-pending">+{state.pendingDraw}</span>}
          </div>
          <div className="uno-pile-label">
            <span style={{ color: INK[state.activeColor] }}>{state.activeColor}</span>
            <span className="muted"> · {state.direction === 1 ? 'clockwise' : 'anticlockwise'}</span>
          </div>
        </div>
      </div>

      <p className="uno-last" role="status">{state.last}</p>
      {error && <p className="error row center">{error}</p>}

      {seated ? (
        <>
          <div className={`uno-hand${myTurn ? ' mine-to-play' : ''}`}>
            {hand.map((id) => (
              <button key={id} type="button" className={playable.has(id) ? 'playable' : ''}
                disabled={!myTurn || !playable.has(id) || busy} onClick={() => play(id)}>
                <UnoCard id={id} width={52} />
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
            {hand.length <= 2 && state.uno[uid] && <span className="uno-badge" style={{ alignSelf: 'center' }}>UNO called</span>}
          </div>
        </>
      ) : (
        <p className="empty">You're watching this round. You'll be dealt in next round.</p>
      )}

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
    </>
  );
}
