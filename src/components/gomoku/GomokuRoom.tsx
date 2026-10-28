import { useEffect, useRef, useState, type CSSProperties } from 'react';
import GomokuBoard from './GomokuBoard';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import type { Player } from '../../domain/gomoku/board';
import { bothSeated, seatOf, type GomokuState } from '../../domain/gomoku/game';
import type { Room } from '../../domain/types';
import { useGameAction } from '../../hooks/useRooms';
import { firstName } from '../../lib/format';

/**
 * How long a stone sits on the board, visible only to the person who played it, before it is sent
 * to the other player. Long enough to catch a mis-tap, short enough not to feel like a wait.
 */
const UNDO_WINDOW_MS = 3000;

/** Gomoku against another person, in a room. */
export default function GomokuRoom({ room, uid }: { room: Room; uid: string }) {
  const state = room.state as GomokuState;
  const { act, error, busy } = useGameAction(room.id);
  const mySeat = seatOf(state, uid);
  const ready = bothSeated(state);
  const myTurn = state.outcome === 0 && mySeat !== null && mySeat === state.turn;

  /** A move that has been made but not sent. Nobody else can see it yet. */
  const [pending, setPending] = useState<{ cell: number; player: Player } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const sendTimer = useRef<number>();
  const tick = useRef<number>();

  const cancel = () => {
    window.clearTimeout(sendTimer.current);
    window.clearInterval(tick.current);
    setPending(null);
  };

  /** Puts the stone down locally and starts the clock on sending it. */
  function play(cell: number) {
    if (!mySeat) return;
    cancel();
    setPending({ cell, player: mySeat });
    setSecondsLeft(Math.round(UNDO_WINDOW_MS / 1000));
    tick.current = window.setInterval(() => setSecondsLeft((n) => Math.max(0, n - 1)), 1000);
    sendTimer.current = window.setTimeout(() => {
      window.clearInterval(tick.current);
      setPending(null);
      act({ type: 'place', cell });
    }, UNDO_WINDOW_MS);
  }

  // Drop an unsent move if the game ends under it — the opponent resigning, say — and make sure
  // no timer outlives the screen.
  useEffect(() => { if (state.outcome !== 0) cancel(); }, [state.outcome]);
  useEffect(() => cancel, []);

  const player = (seat: Player) => {
    const seatUid = seat === 1 ? state.black : state.white;
    return room.players.find((p) => p.uid === seatUid);
  };

  const outcomeText = () => {
    if (state.outcome === 3) return "It's a draw — the board is full.";
    if (state.outcome === 0) return null;
    const winner = player(state.outcome as Player);
    if (state.outcome === mySeat) return 'You win! 🎉';
    return `${winner ? firstName(winner.name) : 'Your opponent'} wins.`;
  };

  const waitingFor = state.rematch.length > 0
    && [state.black, state.white].filter(Boolean).some((u) => u && !state.rematch.includes(u));

  return (
    <>
      <div className="score-strip">
        {([1, 2] as Player[]).map((seat) => {
          const p = player(seat);
          const isTurn = state.outcome === 0 && state.turn === seat && ready;
          return (
            <div key={seat} className={`score-side${isTurn ? ' turn' : ''}`}>
              <span className={`stone-dot ${seat === 1 ? 'black' : 'white'}`} aria-hidden />
              {p ? <Avatar name={p.name} photoURL={p.photoURL} size={26} /> : null}
              <span className="col grow" style={{ gap: 0, minWidth: 0 }}>
                <strong className="truncate" style={{ fontSize: '0.92rem' }}>
                  {p ? (p.uid === uid ? 'You' : firstName(p.name)) : 'Waiting…'}
                </strong>
                <small className="muted">{state.wins[p?.uid ?? ''] ?? 0} won</small>
              </span>
            </div>
          );
        })}
      </div>

      <div className="row center" style={{ marginBottom: 10 }}>
        <span className="turn-pill">
          {state.outcome !== 0 ? (
            <>{outcomeText()}</>
          ) : !ready ? (
            <>Waiting for a second player…</>
          ) : pending ? (
            <><span className={`stone-dot ${mySeat === 1 ? 'black' : 'white'}`} aria-hidden /> Move not sent yet</>
          ) : myTurn ? (
            <><span className={`stone-dot ${mySeat === 1 ? 'black' : 'white'}`} aria-hidden /> Your turn</>
          ) : (
            <><span className={`stone-dot ${state.turn === 1 ? 'black' : 'white'}`} aria-hidden />
              {firstName(player(state.turn)?.name ?? 'Opponent')}'s turn</>
          )}
        </span>
      </div>

      <GomokuBoard
        board={state.board}
        placing={myTurn && !busy && !pending ? mySeat : null}
        lastMove={state.moves.length ? state.moves[state.moves.length - 1] : null}
        winLine={state.winLine}
        heat={null}
        pending={pending}
        onPlace={play}
      />

      {pending && (
        <div
          className="undo-bar"
          role="status"
          // Keyed by cell so playing somewhere else restarts the bar instead of resuming it.
          key={pending.cell}
          style={{ '--undo-ms': `${UNDO_WINDOW_MS}ms` } as CSSProperties}
        >
          <span className="undo-progress" aria-hidden />
          <span className="grow">
            Sending in <strong className="tabular">{secondsLeft}</strong>…
          </span>
          <button type="button" className="small" onClick={cancel}>
            <Icon name="undo" size={16} /> Take it back
          </button>
        </div>
      )}

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <div className="row center" style={{ marginTop: 14 }}>
        {state.outcome === 0 ? (
          mySeat !== null && state.moves.length > 0 && (
            <button type="button" className="danger" disabled={busy} onClick={() => act({ type: 'resign' })}>
              <Icon name="flag" size={16} /> Resign
            </button>
          )
        ) : (
          mySeat !== null && (
            <button type="button" className="primary" disabled={busy || state.rematch.includes(uid)} onClick={() => act({ type: 'rematch' })}>
              <Icon name="undo" size={16} />
              {state.rematch.includes(uid) ? (waitingFor ? 'Waiting for them…' : 'Ready') : 'Play again'}
            </button>
          )
        )}
      </div>
      {mySeat === null && ready && (
        <p className="empty">You're watching. You'll get a seat if a player leaves.</p>
      )}
    </>
  );
}
