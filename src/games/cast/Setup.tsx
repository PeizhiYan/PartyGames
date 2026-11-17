import { useState } from 'react';
import Seat from './Seat';
import { COMPUTER_CAST, assignSpecies } from './cast';
import { COMPUTER_UID } from '../local';

/**
 * Before a solo game: how many players? Shows the cast you would be playing as you choose, so
 * the number means faces, not a digit.
 *
 * `fixed` is for games with one right answer (mahjong is always four): the counts are not
 * offered, only the table and a start button.
 */
export default function Setup({ title, blurb, min, max, initial, you, fixed, startLabel = 'Start', onStart, labelFor }: {
  title: string;
  blurb?: string;
  /** Total players including you. */
  min: number;
  max: number;
  initial: number;
  you: { uid: string; name: string };
  fixed?: boolean;
  startLabel?: string;
  onStart: (players: number) => void;
  /** Words under a count, like "just me". */
  labelFor?: (players: number) => string | undefined;
}) {
  const [count, setCount] = useState(Math.min(max, Math.max(min, initial)));
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const computerUids = COMPUTER_CAST.slice(0, count - 1).map((_, i) => (i === 0 ? COMPUTER_UID : `${COMPUTER_UID}-${i + 1}`));
  const looks = assignSpecies([you.uid, ...computerUids]);
  return (
    <div className="setup">
      <div>
        <h2>{title}</h2>
        {blurb && <p className="muted" style={{ margin: '6px 0 0' }}>{blurb}</p>}
      </div>
      {!fixed && (
        <>
          <strong>How many players?</strong>
          <div className="setup-counts" role="radiogroup" aria-label="How many players">
            {options.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={n === count}
                className={n === count ? 'selected' : ''} onClick={() => setCount(n)}>
                {n}
                {labelFor?.(n) && <small>{labelFor(n)}</small>}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="setup-cast">
        <Seat key={`you-${count}`} uid={you.uid} species={looks[you.uid]} name="You" expression="happy" size={56} />
        {COMPUTER_CAST.slice(0, count - 1).map((c, i) => (
          <Seat key={`${c.name}-${count}`} uid={computerUids[i]} species={looks[computerUids[i]]} name={c.name} size={56}
            style={{ animationDelay: `${(i + 1) * 0.06}s` }} />
        ))}
      </div>
      <button type="button" className="primary" style={{ minWidth: 200 }} onClick={() => onStart(count)}>{startLabel}</button>
    </div>
  );
}
