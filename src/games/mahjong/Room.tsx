import MahjongTable from './Table';
import type { MahjongState } from './rules';
import type { Room } from '../../types';
import { isOwner } from '../../rooms/rules';
import { useGameAction } from '../../rooms/useRooms';

/** Mahjong with friends, in a room of four. */
export default function MahjongRoom({ room, uid }: { room: Room; uid: string }) {
  const { act, error, busy } = useGameAction(room.id);
  return <MahjongTable state={room.state as MahjongState} uid={uid} act={act} busy={busy} error={error} owner={isOwner(room, uid)} />;
}
