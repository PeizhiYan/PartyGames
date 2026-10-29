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
const UNDO_WINDOW_MS = 1500;

/** Gomoku against another person, in a room. */
export default function GomokuRoom({ room, uid }: { room: Room; uid: string }) {
  const state = room.state as GomokuState;
  const { act, error, busy } = useGameAction(room.id);
  const mySeat = seatOf(state, uid);
  const ready = bothSeated(state);
  const myTurn = state.outcome === 0 && mySeat !== null && mySeat === state.turn;

  /**
   * A move this player has made that the shared state does not show yet — either still inside the
   * undo window (`sent: false`, nobody else can see it) or on its way to the server.
   */
  const [pending, setPending] = useState<{ cell: number; player: Player; sent: boolean } | null>(null);
  const sendTimer = useRef<number>();

  const cancel = () => {
    window.clearTimeout(sendTimer.current);
    setPending(null);
  };

  /** Puts the stone down locally and starts the clock on sending it. */
  function play(cell: number) {
    if (!mySeat) return;
    cancel();
    setPending({ cell, player: mySeat, sent: false });
    sendTimer.current = window.setTimeout(async () => {
      // Keep drawing the stone while the write is in flight. Clearing it here and waiting for the
      // round trip to bring it back made the stone blink out for as long as the network took.
      setPending((p) => (p ? { ...p, sent: true } : p));
      const ok = await act({ type: 'place', cell });
      if (!ok) setPending(null); // refused: take it back off the board
    }, UNDO_WINDOW_MS);
  }

  // Once the shared state has the stone, the local copy has done its job. Handing over this way
  // round means there is never a frame without it.
  useEffect(() => {
    if (pending?.sent && state.board[pending.cell] !== 0) setPending(null);
  }, [state.board, pending]);

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
          ) : pending && !pending.sent ? (
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

      {pending && !pending.sent && (
        <div
          className="undo-bar"
          role="status"
          // Keyed by cell so playing somewhere else restarts the bar instead of resuming it.
          key={pending.cell}
          style={{ '--undo-ms': `${UNDO_WINDOW_MS}ms` } as CSSProperties}
        >
          <span className="undo-progress" aria-hidden />
          {/* The draining bar is the countdown; a number this short just flickers. */}
          <span className="grow">Sending…</span>
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
