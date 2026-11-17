import MahjongTable from './Table';
import type { MahjongState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';
import { useRoomComputers } from '../roomComputers';
import { mahjongComputers } from './computers';

/** Mahjong in a room of four: friends, and computer players in any seat nobody has taken. */
export default function MahjongRoom({ room, uid }: { room: Room; uid: string }) {
  const { act, error, busy } = useGameAction(room.id);
  const seating = useRoomComputers(room, uid, mahjongComputers);
  return <MahjongTable state={room.state as MahjongState} uid={uid} act={act} busy={busy} error={error} owner={isOwner(room, uid)} seating={seating} />;
}
