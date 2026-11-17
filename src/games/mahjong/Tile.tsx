import { kindOf, rankOfKind, tileName } from './tiles';

/**
 * One mahjong tile in SVG, `width` pixels wide (tiles are 3:4). Ivory face on a green back, the
 * way a real set is cut.
 *
 * Characters, winds and dragons are written with their Chinese characters — real text, like the
 * xiangqi pieces, not emoji. Dots and bamboo are drawn.
 */
const CJK = "'Noto Serif CJK SC', 'Songti SC', 'STSong', 'SimSun', 'Noto Sans CJK SC', serif";
const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WINDS = ['東', '南', '西', '北'];
const NAVY = '#1d2c6b';
const RED = '#c0392b';
const GREEN = '#1f7a45';

/** Where the dots or sticks go for ranks 1-9, inside a 30x36 face. */
const LAYOUT: Record<number, [number, number][]> = {
  1: [[15, 18]],
  2: [[15, 10], [15, 26]],
  3: [[8, 8], [15, 18], [22, 28]],
  4: [[9, 10], [21, 10], [9, 26], [21, 26]],
  5: [[9, 9], [21, 9], [15, 18], [9, 27], [21, 27]],
  6: [[9, 8], [21, 8], [9, 18], [21, 18], [9, 28], [21, 28]],
  7: [[7, 6], [15, 9], [23, 12], [9, 22], [21, 22], [9, 30], [21, 30]],
  8: [[9, 6], [21, 6], [9, 14], [21, 14], [9, 22], [21, 22], [9, 30], [21, 30]],
  9: [[7, 8], [15, 8], [23, 8], [7, 18], [15, 18], [23, 18], [7, 28], [15, 28], [23, 28]],
};
const DOT_COLORS = [NAVY, GREEN, RED];

function Face({ kind }: { kind: number }) {
  const text = (ch: string, y: number, size: number, fill: string) => (
    <text x="15" y={y} fontSize={size} fill={fill} fontWeight="700" textAnchor="middle" dominantBaseline="central" fontFamily={CJK}>{ch}</text>
  );
  if (kind >= 9 && kind < 18) {
    return <>{text(NUMERALS[kind - 9], 10, 11, NAVY)}{text('萬', 25, 13, RED)}</>;
  }
  if (kind >= 18 && kind < 27) {
    const rank = rankOfKind(kind);
    if (rank === 1) {
      return (
        <g>
          <circle cx="15" cy="18" r="10" fill="none" stroke={NAVY} strokeWidth="1.6" />
          <circle cx="15" cy="18" r="6.5" fill="none" stroke={RED} strokeWidth="1.6" />
          <circle cx="15" cy="18" r="3" fill={GREEN} />
        </g>
      );
    }
    const r = rank <= 4 ? 4.4 : rank <= 6 ? 3.8 : 3.3;
    return (
      <g>
        {LAYOUT[rank].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={DOT_COLORS[(i + rank) % 3]} />
            <circle cx={x} cy={y} r={r * 0.4} fill="#f8f4e8" />
          </g>
        ))}
      </g>
    );
  }
  if (kind < 9) {
    const rank = rankOfKind(kind);
    if (rank === 1) {
      // The one of bamboo is traditionally a bird; a single tall, bright stick reads at tile size.
      return (
        <g>
          <rect x="12" y="5" width="6" height="26" rx="3" fill={GREEN} />
          <line x1="12.5" y1="18" x2="17.5" y2="18" stroke="#f8f4e8" strokeWidth="1.2" />
          <circle cx="15" cy="5.5" r="3.2" fill={RED} />
        </g>
      );
    }
    return (
      <g>
        {LAYOUT[rank].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 1.6} y={y - 4} width="3.2" height="8" rx="1.4" fill={(rank === 5 || rank === 9) && i === Math.floor(LAYOUT[rank].length / 2) ? RED : GREEN} />
            <line x1={x - 1.6} y1={y} x2={x + 1.6} y2={y} stroke="#f8f4e8" strokeWidth="0.8" />
          </g>
        ))}
      </g>
    );
  }
  if (kind < 31) return text(WINDS[kind - 27], 18, 20, NAVY);
  if (kind === 31) return text('中', 18, 21, RED);
  if (kind === 32) return text('發', 18, 20, GREEN);
  return <rect x="8" y="9" width="14" height="18" rx="1.5" fill="none" stroke="#1f78d1" strokeWidth="1.8" />;
}

export default function MahjongTile({ tile, width = 30, faceDown, className }: {
  tile?: number;
  width?: number;
  faceDown?: boolean;
  className?: string;
}) {
  const height = (width * 4) / 3;
  return (
    <svg className={`mj-tile${className ? ` ${className}` : ''}`} width={width} height={height} viewBox="0 0 30 40"
      role={faceDown || tile === undefined ? undefined : 'img'}
      aria-label={faceDown || tile === undefined ? undefined : tileName(tile)}
      aria-hidden={faceDown || tile === undefined ? true : undefined}>
      <rect x="0.5" y="0.5" width="29" height="39" rx="3.5" fill="#2f8a5b" />
      {faceDown || tile === undefined ? (
        <rect x="2.5" y="2" width="25" height="33" rx="2.5" fill="#3aa36c" stroke="#28774d" strokeWidth="0.8" />
      ) : (
        <>
          <rect x="0.5" y="0.5" width="29" height="35.5" rx="3.5" fill="#f8f4e8" stroke="#c9bfa6" strokeWidth="0.8" />
          <Face kind={kindOf(tile)} />
        </>
      )}
    </svg>
  );
}
