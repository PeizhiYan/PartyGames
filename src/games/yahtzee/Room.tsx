import YahtzeeTable from './Table';
import type { YahtzeeState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';

/** Yahtzee with friends, in a room. */
export default function YahtzeeRoom({ room, uid }: { room: Room; uid: string }) {
  const { act, error, busy } = useGameAction(room.id);
  return <YahtzeeTable state={room.state as YahtzeeState} uid={uid} act={act} busy={busy} error={error} owner={isOwner(room, uid)} />;
}
