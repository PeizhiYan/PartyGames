import MahjongTile from './Tile';
import './Mahjong.css';

/** Mahjong's phone icon: the red and green dragons, 中 and 發, standing on green felt. */
const RED_DRAGON = 31 * 4;
const GREEN_DRAGON = 32 * 4;

export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label="Mahjong">
      <defs>
        <radialGradient id="mjIconFelt" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#2f8f4e" /><stop offset="1" stopColor="#123f22" /></radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#mjIconFelt)" />
      <rect x="18" y="96" width="84" height="6" rx="3" fill="#000" opacity="0.25" />
      <g transform="translate(14 22) rotate(-8 24 32)"><MahjongTile tile={GREEN_DRAGON} width={48} /></g>
      <g transform="translate(56 26) rotate(7 24 32)"><MahjongTile tile={RED_DRAGON} width={50} /></g>
    </svg>
  );
}
