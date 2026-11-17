import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import YahtzeeTable from './Table';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { COMPUTER_NAMES, chooseCategory, chooseHolds } from './ai';
import { ROLLS_PER_TURN, currentSeat, throwFive, yahtzee } from './rules';
import { isComputer, localPlayers, useLocalGame } from '../local';
import { useCurrentUser } from '../../hooks/useAuth';

const STORED_COUNT = 'partygames:yahtzee:computers';
/** How long the computer waits between its actions, so a turn can be followed. */
const BEAT_MS = 650;

/** Yahtzee against one to three computer players, on this device. */
export default function YahtzeeSoloPage() {
  const [count, setCount] = useState(() => Number(localStorage.getItem(STORED_COUNT)) || 1);
  useEffect(() => { localStorage.setItem(STORED_COUNT, String(count)); }, [count]);
  return (
    <div className="room-screen">
      <header className="room-bar">
        <Link to="/g/yahtzee" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <strong className="grow">Yahtzee vs the computer</strong>
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
  const { state, act, error, generation } = useLocalGame(yahtzee, players, user.uid);
  const [rolling, setRolling] = useState(false);

  // You are the host of this made-up room, so the game starts itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === computers + 1) act({ type: 'start' });
  }, [state.phase, state.seats.length, computers, act]);

  // The computer's turn, one beat at a time: roll, then hold-and-roll, then score.
  const seat = currentSeat(state);
  const computersTurn = state.phase === 'playing' && !!seat && isComputer(seat.uid);
  useEffect(() => {
    if (!computersTurn || !seat) return;
    const mine = generation.current;
    const timer = window.setTimeout(() => {
      if (mine !== generation.current) return;
      const cpu = seat.uid;
      if (state.rolls === 0) {
        setRolling(true);
        window.setTimeout(() => setRolling(false), 450);
        act({ type: 'roll', dice: throwFive() }, cpu);
        return;
      }
      const rollsLeft = ROLLS_PER_TURN - state.rolls;
      const holds = rollsLeft > 0 ? chooseHolds(state.dice, seat, rollsLeft) : [true, true, true, true, true];
      if (rollsLeft > 0 && !holds.every(Boolean)) {
        holds.forEach((held, i) => { if (held !== state.held[i]) act({ type: 'hold', index: i, held }, cpu); });
        setRolling(true);
        window.setTimeout(() => setRolling(false), 450);
        act({ type: 'roll', dice: throwFive() }, cpu);
        return;
      }
      act({ type: 'score', category: chooseCategory(seat, state.dice) }, cpu);
    }, BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [computersTurn, seat, state.rolls, state.dice, state.held, act, generation]);

  return (
    <YahtzeeTable
      state={state}
      uid={user.uid}
      act={(action) => act(action)}
      busy={false}
      error={error}
      owner
      rolling={rolling}
      onRoll={() => { setRolling(true); window.setTimeout(() => setRolling(false), 500); }}
    />
  );
}
