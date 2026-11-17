import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UnoTable from './Table';
import Icon from '../../ui/Icon';
import Setup from '../cast/Setup';
import { computerNames } from '../cast/cast';
import { unoComputers } from './computers';
import { uno } from './rules';
import { localPlayers, useLocalGame } from '../local';
import { useComputerTurns } from '../turns';
import { newSeed } from '../shuffle';
import { useCurrentUser } from '../../hooks/useAuth';

const STORED_COUNT = 'partygames:uno:players';

/** UNO on this device, against one to five computer players. */
export default function UnoSoloPage() {
  const { user } = useCurrentUser();
  // Asked first, every time: how many players. Null until chosen.
  const [players, setPlayers] = useState<number | null>(null);
  const remembered = Number(localStorage.getItem(STORED_COUNT)) || 4;
  return (
    <div className="room-screen wide">
      <header className="room-bar">
        <Link to="/g/uno" className="icon-button" aria-label="Back to the lobby"><Icon name="left" /></Link>
        <strong className="grow">UNO</strong>
        {players !== null && (
          <button type="button" className="small" onClick={() => setPlayers(null)}>
            <Icon name="users" size={16} /> Players
          </button>
        )}
      </header>
      {players === null
        ? <Setup title="UNO" blurb="Match the colour or the face. Don't forget to call it." min={2} max={6} initial={remembered}
            you={{ uid: user.uid, name: user.displayName }} startLabel="Deal the cards"
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
  const { state, act, error } = useLocalGame(uno, roster, user.uid);

  // You host this made-up room, so the first round deals itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === computers + 1) act({ type: 'start', seed: newSeed() });
  }, [state.phase, state.seats.length, computers, act]);

  // The computers' turns, their UNO calls, and catching you if you forget yours.
  useComputerTurns(state, unoComputers, (as, action) => act(action, as));

  return <UnoTable state={state} uid={user.uid} act={(a) => act(a)} busy={false} error={error} owner />;
}
