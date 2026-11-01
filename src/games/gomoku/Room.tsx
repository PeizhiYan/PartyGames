import { useEffect, useState } from 'react';
import GomokuBoard from './BoardCanvas';
import Avatar from '../../ui/Avatar';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
import type { Player } from './board';
import { bothSeated, canRequestTakeback, seatOf, type GomokuState } from './rules';
import type { Room } from '../../types';
import { useGameAction } from '../../rooms/useRooms';
import { firstName } from '../../lib/format';

/** Gomoku against another person, in a room. */
export default function GomokuRoom({ room, uid }: { room: Room; uid: string }) {
  const state = room.state as GomokuState;
  const { act, error, busy } = useGameAction(room.id);
  const mySeat = seatOf(state, uid);
  const ready = bothSeated(state);
  const myTurn = state.outcome === 0 && mySeat !== null && mySeat === state.turn;

  /**
   * The stone this player just played, drawn locally until the shared state catches up. Purely a
   * latency cover: it is sent the instant it is tapped. Without it the board shows nothing for the
   * length of a round trip and the tap feels lost.
   */
  const [pending, setPending] = useState<{ cell: number; player: Player } | null>(null);

  async function play(cell: number) {
    if (!mySeat) return;
    setPending({ cell, player: mySeat });
    const ok = await act({ type: 'place', cell });
    if (!ok) setPending(null); // refused: take it back off the board
  }

  // Once the shared state has the stone, the local copy has done its job. Handing over this way
  // round means there is never a frame without it.
  useEffect(() => {
    if (pending && state.board[pending.cell] !== 0) setPending(null);
  }, [state.board, pending]);

  const takeback = state.takeback;
  const iAsked = takeback?.by === uid;
  /** A request from the other player, waiting on an answer from this one. */
  const theyAsked = takeback && !iAsked && mySeat !== null;
  const asker = takeback ? room.players.find((p) => p.uid === takeback.by) : undefined;
  /** How many stones approving would remove: just theirs, or theirs and the reply. */
  const undoes = takeback && state.moves.length > 0
    ? (seatOf(state, takeback.by) === state.turn ? 2 : 1)
    : 1;

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

      {iAsked && (
        <div className="undo-bar" role="status">
          <span className="grow">Asked to take that move back — waiting for them…</span>
          <button type="button" className="small" disabled={busy}
            onClick={() => act({ type: 'respondTakeback', approve: false })}>
            Never mind
          </button>
        </div>
      )}

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <div className="row center" style={{ marginTop: 14 }}>
        {state.outcome === 0 ? (
          mySeat !== null && state.moves.length > 0 && (
            <>
              <button type="button" disabled={busy || !canRequestTakeback(state, uid)}
                onClick={() => act({ type: 'requestTakeback' })}>
                <Icon name="undo" size={16} /> Take back
              </button>
              <button type="button" className="danger" disabled={busy} onClick={() => act({ type: 'resign' })}>
                <Icon name="flag" size={16} /> Resign
              </button>
            </>
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

      <Sheet open={!!theyAsked} title="Take that move back?">
        {takeback && (
          <div className="col">
            <p style={{ margin: 0 }}>
              <strong>{asker ? firstName(asker.name) : 'Your opponent'}</strong> would like to
              unplay their last move.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {undoes === 2
                ? 'That takes their stone and your reply back off the board, and the turn returns to them.'
                : 'That takes their stone back off the board, and the turn returns to them.'}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="grow" disabled={busy}
                onClick={() => act({ type: 'respondTakeback', approve: false })}>
                No, play on
              </button>
              <button type="button" className="primary grow" disabled={busy}
                onClick={() => act({ type: 'respondTakeback', approve: true })}>
                Let them
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
