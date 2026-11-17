import { useEffect, useState } from 'react';
import Segmented from '../../ui/Segmented';

/** Who you play a two-player game against on this device. */
export type Opponent = 'computer' | 'friend';

function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** A choice kept on this device between visits, like the opponent or whether the board turns. */
export function useRemembered<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => stored(key, allowed, fallback));
  useEffect(() => {
    try { localStorage.setItem(key, value); } catch { /* private mode: forget it */ }
  }, [key, value]);
  return [value, setValue];
}

/** The card that switches between the computer and a friend sharing this device. */
export function OpponentCard({ value, onChange, computer = 'The computer' }: {
  value: Opponent;
  onChange: (o: Opponent) => void;
  /** What the computer is called in this game. */
  computer?: string;
}) {
  return (
    <section className="card">
      <h3>Opponent</h3>
      <Segmented label="Opponent" value={value} onChange={onChange} block
        options={[{ id: 'computer', label: computer }, { id: 'friend', label: 'A friend, here' }]} />
      <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
        {value === 'computer'
          ? 'Play against the computer at the strength below.'
          : 'Two people, one device: take turns on the same board. Switching starts a new game.'}
      </p>
    </section>
  );
}

/** Whether the board turns round after every move, so the player to move always has it the right way up. */
export type Turning = 'turn' | 'still';

export function TurningCard({ value, onChange }: { value: Turning; onChange: (t: Turning) => void }) {
  return (
    <section className="card">
      <h3>The board</h3>
      <Segmented label="The board" value={value} onChange={onChange} block
        options={[{ id: 'turn', label: 'Turns each move' }, { id: 'still', label: 'Stays put' }]} />
      <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
        {value === 'turn'
          ? 'For passing the device: whoever is to move always has their pieces at the bottom.'
          : 'For a device lying flat between you: the board never moves.'}
      </p>
    </section>
  );
}
