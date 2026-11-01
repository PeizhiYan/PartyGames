import type { CSSProperties } from 'react';

/** A row of mutually exclusive buttons (a radio group), with a glass lens that slides to the selected one. */
export default function Segmented<T extends string>({ options, value, onChange, label, size, block }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'small';
  /** Stretch to the full width of its container. */
  block?: boolean;
}) {
  const classes = ['segmented'];
  if (size === 'small') classes.push('segmented-small');
  if (block) classes.push('segmented-block');
  return (
    <div className={classes.join(' ')} role="radiogroup" aria-label={label}
      style={{ '--count': options.length, '--index': Math.max(0, options.findIndex((o) => o.id === value)) } as CSSProperties}>
      <span className="segmented-lens" aria-hidden />
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value}
          className={o.id === value ? 'selected' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
