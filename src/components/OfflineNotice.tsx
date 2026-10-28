import { Link } from 'react-router-dom';
import { GAMES } from '../domain/games';
import { useOnline } from '../hooks/useOnline';
import Icon from './ui/Icon';

/**
 * Says so when there is no connection, and points at what still works.
 *
 * Rooms need the server for every move, but a one-player game is entirely local, so being offline
 * is a reason to redirect someone rather than to stop them. Renders nothing when online.
 */
export default function OfflineNotice({ suggestSolo = true }: { suggestSolo?: boolean }) {
  const online = useOnline();
  if (online) return null;
  const solo = GAMES.find((g) => g.solo);

  return (
    <div className="offline-notice" role="status">
      <Icon name="info" size={18} />
      <span className="grow">
        <strong>You're offline.</strong>{' '}
        Rooms need a connection — what you can see here may be out of date.
      </span>
      {suggestSolo && solo && (
        <Link to={`/g/${solo.id}/solo`} className="button small">Play the computer</Link>
      )}
    </div>
  );
}
