import { t } from '../../i18n';
import { useState } from 'react';
import Character from './Character';
import Seat from './Seat';
import { assignSpecies, computerNames } from './cast';
import { localRoster, type LocalSeat } from '../local';

/** The seats after yours, as they would be played: computers named from the cast, people as typed. */
export function finishSeats(seats: LocalSeat[]): LocalSeat[] {
  const names = computerNames(seats.length);
  let computers = 0;
  return seats.map((s, i) => (s.kind === 'computer'
    ? { kind: 'computer', name: names[computers++] }
    : { kind: 'person', name: s.name.trim() || t.cast.playerN(i + 2) }));
}

/**
 * Before a game on this device: how many players, and — where the game allows it — which of
 * them are people sharing the device rather than the computer. Shows the faces you would be
 * playing, so the number means people, not a digit.
 *
 * `fixed` is for games with one right answer (mahjong is always four): the counts are not
 * offered, only the table and a start button.
 */
export default function Setup({ title, blurb, min, max, initial, initialSeats, you, fixed, people, startLabel = t.cast.start, onStart, labelFor }: {
  title: string;
  blurb?: string;
  /** Total players including you. */
  min: number;
  max: number;
  initial: number;
  /** Who sat in the other seats last time. */
  initialSeats?: LocalSeat[];
  you: { uid: string; name: string };
  fixed?: boolean;
  /** Each other seat may be a person on this device as well as a computer. */
  people?: boolean;
  startLabel?: string;
  onStart: (players: number, seats: LocalSeat[]) => void;
  /** Words under a count, like "just me". */
  labelFor?: (players: number) => string | undefined;
}) {
  const [count, setCount] = useState(Math.min(max, Math.max(min, initial)));
  const [seats, setSeats] = useState<LocalSeat[]>(() => Array.from({ length: max - 1 }, (_, i) => {
    const before = people ? initialSeats?.[i] : undefined;
    return before ?? { kind: 'computer', name: '' };
  }));
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const chosen = finishSeats(seats.slice(0, count - 1));
  const roster = localRoster(you, chosen);
  const looks = assignSpecies(roster.map((p) => p.uid));
  const others = roster.slice(1);
  const change = (i: number, seat: Partial<LocalSeat>) => setSeats((all) => all.map((s, k) => (k === i ? { ...s, ...seat } : s)));

  return (
    <div className="setup">
      <div>
        <h2>{title}</h2>
        {blurb && <p className="muted" style={{ margin: '6px 0 0' }}>{blurb}</p>}
      </div>
      {!fixed && (
        <>
          <strong>{t.cast.howMany}</strong>
          <div className="setup-counts" role="radiogroup" aria-label={t.cast.howMany}>
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
      {people ? (
        <ul className="setup-seats">
          <li>
            <Character uid={you.uid} species={looks[you.uid]} size={44} expression="happy" />
            <span className="setup-seat-name"><strong>{t.common.you}</strong></span>
          </li>
          {others.map((p, i) => (
            <li key={i} style={{ animationDelay: `${i * 0.05}s` }}>
              <Character uid={p.uid} species={looks[p.uid]} size={44} />
              <span className="setup-seat-name">
                {chosen[i].kind === 'computer'
                  ? <strong>{p.name}</strong>
                  : <input type="text" value={seats[i].name} placeholder={t.cast.playerN(i + 2)} maxLength={20}
                      aria-label={t.cast.nameFor(i + 2)} onChange={(e) => change(i, { name: e.target.value })} />}
              </span>
              <div className="setup-kind" role="radiogroup" aria-label={t.cast.whoPlays(i + 2)}>
                {(['computer', 'person'] as const).map((kind) => (
                  <button key={kind} type="button" role="radio" aria-checked={seats[i].kind === kind}
                    className={seats[i].kind === kind ? 'selected' : ''} onClick={() => change(i, { kind })}>
                    {kind === 'computer' ? t.cast.computer : t.cast.person}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="setup-cast">
          <Seat key={`you-${count}`} uid={you.uid} species={looks[you.uid]} name={t.common.you} expression="happy" size={56} />
          {others.map((p, i) => (
            <Seat key={`${p.uid}-${count}`} uid={p.uid} species={looks[p.uid]} name={p.name} size={56}
              style={{ animationDelay: `${(i + 1) * 0.06}s` }} />
          ))}
        </div>
      )}
      {people && chosen.some((s) => s.kind === 'person') && (
        <p className="muted setup-note">{t.cast.shared}</p>
      )}
      <button type="button" className="primary" style={{ minWidth: 200 }} onClick={() => onStart(count, chosen)}>{startLabel}</button>
    </div>
  );
}
