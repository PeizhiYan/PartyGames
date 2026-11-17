import { useState } from 'react';
import YahtzeeTable from './Table';
import type { YahtzeeState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';

/** Yahtzee with friends, in a room. */
export default function YahtzeeRoom({ room, uid }: { room: Room; uid: string }) {
  const state = room.state as YahtzeeState;
  const { act, error, busy } = useGameAction(room.id);
  const [rolling, setRolling] = useState(false);
  return (
    <YahtzeeTable
      state={state}
      uid={uid}
      act={act}
      busy={busy}
      error={error}
      owner={isOwner(room, uid)}
      rolling={rolling}
      onRoll={() => { setRolling(true); window.setTimeout(() => setRolling(false), 500); }}
    />
  );
}
