import YahtzeeTable from './Table';
import { yahtzeeComputers } from './computers';
import type { YahtzeeState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';
import { useRoomComputers } from '../roomComputers';

/** Yahtzee with friends, in a room — with computer players too, if the host seats some. */
export default function YahtzeeRoom({ room, uid }: { room: Room; uid: string }) {
  const { act, error, busy } = useGameAction(room.id);
  const seating = useRoomComputers(room, uid, yahtzeeComputers);
  return <YahtzeeTable state={room.state as YahtzeeState} uid={uid} act={act} busy={busy} error={error} owner={isOwner(room, uid)} seating={seating} />;
}
