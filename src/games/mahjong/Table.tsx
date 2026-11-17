import { useEffect, useState } from 'react';
import Avatar from '../../ui/Avatar';
import Icon from '../../ui/Icon';
import MahjongTile from './Tile';
import type { Meld } from './hand';
import {
  SEATS, currentSeat, handOf, meldsOf, myClaimOptions, ranking, selfOptions, windOf,
  type Claim, type MahjongAction, type MahjongState, type Seat,
} from './rules';
import { sortTiles, tileName } from './tiles';
import { newSeed } from '../shuffle';
import { firstName } from '../../lib/format';
import './Mahjong.css';

export interface TableProps {
  state: MahjongState;
  uid: string;
  act: (action: MahjongAction) => unknown;
  busy: boolean;
  error: string;
  owner: boolean;
}

function Melds({ melds, size }: { melds: Meld[]; size: number }) {
  if (!melds.length) return null;
  return (
    <div className="mj-melds">
      {melds.map((m, i) => (
        <div key={i} className="mj-meld" title={m.kind}>
          {m.tiles.map((t, j) => (
            // A concealed kong shows its two middle tiles face up, as at a real table.
            <MahjongTile key={t} tile={t} width={size} faceDown={m.concealed && (j === 0 || j === 3)} />
          ))}
        </div>
      ))}
    </div>
  );
}

const WIND_LETTER: Record<string, string> = { East: 'E', South: 'S', West: 'W', North: 'N' };
function Wind({ state, seat }: { state: MahjongState; seat: number }) {
  const wind = windOf(state, seat);
  return <span className={`mj-wind${wind === 'East' ? ' east' : ''}`} title={`${wind} wind${wind === 'East' ? ' — dealer' : ''}`}>{WIND_LETTER[wind]}</span>;
}

const claimLabel = (c: Claim): string => (c.kind === 'win' ? 'Mahjong!' : c.kind[0].toUpperCase() + c.kind.slice(1));

/**
 * The table: the other three players' melds, discards and tile counts; any call you can make on
 * a discard; and your own hand. Shared by the room and the solo game.
 *
 * Reads only the viewer's own hand; for everyone else, `.length` and nothing more (CLAUDE.md).
 */
export default function MahjongTable({ state, uid, act, busy, error, owner }: TableProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const myIndex = state.seats.findIndex((s) => s.uid === uid);
  const current = currentSeat(state);
  const myTurn = state.phase === 'playing' && state.stage === 'discard' && current?.uid === uid;
  const hand = handOf(state, uid);
  // Forget the selection when the hand changes under it.
  useEffect(() => { if (selected !== null && !hand.includes(selected)) setSelected(null); }, [hand, selected]);

  if (state.phase === 'lobby') {
    return (
      <>
        <section className="card">
          <h3>At the table · {state.seats.length} of {SEATS}</h3>
          <div className="player-grid">
            {state.seats.map((s) => (
              <div key={s.uid} className="player-chip">
                <Avatar name={s.name} photoURL={s.photoURL} size={32} />
                <span className="grow truncate">{s.uid === uid ? 'You' : firstName(s.name)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9rem' }}>
            Four sets and a pair wins — or seven pairs, or thirteen orphans. Chow from the player
            before you; pong, kong or win on anyone's discard.
          </p>
        </section>
        {owner
          ? <button type="button" className="primary block" disabled={busy || state.seats.length !== SEATS}
              onClick={() => act({ type: 'start', seed: newSeed() })}>
              {state.seats.length === SEATS ? 'Deal' : `Waiting for ${SEATS - state.seats.length} more…`}
            </button>
          : <p className="empty">Waiting for the host to deal…</p>}
        {error && <p className="error">{error}</p>}
      </>
    );
  }

  if (state.phase === 'results') return <Results state={state} uid={uid} act={act} busy={busy} owner={owner} error={error} />;

  const others: { seat: Seat; index: number }[] = [1, 2, 3].map((d) => {
    const index = (Math.max(myIndex, 0) + d) % SEATS;
    return { seat: state.seats[index], index };
  });
  const claimOptions = myClaimOptions(state, uid);
  const own = selfOptions(state, uid);
  const latestDiscard = state.stage === 'claims' ? state.claim?.tile : undefined;
  // Your newest tile sits apart from the rest when you have just drawn it.
  const newest = myTurn && state.justDrew ? hand[hand.length - 1] : undefined;
  const shown = sortTiles(newest === undefined ? hand : hand.slice(0, -1));

  function tapTile(t: number) {
    if (!myTurn || busy) return;
    if (selected === t) { act({ type: 'discard', tile: t }); setSelected(null); return; }
    setSelected(t);
  }

  return (
    <>
      <div className="mj-status">
        <span className="turn-pill">
          {myTurn ? 'Your turn — discard a tile'
            : claimOptions.length ? 'Call it, or pass'
            : state.stage === 'claims' ? 'Waiting for calls…'
            : `${firstName(current?.name ?? '')}'s turn`}
        </span>
        <span className="muted">Hand {state.handNumber + 1} · {state.wall.length} tiles in the wall</span>
      </div>

      <div className="mj-opponents">
        {others.map(({ seat, index }) => {
          const thinking = state.stage === 'claims' && state.claim?.responses[seat.uid] === null;
          const discards = state.discards[seat.uid] ?? [];
          return (
            <div key={seat.uid} className={`mj-opp${current?.uid === seat.uid && state.stage === 'discard' ? ' turn' : ''}${thinking ? ' thinking' : ''}${seat.absent ? ' absent' : ''}`}>
              <div className="mj-opp-head">
                <Wind state={state} seat={index} />
                <Avatar name={seat.name} photoURL={seat.photoURL} size={28} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <strong className="truncate" style={{ display: 'block', fontSize: '0.9rem' }}>{firstName(seat.name)}</strong>
                  <small>{handOf(state, seat.uid).length} in hand · {seat.score} pts{seat.absent ? ' · away' : thinking ? ' · thinking…' : ''}</small>
                </span>
              </div>
              <Melds melds={meldsOf(state, seat.uid)} size={20} />
              {discards.length > 0 && (
                <div className="mj-row mj-discards">
                  {discards.map((t) => <MahjongTile key={t} tile={t} width={20} className={t === latestDiscard ? 'latest' : ''} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mj-last" role="status">{state.last}</p>
      {error && <p className="error row center">{error}</p>}

      {owner && current?.absent && state.stage === 'discard' && (
        <div className="row center" style={{ marginBottom: 10 }}>
          <button type="button" disabled={busy} onClick={() => act({ type: 'cover' })}>
            Play {firstName(current.name)}'s turn (they left)
          </button>
        </div>
      )}

      {claimOptions.length > 0 && state.claim && (
        <div className="mj-claim">
          <div className="mj-claim-head">
            <MahjongTile tile={state.claim.tile} width={34} />
            <span>{firstName(state.seats.find((s) => s.uid === state.claim!.by)?.name ?? '')} discarded <strong>{tileName(state.claim.tile)}</strong>.</span>
          </div>
          <div className="mj-claim-options">
            {claimOptions.map((c, i) => (
              <button key={i} type="button" className={c.kind === 'win' ? 'mj-win' : 'primary'} disabled={busy}
                onClick={() => act({ type: 'claim', claim: c })}>
                {claimLabel(c)}
                {c.kind === 'chow' && (
                  <span className="mj-row">
                    {sortTiles([...c.tiles, state.claim!.tile]).map((t) => <MahjongTile key={t} tile={t} width={16} />)}
                  </span>
                )}
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => act({ type: 'pass' })}>Pass</button>
          </div>
        </div>
      )}

      {myIndex >= 0 ? (
        <section className={`mj-me${myTurn ? ' turn' : ''}`}>
          <div className="mj-opp-head">
            <Wind state={state} seat={myIndex} />
            <strong className="grow">You · {state.seats[myIndex].score} pts</strong>
          </div>
          <div style={{ marginTop: 8 }}><Melds melds={meldsOf(state, uid)} size={26} /></div>
          {(state.discards[uid] ?? []).length > 0 && (
            <div className="mj-row mj-discards" style={{ marginTop: 8 }}>
              {(state.discards[uid] ?? []).map((t) => <MahjongTile key={t} tile={t} width={20} className={t === latestDiscard ? 'latest' : ''} />)}
            </div>
          )}
          <div className="mj-hand">
            {shown.map((t) => (
              <button key={t} type="button" className={t === selected ? 'selected' : ''} disabled={!myTurn || busy}
                onClick={() => tapTile(t)} aria-label={`${tileName(t)}${myTurn ? ' — tap twice to discard' : ''}`}>
                <MahjongTile tile={t} width={34} />
              </button>
            ))}
            {newest !== undefined && (
              <button type="button" className={`mj-drawn${newest === selected ? ' selected' : ''}`} disabled={busy}
                onClick={() => tapTile(newest)} aria-label={`${tileName(newest)}, just drawn`}>
                <MahjongTile tile={newest} width={34} />
              </button>
            )}
          </div>
          {myTurn && (
            <div className="mj-actions">
              {own.win && <button type="button" className="mj-win" disabled={busy} onClick={() => act({ type: 'declareWin' })}>Mahjong!</button>}
              {own.kongs.map((t) => (
                <button key={t} type="button" disabled={busy} onClick={() => act({ type: 'declareKong', tile: t })}>
                  Kong <MahjongTile tile={t} width={16} />
                </button>
              ))}
              <button type="button" className="primary" disabled={busy || selected === null}
                onClick={() => { if (selected !== null) { act({ type: 'discard', tile: selected }); setSelected(null); } }}>
                {selected === null ? 'Tap a tile to discard' : `Discard ${tileName(selected)}`}
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="empty">You're watching this hand.</p>
      )}
    </>
  );
}

function Results({ state, uid, act, busy, owner, error }: TableProps) {
  const r = state.result;
  const winner = r?.winner ? state.seats.find((s) => s.uid === r.winner) : undefined;
  const from = r?.from ? state.seats.find((s) => s.uid === r.from) : undefined;
  return (
    <>
      <div className="col" style={{ alignItems: 'center', gap: 4, margin: '6px 0 14px', textAlign: 'center' }}>
        <span className="trophy-mark" aria-hidden><Icon name="trophy" size={40} /></span>
        <h2 style={{ margin: 0 }}>
          {!winner ? 'A drawn hand' : winner.uid === uid ? 'Mahjong — you win!' : `${firstName(winner.name)} wins`}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {!winner ? 'The wall ran out before anyone went out.'
            : r!.selfDraw ? 'Self-drawn.' : `On ${from?.uid === uid ? 'your' : `${firstName(from?.name ?? '')}'s`} discard.`}
        </p>
      </div>

      {winner && r && (
        <section className="card">
          <h3>The winning hand</h3>
          <div className="mj-row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            {sortTiles(r.hand).map((t) => <MahjongTile key={t} tile={t} width={30} />)}
          </div>
          <div className="row center"><Melds melds={r.melds} size={26} /></div>
          <ul className="mj-fan" style={{ marginTop: 12 }}>
            {r.lines.map((l, i) => <li key={i}><span>{l.label}</span><span>{l.fan} fan</span></li>)}
            <li><span>Total{r.fan === 8 ? ' (limit)' : ''}</span><span>{r.fan} fan · {2 ** r.fan} points</span></li>
          </ul>
        </section>
      )}

      {ranking(state).map((s, i) => {
        const change = r?.payments[s.uid];
        return (
          <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
            <span className="rank-medal" aria-hidden>{i === 0 ? <Icon name="trophy" size={22} /> : i + 1}</span>
            <Avatar name={s.name} photoURL={s.photoURL} size={30} />
            <span className="grow truncate"><strong>{s.uid === uid ? 'You' : firstName(s.name)}</strong></span>
            {change !== undefined && <span className={change > 0 ? 'success' : 'muted'}>{change > 0 ? '+' : ''}{change}</span>}
            <strong className="tabular" style={{ minWidth: 48, textAlign: 'right' }}>{s.score}</strong>
          </div>
        );
      })}
      {owner
        ? <button type="button" className="primary block" disabled={busy} onClick={() => act({ type: 'again', seed: newSeed() })}>Deal the next hand</button>
        : <p className="empty">Waiting for the host to deal the next hand…</p>}
      {error && <p className="error">{error}</p>}
    </>
  );
}
