import SoundToggle from '../../ui/SoundToggle';
import { t } from '../../i18n';
import { m } from './messages';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MahjongTable from './Table';
import Icon from '../../ui/Icon';
import Setup from '../cast/Setup';
import { computerNames } from '../cast/cast';
import { mahjongComputers } from './computers';
import { SEATS, mahjong } from './rules';
import { localPlayers, useLocalGame } from '../local';
import { useComputerTurns } from '../turns';
import { newSeed } from '../shuffle';
import { useCurrentUser } from '../../hooks/useAuth';

/** Mahjong against three computer players, on this device. Always four at the table. */
export default function MahjongSoloPage() {
  const { user } = useCurrentUser();
  const [started, setStarted] = useState(false);
  return (
    <div className="room-screen wide">
      <header className="room-bar">
        <Link to="/g/mahjong" className="icon-button" aria-label={t.cast.backToLobby}><Icon name="left" /></Link>
        <strong className="grow">{m().name}</strong>
        <SoundToggle />
      </header>
      {started
        ? <SoloGame />
        : <Setup title={m().name} blurb={m().setupBlurb}
            min={SEATS} max={SEATS} initial={SEATS} fixed you={{ uid: user.uid, name: user.displayName }}
            startLabel={m().sitDown} onStart={() => setStarted(true)} />}
    </div>
  );
}

function SoloGame() {
  const { user } = useCurrentUser();
  const players = useMemo(
    () => localPlayers({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, computerNames(SEATS - 1)),
    [user],
  );
  const { state, act, error } = useLocalGame(mahjong, players, user.uid);

  // You host this made-up table, so the first hand deals itself.
  useEffect(() => {
    if (state.phase === 'lobby' && state.seats.length === SEATS) act({ type: 'start', seed: newSeed() });
  }, [state.phase, state.seats.length, act]);

  // The computers answer calls and take their turns, one beat at a time.
  useComputerTurns(state, mahjongComputers, (as, action) => act(action, as));

  return <MahjongTable state={state} uid={user.uid} act={(a) => act(a)} busy={false} error={error} owner />;
}
