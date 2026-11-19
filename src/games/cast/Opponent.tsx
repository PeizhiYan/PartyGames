import { t } from '../../i18n';
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
export function OpponentCard({ value, onChange, computer = t.cast.theComputer }: {
  value: Opponent;
  onChange: (o: Opponent) => void;
  /** What the computer is called in this game. */
  computer?: string;
}) {
  return (
    <section className="card">
      <h3>{t.cast.opponent}</h3>
      <Segmented label={t.cast.opponent} value={value} onChange={onChange} block
        options={[{ id: 'computer', label: computer }, { id: 'friend', label: t.cast.aFriend }]} />
      <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
        {value === 'computer' ? t.cast.vsComputerHelp : t.cast.vsFriendHelp}
      </p>
    </section>
  );
}

/** Whether the board turns round after every move, so the player to move always has it the right way up. */
export type Turning = 'turn' | 'still';

export function TurningCard({ value, onChange }: { value: Turning; onChange: (t: Turning) => void }) {
  return (
    <section className="card">
      <h3>{t.cast.board}</h3>
      <Segmented label={t.cast.board} value={value} onChange={onChange} block
        options={[{ id: 'turn', label: t.cast.turns }, { id: 'still', label: t.cast.still }]} />
      <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
        {value === 'turn' ? t.cast.turnsHelp : t.cast.stillHelp}
      </p>
    </section>
  );
}
