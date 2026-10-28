import { Link } from 'react-router-dom';
import GameArt from '../components/art/GameArt';
import InstallCard from '../components/InstallCard';
import Icon from '../components/ui/Icon';
import { GAMES } from '../domain/games';
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
        {GAMES.map((game) => (
          <Link key={game.id} to={`/g/${game.id}`} className="game-card">
            <span className="game-card-art">
              <GameArt game={game.id} />
            </span>
            <span className="game-card-body">
              <strong>{game.name}</strong>
              <span className="game-card-tagline">{game.tagline}</span>
              <span className="game-card-meta">
                <span className="badge badge-accent">
                  {game.minPlayers === game.maxPlayers
                    ? `${game.maxPlayers} players`
                    : `${game.solo ? 1 : game.minPlayers}–${game.maxPlayers} players`}
                </span>
                {game.solo && <span className="badge">vs computer</span>}
                <span className="game-card-go" aria-hidden><Icon name="right" size={18} /></span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
