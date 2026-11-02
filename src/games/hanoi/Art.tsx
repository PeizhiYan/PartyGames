import { TowerScene } from './Board';
import { initialState } from './rules';

export default function Art() {
  return (
    <svg viewBox="0 0 640 200" className="game-art" preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="Seven colourful Hanoi disks on a wooden stand">
      <defs>
        <radialGradient id="hanoi-cover-glow">
          <stop stopColor="#334861" /><stop offset="1" stopColor="#101925" />
        </radialGradient>
      </defs>
      <rect width="640" height="200" fill="url(#hanoi-cover-glow)" />
      <svg x="120" y="10" width="400" height="180" color="#c2d0e1">
        <TowerScene pegs={initialState().pegs} />
      </svg>
    </svg>
  );
}
