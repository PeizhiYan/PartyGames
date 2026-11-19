import { t } from '../../i18n';
import Icon from '../../ui/Icon';

/**
 * What the host of a room may do about computer players before a game starts. Handed to a
 * table only by a room, only for its host; a solo game decides its players on the setup screen.
 */
export interface Seating {
  /** Seats the next computer player. Absent while the room is full. */
  add?: () => void;
  remove: (uid: string) => void;
}

/** A dashed empty seat that seats a computer when tapped. */
export function AddComputer({ onAdd, size = 52, label = t.cast.addComputer }: { onAdd: () => void; size?: number; label?: string }) {
  return (
    <button type="button" className="seat-add" onClick={onAdd}>
      <span className="seat-add-ring" style={{ width: size, height: size }} aria-hidden><Icon name="plus" size={Math.round(size * 0.42)} /></span>
      <span className="seat-name">{label}</span>
    </button>
  );
}

/** The little cross on a computer's face that takes it out of the room. */
export function RemoveComputer({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button type="button" className="seat-remove" aria-label={t.cast.removeComputer(name)} onClick={onRemove}>
      <Icon name="close" size={12} />
    </button>
  );
}
