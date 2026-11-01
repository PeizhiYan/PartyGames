// A few line icons (24x24, stroke = currentColor). Kept inline so the app has no icon dependency.
const PATHS = {
  home: 'M3 10l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z',
  gamepad: 'M6 11h4 M8 9v4 M15 11h.01 M18 13h.01 M17 6H7a5 5 0 0 0-5 5v1a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5v-1a5 5 0 0 0-5-5z',
  sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  plus: 'M12 5v14 M5 12h14',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18 M6 6l12 12',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  undo: 'M3 7v6h6 M3.5 13a9 9 0 1 0 2.1-6.4L3 10',
  flag: 'M4 22V4 M4 4h11l-1.5 4L15 12H4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bank: 'M3 10l9-6 9 6 M5 10v10h14V10 M9 20v-6h6v6',
  dice: 'M4 4h16v16H4z M8.5 8.5h.01 M15.5 15.5h.01 M12 12h.01',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-5 M12 8h.01',
  copy: 'M9 9h10v12H9z M5 15H3V3h12v2',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      <path d={PATHS[name]} />
    </svg>
  );
}
