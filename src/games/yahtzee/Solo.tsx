import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import YahtzeeTable from './Table';
import Icon from '../../ui/Icon';
import Setup from '../cast/Setup';
import { yahtzeeComputers } from './computers';
import { currentSeat, yahtzee, type YahtzeeAction } from './rules';
import { isComputer, localRoster, useLocalGame, type LocalSeat } from '../local';
import { useComputerTurns } from '../turns';
import { useCurrentUser } from '../../hooks/useAuth';

const STORED = 'partygames:yahtzee:table';

interface Table { players: number; seats: LocalSeat[] }

function remembered(): Table {
  try {
    const saved = JSON.parse(localStorage.getItem(STORED) ?? 'null') as Table | null;
    if (saved && typeof saved.players === 'number' && Array.isArray(saved.seats)) return saved;
  } catch { /* nothing usable stored */ }
  return { players: 2, seats: [] };
}

/**
 * Yahtzee on this device: alone, against computer players, with friends passing the phone round,
 * or any mix of those.
 */
export default function YahtzeeSoloPage() {
  const { user } = useCurrentUser();
  // Asked first, every time: who is playing. Null until chosen.
  const [table, setTable] = useState<Table | null>(null);
  const last = remembered();
  return (
    <div className="room-screen wide">
      <header className="room-bar">
        <Link to="/g/yahtzee" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <strong className="grow">Yahtzee</strong>
        {table !== null && (
          <button type="button" className="small" onClick={() => setTable(null)}>
            <Icon name="users" size={16} /> Players
          </button>
        )}
      </header>
      {table === null
        ? <Setup title="Yahtzee" blurb="Five dice, three rolls, thirteen boxes." min={1} max={6} initial={last.players}
            initialSeats={last.seats} people you={{ uid: user.uid, name: user.displayName }} startLabel="Roll the dice"
            labelFor={(n) => (n === 1 ? 'just me' : undefined)}
            onStart={(players, seats) => {
              const next = { players, seats };
              try { localStorage.setItem(STORED, JSON.stringify(next)); } catch { /* private mode */ }
              setTable(next);
            }} />
        : <SoloGame key={JSON.stringify(table)} seats={table.seats} />}
    </div>
  );
}

function SoloGame({ seats }: { seats: LocalSeat[] }) {
  const { user } = useCurrentUser();
  const roster = useMemo(
    () => localRoster({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, seats),
    [user, seats],
  );
  const { state, act, error } = useLocalGame(yahtzee, roster, user.uid);

  // You host this made-up room, so the game starts itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === roster.length) act({ type: 'start' });
  }, [state.phase, state.seats.length, roster.length, act]);

  useComputerTurns(state, yahtzeeComputers, (as, action) => act(action, as));

  // Whose hands the device is in: the person to move, or — while a computer moves — whoever
  // moved last, so the screen does not jump back to you between other people's turns.
  const current = currentSeat(state);
  const personToMove = current && !isComputer(current.uid) ? current.uid : null;
  const [holder, setHolder] = useState(user.uid);
  useEffect(() => { if (personToMove) setHolder(personToMove); }, [personToMove]);
  const viewer = personToMove ?? holder;
  const shared = roster.filter((p) => !isComputer(p.uid)).length > 1;

  // Starting another game is the host's; everything else is played by whoever holds the device.
  const play = (action: YahtzeeAction) => act(action, action.type === 'again' || action.type === 'start' ? user.uid : viewer);

  return <YahtzeeTable state={state} uid={viewer} act={play} busy={false} error={error} owner hotseat={shared} />;
}
