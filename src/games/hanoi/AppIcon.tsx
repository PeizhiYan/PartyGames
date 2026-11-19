import { m } from './messages';
/** Hanoi Tower's phone icon: a rainbow stack of disks on one peg. */
const DISKS = [
  { w: 88, c: '#7b4fd6' }, { w: 74, c: '#2f7fe0' }, { w: 60, c: '#2bb673' }, { w: 46, c: '#f2c230' }, { w: 32, c: '#ef6c2f' },
];

export default function AppIcon() {
  return (
    <svg viewBox="0 0 120 120" className="app-icon" role="img" aria-label={m().name}>
      <defs>
        <radialGradient id="hnIconBg" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#3b5372" /><stop offset="1" stopColor="#101925" /></radialGradient>
        <linearGradient id="hnIconWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c58b4a" /><stop offset="1" stopColor="#7e4f22" /></linearGradient>
        <linearGradient id="hnIconShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#hnIconBg)" />
      <rect x="57" y="18" width="6" height="82" rx="3" fill="url(#hnIconWood)" />
      <rect x="10" y="98" width="100" height="9" rx="3" fill="url(#hnIconWood)" />
      {DISKS.map((d, i) => {
        const y = 86 - i * 13;
        return (
          <g key={d.c}>
            <rect x={60 - d.w / 2} y={y} width={d.w} height="12" rx="6" fill={d.c} />
            <rect x={60 - d.w / 2} y={y} width={d.w} height="12" rx="6" fill="url(#hnIconShine)" />
          </g>
        );
      })}
    </svg>
  );
}
