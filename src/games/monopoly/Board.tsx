import type { CSSProperties } from 'react';
import { isOwnable, type BoardDef, type Space } from './boards';
import { boardLayout, gridPosition } from './layout';
import { seatOf, type MonopolyState } from './rules';
import './Board.css';

/** What a space with no name of its own is called. */
const SHORT: Partial<Record<Space['kind'], string>> = {
  go: 'GO', jail: 'Jail', parking: 'Free parking', gotojail: 'Go to jail',
  chance: 'Chance', chest: 'Chest',
};

/** A picture for the spaces a colour band cannot describe. */
const GLYPH: Partial<Record<Space['kind'], string>> = {
  go: '→', jail: '🔒', parking: '🅿️', gotojail: '🚨',
  chance: '❓', chest: '🎁', tax: '💸', rail: '🚆', utility: '💡',
};

const label = (space: Space): string => ('name' in space ? space.name : SHORT[space.kind] ?? space.kind);

/**
 * The board: every space, filling the whole rectangle.
 *
 * Laid out in rows that alternate direction rather than as a hollow ring — see `./layout` for
 * why. The upshot is tiles three to four times the area, which is the difference between a name
 * you can read and "Main C…". Tapping one opens its full detail.
 */
export default function Board({ state, board, uid, onSelect }: {
  state: MonopolyState;
  board: BoardDef;
  uid: string;
  onSelect?: (index: number) => void;
}) {
  const { cols } = boardLayout(board.spaces.length);

  return (
    <div className="mono-board" style={{ '--cols': cols } as CSSProperties}>
      {board.spaces.map((space, index) => {
        const { row, col } = gridPosition(index, cols);
        const owner = state.owned[index];
        const ownerSeat = owner ? seatOf(state, owner) : undefined;
        const houses = state.houses[index] ?? 0;
        const here = state.seats.filter((s) => !s.bankrupt && s.position === index);
        const band = space.kind === 'property' ? board.groups[space.group]?.color : undefined;

        return (
          <button
            type="button"
            key={index}
            className={`mono-space${isOwnable(space) ? '' : ' special'}${owner ? ' owned' : ''}`}
            style={{ gridRow: row, gridColumn: col, borderColor: ownerSeat?.color ?? undefined }}
            onClick={() => onSelect?.(index)}
            aria-label={isOwnable(space) ? `${space.name}, ${board.currency}${space.price}` : label(space)}
          >
            {band && <span className="mono-band" style={{ background: band }} aria-hidden />}
            {/* Rows run alternately left-to-right and right-to-left, which is not something you
                can see. The number says which way, and doubles as something to count moves on. */}
            <span className="mono-index" aria-hidden>{index}</span>
            <span className="mono-body">
              {!band && <span className="mono-glyph" aria-hidden>{GLYPH[space.kind]}</span>}
              <span className="mono-name">{label(space)}</span>
              {isOwnable(space) && (
                <span className="mono-price">
                  {ownerSeat
                    ? <span className="mono-owner" style={{ color: ownerSeat.color ?? undefined }}>
                        {ownerSeat.token} {houses > 0 && (houses >= 5 ? '🏨' : '🏠'.repeat(houses))}
                      </span>
                    : `${board.currency}${space.price.toLocaleString()}`}
                </span>
              )}
              {space.kind === 'tax' && (
                <span className="mono-price">{board.currency}{space.amount.toLocaleString()}</span>
              )}
            </span>
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
          </button>
        );
      })}
    </div>
  );
}
