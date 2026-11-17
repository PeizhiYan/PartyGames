import { useEffect, useMemo, useState } from 'react';
import Icon from '../../ui/Icon';
import Seat from '../cast/Seat';
import Character from '../cast/Character';
import Confetti from '../cast/Confetti';
import { assignSpecies } from '../cast/cast';
import { bubbleFor, expressionFor, useMoments, type Detect, type Moment } from '../cast/moments';
import { isComputer } from '../local';
import MahjongTile from './Tile';
import type { Meld } from './hand';
import {
  SEATS, currentSeat, handOf, meldsOf, myClaimOptions, ranking, selfOptions, windOf,
  type Claim, type MahjongAction, type MahjongState,
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

type Side = 'bottom' | 'right' | 'top' | 'left';
/** Where each seat sits, relative to you: the next player on your right, as at a real table. */
const SIDES: Side[] = ['bottom', 'right', 'top', 'left'];

const CALL_TEXT: Record<string, string> = { pong: '碰 Pong!', chow: '吃 Chow!', kong: '槓 Kong!' };

/** What just happened: calls, discards, draws and wins, for bubbles, faces and the newest tiles. */
const detector = (viewer: string): Detect<MahjongState> => (prev, next) => {
  const out: Omit<Moment, 'id'>[] = [];
  if (prev.phase !== 'playing' || next.handNumber !== prev.handNumber) return out;
  for (const s of next.seats) {
    const before = meldsOf(prev, s.uid);
    const after = meldsOf(next, s.uid);
    const grew = after.length > before.length ? after[after.length - 1]
      : after.find((m, i) => m.kind === 'kong' && before[i]?.kind === 'pong');
    if (grew) out.push({ kind: 'call', uid: s.uid, text: CALL_TEXT[grew.kind], tone: 'hot', expression: 'happy', ttl: 1800 });
    const discards = next.discards[s.uid] ?? [];
    if (discards.length > (prev.discards[s.uid] ?? []).length) {
      out.push({ kind: 'discard', uid: s.uid, data: { tile: discards[discards.length - 1] }, ttl: 900 });
    }
  }
  // A tile arriving in your own rack.
  const mine = handOf(next, viewer).filter((t) => !handOf(prev, viewer).includes(t));
  if (mine.length) out.push({ kind: 'drawn', uid: viewer, data: { tiles: mine }, ttl: 900 });
  if (next.phase === 'results' && next.result) {
    const r = next.result;
    if (r.winner) {
      out.push({ kind: 'win', uid: r.winner, text: '胡 Mahjong!', tone: 'gold', expression: 'happy', ttl: 3200 });
      if (r.from) out.push({ kind: 'lose', uid: r.from, expression: 'sad', ttl: 3200 });
    }
  }
  return out;
};

function Melds({ melds, className }: { melds: Meld[]; className?: string }) {
  if (!melds.length) return null;
  return (
    <div className={`mt-melds${className ? ` ${className}` : ''}`}>
      {melds.map((m, i) => (
        <div key={i} className="mt-meld" title={m.kind}>
          {m.tiles.map((t, j) => <MahjongTile key={t} tile={t} faceDown={m.concealed && (j === 0 || j === 3)} />)}
        </div>
      ))}
    </div>
  );
}

const claimLabel = (c: Claim): string => (c.kind === 'win' ? '胡 Mahjong!' : CALL_TEXT[c.kind].replace('!', ''));

/**
 * Mahjong round a square table: the three other players on its sides, everyone's discards laid out
 * in front of them, a compass in the middle lighting up whose turn it is, and your own tiles in a
 * rack below. Shared by the room and the solo game.
 *
 * Reads only the viewer's own hand; for everyone else, `.length` and nothing more (CLAUDE.md).
 */
export default function MahjongTable({ state, uid, act, busy, error, owner }: TableProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const detect = useMemo(() => detector(uid), [uid]);
  const moments = useMoments(state, detect);
  const looks = assignSpecies(state.seats.map((s) => s.uid));
  const myIndex = Math.max(0, state.seats.findIndex((s) => s.uid === uid));
  const seated = state.seats.some((s) => s.uid === uid);
  const current = currentSeat(state);
  const myTurn = state.phase === 'playing' && state.stage === 'discard' && current?.uid === uid;
  const hand = handOf(state, uid);
  useEffect(() => { if (selected !== null && !hand.includes(selected)) setSelected(null); }, [hand, selected]);

  /** Which seat index sits on which side, from where you sit. */
  const at = (side: Side) => (myIndex + SIDES.indexOf(side)) % SEATS;
  const freshDiscards = new Set(moments.filter((m) => m.kind === 'discard').map((m) => m.data?.tile as number));
  const freshInRack = new Set(moments.filter((m) => m.kind === 'drawn').flatMap((m) => (m.data?.tiles as number[]) ?? []));
  const latestDiscard = state.stage === 'claims' ? state.claim?.tile : undefined;
  const winner = state.result?.winner ?? null;

  const face = (u: string) => expressionFor(moments, u,
    state.phase === 'results' ? (u === winner ? 'happy' : winner ? 'idle' : 'sad')
      : (state.stage === 'claims' && state.claim?.responses[u] === null && isComputer(u)) || (u === current?.uid && state.stage === 'discard' && isComputer(u))
        ? 'thinking' : 'idle');

  function sideOf(side: Side) {
    const i = at(side);
    const seat = state.seats[i];
    if (!seat) {
      return (
        <div className={`mt-side mt-${side}`}>
          <div className="mt-empty-seat"><Icon name="users" size={18} /><span>Empty seat</span></div>
        </div>
      );
    }
    const isMe = seat.uid === uid;
    const thinking = state.stage === 'claims' && state.claim?.responses[seat.uid] === null;
    const count = handOf(state, seat.uid).length;
    return (
      <div className={`mt-side mt-${side}`}>
        <Seat uid={seat.uid} species={looks[seat.uid]} name={isMe ? 'You' : firstName(seat.name)}
          size={side === 'bottom' ? 40 : 44} expression={face(seat.uid)} away={seat.absent}
          turn={state.phase === 'playing' && ((state.stage === 'discard' && current?.uid === seat.uid) || thinking)}
          bubble={bubbleFor(moments, seat.uid)}
          meta={<><b className={`mt-wind${windOf(state, i) === 'East' ? ' east' : ''}`}>{windOf(state, i)[0]}</b> {seat.score} pts</>} />
        {state.phase !== 'lobby' && !isMe && (
          <div className="mt-backs" aria-label={`${count} tiles`}>
            {Array.from({ length: count }, (_, k) => <MahjongTile key={k} faceDown />)}
          </div>
        )}
        {state.phase !== 'lobby' && <Melds melds={meldsOf(state, seat.uid)} />}
      </div>
    );
  }

  function pond(side: Side) {
    const seat = state.seats[at(side)];
    const tiles = seat ? state.discards[seat.uid] ?? [] : [];
    return (
      <div className={`mt-pond mt-pond-${side}`}>
        {tiles.map((t) => (
          <MahjongTile key={t} tile={t} className={`${freshDiscards.has(t) ? 'drop' : ''}${t === latestDiscard ? ' latest' : ''}`} />
        ))}
      </div>
    );
  }

  const turnSide = current ? SIDES[(state.seats.indexOf(current) - myIndex + SEATS) % SEATS] : null;
  const claimOptions = myClaimOptions(state, uid);
  const own = selfOptions(state, uid);
  const newest = myTurn && state.justDrew ? hand[hand.length - 1] : undefined;
  const shown = sortTiles(newest === undefined ? hand : hand.slice(0, -1));

  function tapTile(t: number) {
    if (!myTurn || busy) return;
    if (selected === t) { act({ type: 'discard', tile: t }); setSelected(null); return; }
    setSelected(t);
  }

  return (
    <div className="mt-wrap">
      <div className="mt">
        {sideOf('top')}
        {sideOf('left')}
        <div className="mt-middle">
          {pond('top')}
          {pond('left')}
          <div className="mt-compass">
            {SIDES.map((side) => (
              <span key={side} className={`mt-arrow mt-arrow-${side}${state.phase === 'playing' && side === turnSide && state.stage === 'discard' ? ' on' : ''}`} />
            ))}
            <div className="mt-compass-face">
              {state.phase === 'lobby'
                ? <><strong>{state.seats.length}/{SEATS}</strong><small>seated</small></>
                : <><strong>{state.wall.length}</strong><small>in the wall</small><small className="mt-hand-no">Hand {state.handNumber + 1}</small></>}
            </div>
          </div>
          {pond('right')}
          {pond('bottom')}
        </div>
        {sideOf('right')}
        {sideOf('bottom')}
        {state.phase === 'results' && winner && <Confetti />}
      </div>

      <p className="mj-last" role="status">
        {state.phase === 'lobby' ? 'Four sets and a pair wins. Chow from the player on your left; pong, kong or win on anyone.' : state.last}
      </p>
      {error && <p className="error row center">{error}</p>}

      {state.phase === 'lobby' && (
        <div className="row center" style={{ marginBottom: 12 }}>
          {owner
            ? <button type="button" className="primary" disabled={busy || state.seats.length !== SEATS} onClick={() => act({ type: 'start', seed: newSeed() })}>
                {state.seats.length === SEATS ? 'Deal' : `Waiting for ${SEATS - state.seats.length} more…`}
              </button>
            : <span className="empty">Waiting for the host to deal…</span>}
        </div>
      )}

      {owner && current?.absent && state.phase === 'playing' && state.stage === 'discard' && (
        <div className="row center" style={{ marginBottom: 10 }}>
          <button type="button" disabled={busy} onClick={() => act({ type: 'cover' })}>
            Play {firstName(current.name)}'s turn (they left)
          </button>
        </div>
      )}

      {claimOptions.length > 0 && state.claim && (
        <div className="mj-claim">
          <div className="mj-claim-head">
            <MahjongTile tile={state.claim.tile} width={36} />
            <span>{firstName(state.seats.find((s) => s.uid === state.claim!.by)?.name ?? '')} discarded <strong>{tileName(state.claim.tile)}</strong>. Call it?</span>
          </div>
          <div className="mj-claim-options">
            {claimOptions.map((c, i) => (
              <button key={i} type="button" className={c.kind === 'win' ? 'mj-win' : 'primary'} disabled={busy}
                onClick={() => act({ type: 'claim', claim: c })}>
                {claimLabel(c)}
                {c.kind === 'chow' && (
                  <span className="mj-row">{sortTiles([...c.tiles, state.claim!.tile]).map((t) => <MahjongTile key={t} tile={t} width={16} />)}</span>
                )}
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => act({ type: 'pass' })}>Pass</button>
          </div>
        </div>
      )}

      {state.phase === 'playing' && seated && (
        <section className={`mt-rack${myTurn ? ' turn' : ''}`}>
          <div className="mt-rack-head">
            <span className="turn-pill">
              {myTurn ? (selected === null ? 'Your turn — tap a tile to discard' : 'Tap it again to discard')
                : claimOptions.length ? 'Call it, or pass'
                : state.stage === 'claims' ? 'Waiting for calls…'
                : `${firstName(current?.name ?? '')}'s turn`}
            </span>
          </div>
          <div className="mj-hand">
            {shown.map((t) => (
              <button key={t} type="button" className={`${t === selected ? 'selected' : ''}${freshInRack.has(t) ? ' fresh' : ''}`}
                disabled={!myTurn || busy} onClick={() => tapTile(t)} aria-label={`${tileName(t)}${myTurn ? ' — tap twice to discard' : ''}`}>
                <MahjongTile tile={t} width={36} />
              </button>
            ))}
            {newest !== undefined && (
              <button type="button" className={`mj-drawn fresh${newest === selected ? ' selected' : ''}`} disabled={busy}
                onClick={() => tapTile(newest)} aria-label={`${tileName(newest)}, just drawn`}>
                <MahjongTile tile={newest} width={36} />
              </button>
            )}
          </div>
          {myTurn && (own.win || own.kongs.length > 0 || selected !== null) && (
            <div className="mj-actions">
              {own.win && <button type="button" className="mj-win" disabled={busy} onClick={() => act({ type: 'declareWin' })}>胡 Mahjong!</button>}
              {own.kongs.map((t) => (
                <button key={t} type="button" disabled={busy} onClick={() => act({ type: 'declareKong', tile: t })}>
                  槓 Kong <MahjongTile tile={t} width={16} />
                </button>
              ))}
              {selected !== null && (
                <button type="button" className="primary" disabled={busy} onClick={() => { act({ type: 'discard', tile: selected }); setSelected(null); }}>
                  Discard {tileName(selected)}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {state.phase === 'results' && <Results state={state} uid={uid} act={act} busy={busy} owner={owner} species={looks} />}
    </div>
  );
}

function Results({ state, uid, act, busy, owner, species }: Pick<TableProps, 'state' | 'uid' | 'act' | 'busy' | 'owner'> & { species: ReturnType<typeof assignSpecies> }) {
  const r = state.result;
  const winner = r?.winner ? state.seats.find((s) => s.uid === r.winner) : undefined;
  const from = r?.from ? state.seats.find((s) => s.uid === r.from) : undefined;
  return (
    <section className="mt-results">
      <div className="col" style={{ alignItems: 'center', gap: 4, textAlign: 'center' }}>
        {winner && <Character uid={winner.uid} species={species[winner.uid]} size={64} expression="happy" />}
        <h2 style={{ margin: 0 }}>{!winner ? 'A drawn hand' : winner.uid === uid ? '胡 Mahjong — you win!' : `${firstName(winner.name)} wins`}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {!winner ? 'The wall ran out before anyone went out.'
            : r!.selfDraw ? 'Self-drawn.' : `On ${from?.uid === uid ? 'your' : `${firstName(from?.name ?? '')}'s`} discard.`}
        </p>
      </div>
      {winner && r && (
        <>
          <div className="mj-row" style={{ justifyContent: 'center' }}>
            {sortTiles(r.hand).map((t) => <MahjongTile key={t} tile={t} width={30} />)}
          </div>
          {r.melds.length > 0 && (
            <div className="row center" style={{ gap: 8, flexWrap: 'wrap' }}>
              {r.melds.map((m, i) => <span key={i} className="mj-meld">{m.tiles.map((t) => <MahjongTile key={t} tile={t} width={24} />)}</span>)}
            </div>
          )}
          <ul className="mj-fan">
            {r.lines.map((l, i) => <li key={i}><span>{l.label}</span><span>{l.fan} fan</span></li>)}
            <li><span>Total{r.fan === 8 ? ' (limit)' : ''}</span><span>{r.fan} fan · {2 ** r.fan} points</span></li>
          </ul>
        </>
      )}
      <ol className="mt-scores">
        {ranking(state).map((s) => {
          const change = r?.payments[s.uid];
          return (
            <li key={s.uid}>
              <span>{s.uid === uid ? 'You' : firstName(s.name)}</span>
              {change !== undefined && <span className={change > 0 ? 'success' : 'muted'}>{change > 0 ? '+' : ''}{change}</span>}
              <strong className="tabular">{s.score}</strong>
            </li>
          );
        })}
      </ol>
      {owner
        ? <button type="button" className="primary" disabled={busy} onClick={() => act({ type: 'again', seed: newSeed() })}>Deal the next hand</button>
        : <p className="empty" style={{ margin: 0 }}>Waiting for the host to deal the next hand…</p>}
    </section>
  );
}

