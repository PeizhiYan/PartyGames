import { isOwnable, type BoardDef, type Space } from './boards';
import { seatOf, spacesPerSide, type MonopolyState } from './rules';
import './Board.css';

/**
 * Where a space sits on screen.
 *
 * The ring is laid out on a square CSS grid of (side + 2)². Go is the bottom-right corner and
 * play runs anticlockwise — left along the bottom, up the left side, right along the top, down
 * the right — which is the way a real board is printed.
 */
export function gridPosition(index: number, side: number): { row: number; col: number } {
  const n = side + 2;
  if (index === 0) return { row: n, col: n };
  if (index <= side) return { row: n, col: n - index };
  if (index === side + 1) return { row: n, col: 1 };
  if (index <= 2 * side + 1) return { row: n - (index - side - 1), col: 1 };
  if (index === 2 * side + 2) return { row: 1, col: 1 };
  if (index <= 3 * side + 2) return { row: 1, col: index - (2 * side + 2) + 1 };
  if (index === 3 * side + 3) return { row: 1, col: n };
  return { row: index - (3 * side + 3) + 1, col: n };
}

const SHORT: Record<Space['kind'], string> = {
  go: 'GO', jail: 'Jail', parking: 'Free', gotojail: 'Go to jail',
  chance: '?', chest: 'Chest', tax: 'Tax', property: '', rail: '', utility: '',
};

function label(space: Space): string {
  return 'name' in space ? space.name : SHORT[space.kind];
}

/** The ring, with everyone's token on it. Read-only: all the controls live under it. */
export default function Board({ state, board, uid }: { state: MonopolyState; board: BoardDef; uid: string }) {
  const side = spacesPerSide(board);
  const n = side + 2;

  return (
    <div className="mono-board" style={{ '--n': n } as React.CSSProperties}>
      {board.spaces.map((space, index) => {
        const { row, col } = gridPosition(index, side);
        const owner = state.owned[index];
        const ownerSeat = owner ? seatOf(state, owner) : undefined;
        const houses = state.houses[index] ?? 0;
        const here = state.seats.filter((s) => !s.bankrupt && s.position === index);
        const stripe = space.kind === 'property' ? board.groups[space.group]?.color : undefined;
        const corner = index % (side + 1) === 0;

        return (
          <div
            key={index}
            className={`mono-space${corner ? ' corner' : ''}${owner ? ' owned' : ''}`}
            style={{ gridRow: row, gridColumn: col, borderColor: ownerSeat?.color ?? undefined }}
            title={isOwnable(space) ? `${space.name} · ${board.currency}${space.price}` : label(space)}
          >
            {stripe && <span className="mono-stripe" style={{ background: stripe }} aria-hidden />}
            <span className="mono-name">{label(space)}</span>
            {isOwnable(space) && !owner && (
              <span className="mono-price">{board.currency}{space.price}</span>
            )}
            {houses > 0 && (
              <span className="mono-houses" aria-label={`${houses} built`}>
                {houses >= 5 ? '🏨' : '🏠'.repeat(houses)}
              </span>
            )}
            {here.length > 0 && (
              <span className="mono-tokens">
                {here.map((s) => (
                  <span key={s.uid} className={`mono-token${s.uid === uid ? ' mine' : ''}`}
                    style={{ borderColor: s.color ?? undefined }}>
                    {s.token}
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
      <div className="mono-centre" style={{ gridRow: `2 / ${n}`, gridColumn: `2 / ${n}` }}>
        <strong>{board.name}</strong>
        {state.card && <p className="mono-card">{state.card.text}</p>}
      </div>
    </div>
  );
}
