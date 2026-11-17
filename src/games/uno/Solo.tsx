import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UnoTable from './Table';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { COMPUTER_NAMES, chooseAction } from './ai';
import { catchable, currentSeat, handOf, uno } from './rules';
import { isComputer, localPlayers, useLocalGame } from '../local';
import { newSeed } from '../shuffle';
import { useCurrentUser } from '../../hooks/useAuth';

const STORED_COUNT = 'partygames:uno:computers';
/** How long a computer takes over its turn, so a turn can be followed. */
const BEAT_MS = 900;
/** How long you have to call UNO before a computer may catch you. */
const GRACE_MS = 2500;
/** Computers are not perfect: sometimes they forget UNO, and they do not always catch you. */
const COMPUTER_CALLS_UNO = 0.85;
const COMPUTER_CATCHES = 0.6;

/** UNO against one to three computer players, on this device. */
export default function UnoSoloPage() {
  const [count, setCount] = useState(() => Number(localStorage.getItem(STORED_COUNT)) || 2);
  useEffect(() => { localStorage.setItem(STORED_COUNT, String(count)); }, [count]);
  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/uno" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <strong className="grow">UNO vs the computer</strong>
        <Segmented label="Computer players" size="small" value={String(count)}
          onChange={(v) => setCount(Number(v))}
          options={[{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }]} />
      </header>
      {/* Keyed so changing the number of opponents starts a fresh game with new seats. */}
      <SoloGame key={count} computers={count} />
    </div>
  );
}

function SoloGame({ computers }: { computers: number }) {
  const { user } = useCurrentUser();
  const players = useMemo(
    () => localPlayers({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, COMPUTER_NAMES.slice(0, computers)),
    [user, computers],
  );
  const { state, act, error, generation } = useLocalGame(uno, players, user.uid);

  // You host this made-up room, so the first round deals itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === computers + 1) act({ type: 'start', seed: newSeed() });
  }, [state.phase, state.seats.length, computers, act]);

  // A computer's turn: maybe call UNO, then play or draw.
  const seat = currentSeat(state);
  const cpu = state.phase === 'playing' && seat && isComputer(seat.uid) ? seat.uid : null;
  useEffect(() => {
    if (!cpu) return;
    const mine = generation.current;
    const timer = window.setTimeout(() => {
      if (mine !== generation.current) return;
      if (handOf(state, cpu).length <= 2 && !state.uno[cpu] && Math.random() < COMPUTER_CALLS_UNO) {
        act({ type: 'callUno' }, cpu);
      }
      act(chooseAction(state, cpu), cpu);
    }, BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [cpu, state, act, generation]);

  // Forget to call UNO and, after a moment's grace, a computer may catch you.
  const exposed = catchable(state, user.uid);
  useEffect(() => {
    if (!exposed) return;
    const catcher = state.seats.find((s) => isComputer(s.uid) && !s.absent)?.uid;
    if (!catcher) return;
    const timer = window.setTimeout(() => {
      if (Math.random() < COMPUTER_CATCHES) act({ type: 'catch', uid: user.uid }, catcher);
    }, GRACE_MS);
    return () => window.clearTimeout(timer);
    // Only the moment you become catchable matters; re-arming on every move would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposed]);

  return <UnoTable state={state} uid={user.uid} act={(a) => act(a)} busy={false} error={error} owner />;
}
