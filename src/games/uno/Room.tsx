import UnoTable from './Table';
import type { UnoState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';

/** UNO with friends, in a room. */
export default function UnoRoom({ room, uid }: { room: Room; uid: string }) {
  const { act, error, busy } = useGameAction(room.id);
  return <UnoTable state={room.state as UnoState} uid={uid} act={act} busy={busy} error={error} owner={isOwner(room, uid)} />;
}
