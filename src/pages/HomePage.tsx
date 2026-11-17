import { Link } from 'react-router-dom';
import { GameArt, GameIcon } from '../games/screens';
import InstallCard from '../shell/InstallCard';
import Icon from '../ui/Icon';
import { GAMES } from '../games/registry';
import { useCurrentUser } from '../hooks/useAuth';
import { firstName } from '../lib/format';

/** The hub: pick a game. */
export default function HomePage() {
  const { user } = useCurrentUser();
  return (
    <>
      <header className="home-hero">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <div>
          <h1>Hi {firstName(user.displayName)}</h1>
          <p className="muted" style={{ margin: 0 }}>What are we playing?</p>
        </div>
      </header>

      <InstallCard compact />

      <div className="game-grid">
        {GAMES.map((game) => {
          const players = game.minPlayers === game.maxPlayers
            ? `${game.maxPlayers} ${game.maxPlayers === 1 ? 'player' : 'players'}`
            : `${game.solo ? 1 : game.minPlayers}–${game.maxPlayers} players`;
          return (
            <Link key={game.id} to={`/g/${game.id}`} className="game-card">
              {/* A phone shows the icon and a desktop the cover; CSS picks, so nothing reflows. */}
              <span className="game-card-art"><GameArt game={game.id} /></span>
              <span className="game-card-icon"><GameIcon game={game.id} /></span>
              <span className="game-card-body">
                <strong>{game.name}</strong>
                <span className="game-card-players"><Icon name="users" size={12} />{players}</span>
                <span className="game-card-tagline">{game.tagline}</span>
                <span className="game-card-meta">
                  <span className="badge badge-accent">{players}</span>
                  {game.solo && <span className="badge">{game.multiplayer ? 'vs computer' : 'Solo puzzle'}</span>}
                  <span className="game-card-go" aria-hidden><Icon name="right" size={18} /></span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
