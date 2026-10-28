import { Link } from 'react-router-dom';
import InstallCard from '../components/InstallCard';
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
            <span className="game-card-emoji" aria-hidden>{game.emoji}</span>
            <strong>{game.name}</strong>
            <span>{game.tagline}</span>
            <span className="badge badge-accent" style={{ marginTop: 10 }}>
              {game.minPlayers === game.maxPlayers
                ? `${game.maxPlayers} players`
                : `${game.solo ? 1 : game.minPlayers}–${game.maxPlayers} players`}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
