import { useSoundOn } from '../../hooks/useSound';
import { t } from '../../i18n';
import { m, reasonText } from './messages';
import { useMemo } from 'react';
import ChessBoard from './Board';
import Avatar from '../../ui/Avatar';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
import {
  boardOf, bothSeated, canRequestTakeback, seatOf, sideToMove, uidOfSide, type ChessState, type Side,
} from './rules';
import type { Room } from '../../types';
import { useGameAction } from '../../rooms/useRooms';
import { firstName } from '../../lib/format';

const sideName = (side: Side): string => (side === 1 ? m().white : m().black);

/** Chess against another person, in a room. */
export default function ChessRoom({ room, uid }: { room: Room; uid: string }) {
  const state = room.state as ChessState;
  const { act, error, busy } = useGameAction(room.id);
  const mySeat = seatOf(state, uid);
  const ready = bothSeated(state);
  const turn = sideToMove(state.moves);
  const myTurn = state.outcome === 0 && ready && mySeat !== null && mySeat === turn;
  useSoundOn(myTurn, (on) => (on ? 'turn' : null));
  useSoundOn(state.outcome, (o) => (o === 0 ? null : o === mySeat ? 'win' : o === 3 || mySeat === null ? 'tap' : 'lose'));
  const board = useMemo(() => boardOf(state.moves), [state.moves]);
  const lastMove = state.moves.length ? state.moves[state.moves.length - 1] : null;

  const takeback = state.takeback;
  const iAsked = takeback?.by === uid;
  const theyAsked = takeback && !iAsked && mySeat !== null;
  const asker = takeback ? room.players.find((p) => p.uid === takeback.by) : undefined;
  const undoes = takeback && seatOf(state, takeback.by) === turn ? 2 : 1;

  const player = (side: Side) => room.players.find((p) => p.uid === uidOfSide(state, side));

  const outcomeText = () => {
    if (state.outcome === 3) return `${t.cast.draw} ${reasonText(state.reason)}`;
    if (state.outcome === 0) return null;
    if (state.outcome === mySeat) return `${t.duel.youWin} ${reasonText(state.reason)}`;
    const winner = player(state.outcome);
    return `${t.duel.wins(winner ? firstName(winner.name) : sideName(state.outcome))} ${reasonText(state.reason)}`;
  };

  const waitingFor = state.rematch.length > 0
    && [state.white, state.black].filter(Boolean).some((u) => u && !state.rematch.includes(u));

  return (
    <>
      <div className="score-strip">
        {([1, 2] as Side[]).map((side) => {
          const p = player(side);
          const isTurn = state.outcome === 0 && turn === side && ready;
          return (
            <div key={side} className={`score-side${isTurn ? ' turn' : ''}`}>
              <span className={`chess-side-dot ${side === 1 ? 'white' : 'black'}`} aria-hidden />
              {p ? <Avatar name={p.name} photoURL={p.photoURL} size={26} /> : null}
              <span className="col grow" style={{ gap: 0, minWidth: 0 }}>
                <strong className="truncate" style={{ fontSize: '0.92rem' }}>
                  {p ? (p.uid === uid ? t.common.you : firstName(p.name)) : t.duel.waiting}
                </strong>
                <small className="muted">{sideName(side)} · {t.cast.wins(state.wins[p?.uid ?? ''] ?? 0)}</small>
              </span>
            </div>
          );
        })}
      </div>

      <div className="row center" style={{ marginBottom: 10 }}>
        <span className="turn-pill">
          {state.outcome !== 0 ? outcomeText()
            : !ready ? t.duel.waitingSecond
            : board.inCheck() ? (myTurn ? t.duel.checkYourTurn : t.duel.checkTurnOf(firstName(player(turn)?.name ?? '')))
            : myTurn ? t.cast.yourTurn
            : t.cast.turnOf(firstName(player(turn)?.name ?? t.duel.opponent))}
        </span>
      </div>

      <ChessBoard board={board} viewer={mySeat} canMove={myTurn && !busy} lastMove={lastMove}
        onMove={(mv) => act({ type: 'move', mv })} />

      {iAsked && (
        <div className="undo-bar" role="status">
          <span className="grow">{t.duel.askedTakeback}</span>
          <button type="button" className="small" disabled={busy}
            onClick={() => act({ type: 'respondTakeback', approve: false })}>{t.duel.neverMind}</button>
        </div>
      )}

      {error && <p className="error row center" style={{ marginTop: 10 }}>{error}</p>}

      <div className="row center" style={{ marginTop: 14 }}>
        {state.outcome === 0 ? (
          mySeat !== null && state.moves.length > 0 && (
            <>
              <button type="button" disabled={busy || !canRequestTakeback(state, uid)}
                onClick={() => act({ type: 'requestTakeback' })}>
                <Icon name="undo" size={16} /> {t.cast.takeBack}
              </button>
              <button type="button" className="danger" disabled={busy} onClick={() => act({ type: 'resign' })}>
                <Icon name="flag" size={16} /> {t.duel.resign}
              </button>
            </>
          )
        ) : (
          mySeat !== null && (
            <button type="button" className="primary" disabled={busy || state.rematch.includes(uid)}
              onClick={() => act({ type: 'rematch' })}>
              <Icon name="undo" size={16} />
              {state.rematch.includes(uid) ? (waitingFor ? t.duel.waitingThem : t.duel.ready) : t.cast.playAgain}
            </button>
          )
        )}
      </div>
      {mySeat === null && ready && <p className="empty">{t.duel.watching}</p>}

      <Sheet open={!!theyAsked} title={t.duel.takebackTitle}>
        {takeback && (
          <div className="col">
            <p style={{ margin: 0 }}>
              <strong>{asker ? firstName(asker.name) : t.duel.yourOpponent}</strong>{t.duel.wouldLike}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {undoes === 2
                ? t.duel.undoBoth
                : t.duel.undoOne}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="grow" disabled={busy}
                onClick={() => act({ type: 'respondTakeback', approve: false })}>{t.duel.noPlayOn}</button>
              <button type="button" className="primary grow" disabled={busy}
                onClick={() => act({ type: 'respondTakeback', approve: true })}>{t.duel.letThem}</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
