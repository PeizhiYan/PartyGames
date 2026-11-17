import UnoTable from './Table';
import type { UnoState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';
import { useRoomComputers } from '../roomComputers';
import { unoComputers } from './computers';

/** UNO with friends, in a room — and computer players, if the host seats some. */
export default function UnoRoom({ room, uid }: { room: Room; uid: string }) {
  const { act, error, busy } = useGameAction(room.id);
  const seating = useRoomComputers(room, uid, unoComputers);
  return <UnoTable state={room.state as UnoState} uid={uid} act={act} busy={busy} error={error} owner={isOwner(room, uid)} seating={seating} />;
}
