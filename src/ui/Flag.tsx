import type { Lang } from '../i18n';

// Small drawn flags for the language picker. Flag emoji aren't used because Windows and most Linux
// systems have no flag glyphs and show letters ("US") instead. All are drawn on a 30 × 20 canvas.

/** Points of a five-pointed star centred at (cx, cy), `r` to the tips, first tip pointing at `angle`. */
function star(cx: number, cy: number, r: number, angle = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((angle + i * 36) * Math.PI) / 180;
    const d = i % 2 === 0 ? r : r * 0.382;
    pts.push(`${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Angle from a small star towards the big star, so one tip points at it (as on the real flag). */
const towards = (x: number, y: number) => (Math.atan2(5 - y, 5 - x) * 180) / Math.PI;

const FLAGS: Record<Lang, JSX.Element> = {
  // United States: 13 stripes and a canton (stars simplified to a grid of dots).
  en: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={(i * 2 * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
      ))}
      <rect width="12" height={(7 * 20) / 13} fill="#3C3B6E" />
      {Array.from({ length: 20 }, (_, i) => (
        <circle key={`s${i}`} cx={1.5 + (i % 5) * 2.25 + (Math.floor(i / 5) % 2) * 1.1} cy={1.4 + Math.floor(i / 5) * 2.3} r="0.45" fill="#fff" />
      ))}
    </>
  ),
  // China: one large and four small yellow stars on red.
  zh: (
    <>
      <rect width="30" height="20" fill="#EE1C25" />
      <polygon points={star(5, 5, 3)} fill="#FFFF00" />
      {[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => (
        <polygon key={`${x}${y}`} points={star(x, y, 1, towards(x, y))} fill="#FFFF00" />
      ))}
    </>
  ),
  // Japan: a red disc on white.
  ja: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
};

export default function Flag({ lang, size = 24 }: { lang: Lang; size?: number }) {
  return (
    <svg className="flag" width={size} height={(size * 2) / 3} viewBox="0 0 30 20" aria-hidden="true">
      {FLAGS[lang]}
    </svg>
  );
}
