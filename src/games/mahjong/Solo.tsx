import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MahjongTable from './Table';
import Icon from '../../ui/Icon';
import Setup from '../cast/Setup';
import { computerNames } from '../cast/cast';
import { chooseClaim, chooseTurn } from './ai';
import { SEATS, currentSeat, mahjong } from './rules';
import { isComputer, localPlayers, useLocalGame } from '../local';
import { newSeed } from '../shuffle';
import { useCurrentUser } from '../../hooks/useAuth';

/** How long the computers take over a move, so the table can be followed. */
const BEAT_MS = 750;

/** Mahjong against three computer players, on this device. Always four at the table. */
export default function MahjongSoloPage() {
  const { user } = useCurrentUser();
  const [started, setStarted] = useState(false);
  return (
    <div className="room-screen wide">
      <header className="room-bar">
        <Link to="/g/mahjong" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <strong className="grow">Mahjong</strong>
      </header>
      {started
        ? <SoloGame />
        : <Setup title="Mahjong" blurb="Mahjong is always played four at a table: you and three computer players."
            min={SEATS} max={SEATS} initial={SEATS} fixed you={{ uid: user.uid, name: user.displayName }}
            startLabel="Sit down and deal" onStart={() => setStarted(true)} />}
    </div>
  );
}

function SoloGame() {
  const { user } = useCurrentUser();
  const players = useMemo(
    () => localPlayers({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, computerNames(SEATS - 1)),
    [user],
  );
  const { state, act, error, generation } = useLocalGame(mahjong, players, user.uid);

  // You host this made-up table, so the first hand deals itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === SEATS) act({ type: 'start', seed: newSeed() });
  }, [state.phase, state.seats.length, act]);

  // The next computer with a call to answer — one at a time, because an answer can close the
  // window and change what the next may do. A uid, not a list, so the effect is not re-armed on
  // every render.
  const seat = currentSeat(state);
  const answering = state.stage === 'claims' && state.claim
    ? Object.entries(state.claim.responses).find(([u, r]) => r === null && isComputer(u))?.[0] ?? null
    : null;
  const computersTurn = state.phase === 'playing' && state.stage === 'discard' && !!seat && isComputer(seat.uid);
  const busyComputer = state.phase === 'playing' && (answering !== null || computersTurn);
  useEffect(() => {
    if (!busyComputer) return;
    const mine = generation.current;
    const timer = window.setTimeout(() => {
      if (mine !== generation.current) return;
      if (answering) {
        const answer = chooseClaim(state, answering);
        act(answer === 'pass' ? { type: 'pass' } : { type: 'claim', claim: answer }, answering);
      } else if (seat) {
        act(chooseTurn(state, seat.uid), seat.uid);
      }
    }, BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [busyComputer, state, seat, answering, act, generation]);

  return <MahjongTable state={state} uid={user.uid} act={(a) => act(a)} busy={false} error={error} owner />;
}
