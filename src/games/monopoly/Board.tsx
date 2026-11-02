import { Fragment, type CSSProperties } from 'react';
import { isOwnable, type BoardDef, type Space } from './boards';
import { ThrownDice } from './Dice';
import { SpaceIcon, Token } from './Icons';
import Skyline from './Skyline';
import { boardLayout, coilCount, ringPosition, ringSide, spiralPosition } from './layout';
import { seatOf, type MonopolyState } from './rules';
import './Board.css';

/** What a space with no name of its own is called. */
const SHORT: Partial<Record<Space['kind'], string>> = {
  go: 'GO', jail: 'Jail', parking: 'Free parking', gotojail: 'Go to jail',
  chance: 'Chance', chest: 'Chest',
};

const label = (space: Space): string => ('name' in space ? space.name : SHORT[space.kind] ?? space.kind);

/** Which side of the ring a tile is on, so its colour band can face inwards. */
function ringEdge({ row, col }: { row: number; col: number }, side: number): string {
  const vertical = row === 1 || row === side;
  const horizontal = col === 1 || col === side;
  if (vertical && horizontal) return 'corner';
  if (row === 1) return 'top';
  if (row === side) return 'bottom';
  return col === 1 ? 'left' : 'right';
}

/**
 * The board, laid out two ways.
 *
 * Wide screens get **the ring**, the way a board is printed, because there is room for it.
 * Narrow screens get **a spiral**, because a ring on a phone spends most of its area on a hole
 * and squeezes the spaces too small to read — see `./layout`.
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
        One outline per lap of the spiral, so you can see which lap a tile is on — two tiles
        side by side across a boundary are twenty spaces apart.
      */}
      {Array.from({ length: coilCount(cols, rows) }, (_, k) => {
        // Every lap after the first is entered at its own top-left corner, so that is where
        // its wall has to open. The left side is drawn as a second element starting a row
        // lower rather than painted over afterwards: erasing left either a stub of line or a
        // notch in the top edge, and both read as the border having failed to draw.
        const open = k > 0;
        const sideFrom = k + 2;
        const sideTo = rows - k + 1;
        return (
          <Fragment key={`coil-${k}`}>
            <span
              className={`mono-coil${open ? ' open' : ''}`}
              style={{
                '--c-r1': k + 1, '--c-r2': rows - k + 1,
                '--c-c1': k + 1, '--c-c2': cols - k + 1,
              } as CSSProperties}
              aria-hidden
            />
            {open && sideFrom < sideTo && (
              <span
                className="mono-coil-side"
                style={{ '--c-r1': sideFrom, '--c-r2': sideTo, '--c-c1': k + 1 } as CSSProperties}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}

      {board.spaces.map((space, index) => {
        const grid = spiralPosition(index, cols, rows);
        const ring = ringPosition(index, count);
        const owner = state.owned[index];
        const ownerSeat = owner ? seatOf(state, owner) : undefined;
        const houses = state.houses[index] ?? 0;
        const here = state.seats.filter((s) => !s.bankrupt && s.position === index);
        const band = space.kind === 'property' ? board.groups[space.group]?.color : undefined;
        // Which edge of the ring this tile sits on, so its colour band can face the middle the
        // way a printed board's does. Meaningless in the spiral, where the CSS ignores it.
        const edge = ringEdge(ring, side);

        return (
          <Fragment key={index}>
          <button
            type="button"
            className={`mono-space${isOwnable(space) ? '' : ' special'}${owner ? ' owned' : ''}`
              + `${here.length > 0 ? ' has-tokens' : ''}`}
            data-edge={edge}
            style={{
              '--g-row': grid.row, '--g-col': grid.col,
              '--r-row': ring.row, '--r-col': ring.col,
              borderColor: ownerSeat?.color ?? undefined,
            } as CSSProperties}
            onClick={() => onSelect?.(index)}
            aria-label={isOwnable(space) ? `${space.name}, ${board.currency}${space.price}` : label(space)}
          >
            {band && <span className="mono-band" style={{ background: band }} aria-hidden />}
            {/* A spiral is only obvious once you have found the end of it. The number says where
                you are in the order, and doubles as something to count moves on. */}
            <span className="mono-index" aria-hidden>{index}</span>
            {/* The one step the arrows cannot draw: the last space is in the middle here, not
                next to GO, so the way back has to be written down. */}
            {index === count - 1 && <span className="mono-wrap">↺ 0</span>}
            <span className="mono-body">
              {!band && <SpaceIcon kind={space.kind} />}
              <span className="mono-name">{label(space)}</span>
              {isOwnable(space) && (
                <span className="mono-price">
                  {ownerSeat
                    ? <span className="mono-owner">
                        <Token token={ownerSeat.token} color={ownerSeat.color} size={13} />
                        {houses > 0 && <b>{houses >= 5 ? 'H' : houses}</b>}
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
                  <Token key={s.uid} token={s.token} color={s.color} size={22} ring={s.uid === uid} />
                ))}
              </span>
            )}
          </button>
          </Fragment>
        );
      })}

      {/*
        The middle of the ring: the city it is, and where the dice land. Not rendered at all in
        the narrow layout, which has no middle. The dice are keyed on the roll's timestamp
        because the throw is a CSS animation and only a fresh element replays it.
      */}
      <span className="mono-centre" aria-hidden>
        <Skyline id={board.id} />
        <span className="mono-centre-name">{board.name}</span>
        {state.lastRoll && <ThrownDice key={state.lastRoll.at} dice={state.lastRoll.dice} />}
      </span>
    </div>
  );
}
