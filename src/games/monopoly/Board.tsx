import type { CSSProperties } from 'react';
import { isOwnable, type BoardDef, type Space } from './boards';
import { boardLayout, gridPosition, ringPosition, ringSide } from './layout';
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
 * The board, laid out two ways.
 *
 * Wide screens get **the ring**, the way a board is printed, because there is room for it.
 * Narrow screens get **rows that alternate direction**, because a ring on a phone spends most of
 * its area on a hole and squeezes the spaces too small to read — see `./layout`.
 *
 * Both positions are written onto every tile as custom properties and the switch is a media
 * query, so there is no resize listener and no flash of the wrong layout.
 */
export default function Board({ state, board, uid, onSelect }: {
  state: MonopolyState;
  board: BoardDef;
  uid: string;
  onSelect?: (index: number) => void;
}) {
  const count = board.spaces.length;
  const { cols, rows } = boardLayout(count);
  const side = ringSide(count);

  return (
    <div className="mono-board" style={{ '--cols': cols, '--ring': side } as CSSProperties}>
      {/*
        One lane per row of the narrow layout, drawn behind the tiles. Without them the rows run
        together and the back-and-forth order is genuinely hard to follow; the arrow marks where
        each row hands over to the next. Hidden entirely on the ring.
      */}
      {Array.from({ length: rows }, (_, r) => (
        <span
          key={`lane-${r}`}
          className="mono-lane"
          data-turn={r === rows - 1 ? 'none' : r % 2 === 0 ? 'right' : 'left'}
          style={{ gridRow: r + 1, gridColumn: '1 / -1' } as CSSProperties}
          aria-hidden
        />
      ))}

      {board.spaces.map((space, index) => {
        const grid = gridPosition(index, cols);
        const ring = ringPosition(index, count);
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
            style={{
              '--g-row': grid.row, '--g-col': grid.col,
              '--r-row': ring.row, '--r-col': ring.col,
              borderColor: ownerSeat?.color ?? undefined,
            } as CSSProperties}
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

      {/* The middle of the ring. Not rendered at all in the narrow layout, which has no middle. */}
      <span className="mono-centre" aria-hidden>{board.name}</span>
    </div>
  );
}
