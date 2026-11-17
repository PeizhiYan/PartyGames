import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import YahtzeeTable from './Table';
import Icon from '../../ui/Icon';
import Setup from '../cast/Setup';
import { computerNames } from '../cast/cast';
import { chooseCategory, chooseHolds } from './ai';
import { ROLLS_PER_TURN, currentSeat, throwFive, yahtzee } from './rules';
import { isComputer, localPlayers, useLocalGame } from '../local';
import { useCurrentUser } from '../../hooks/useAuth';

const STORED_COUNT = 'partygames:yahtzee:players';
/** How long the computer waits between its actions, so a turn can be followed. */
const BEAT_MS = 800;

/** Yahtzee on this device: alone, or against up to five computer players. */
export default function YahtzeeSoloPage() {
  const { user } = useCurrentUser();
  // Asked first, every time: how many players. Null until chosen.
  const [players, setPlayers] = useState<number | null>(null);
  const remembered = Number(localStorage.getItem(STORED_COUNT)) || 2;
  return (
    <div className="room-screen wide">
      <header className="room-bar">
        <Link to="/g/yahtzee" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <strong className="grow">Yahtzee</strong>
        {players !== null && (
          <button type="button" className="small" onClick={() => setPlayers(null)}>
            <Icon name="users" size={16} /> Players
          </button>
        )}
      </header>
      {players === null
        ? <Setup title="Yahtzee" blurb="Five dice, three rolls, thirteen boxes." min={1} max={6} initial={remembered}
            you={{ uid: user.uid, name: user.displayName }} startLabel="Roll the dice"
            labelFor={(n) => (n === 1 ? 'just me' : undefined)}
            onStart={(n) => { localStorage.setItem(STORED_COUNT, String(n)); setPlayers(n); }} />
        : <SoloGame key={players} computers={players - 1} />}
    </div>
  );
}

function SoloGame({ computers }: { computers: number }) {
  const { user } = useCurrentUser();
  const roster = useMemo(
    () => localPlayers({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, computerNames(computers)),
    [user, computers],
  );
  const { state, act, error, generation } = useLocalGame(yahtzee, roster, user.uid);

  // You host this made-up room, so the game starts itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === computers + 1) act({ type: 'start' });
  }, [state.phase, state.seats.length, computers, act]);

  // The computer's turn, one beat at a time: roll, hold, roll again, score.
  const seat = currentSeat(state);
  const computersTurn = state.phase === 'playing' && !!seat && isComputer(seat.uid);
  useEffect(() => {
    if (!computersTurn || !seat) return;
    const mine = generation.current;
    const timer = window.setTimeout(() => {
      if (mine !== generation.current) return;
      const cpu = seat.uid;
      if (state.rolls === 0) { act({ type: 'roll', dice: throwFive() }, cpu); return; }
      const rollsLeft = ROLLS_PER_TURN - state.rolls;
      const holds = rollsLeft > 0 ? chooseHolds(state.dice, seat, rollsLeft) : [true, true, true, true, true];
      if (rollsLeft > 0 && !holds.every(Boolean)) {
        holds.forEach((held, i) => { if (held !== state.held[i]) act({ type: 'hold', index: i, held }, cpu); });
        act({ type: 'roll', dice: throwFive() }, cpu);
        return;
      }
      act({ type: 'score', category: chooseCategory(seat, state.dice) }, cpu);
    }, BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [computersTurn, seat, state.rolls, state.dice, state.held, act, generation]);

  return <YahtzeeTable state={state} uid={user.uid} act={(a) => act(a)} busy={false} error={error} owner />;
}
