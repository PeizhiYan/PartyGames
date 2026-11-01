import { isOwnable, rentLadder, type BoardDef } from './boards';
import { hasMonopoly, rentFor, seatOf, type MonopolyState } from './rules';
import Sheet from '../../ui/Sheet';
import { firstName } from '../../lib/format';

/**
 * Everything about one space, which on a phone is the only place it can be read.
 *
 * The ring is a map — colour, ownership, who is standing where. The words live here, reached by
 * tapping, rather than being crushed into a 32px cell nobody can read.
 */
export default function SpaceSheet({ state, board, index, onClose }: {
  state: MonopolyState;
  board: BoardDef;
  index: number | null;
  onClose: () => void;
}) {
  const space = index === null ? undefined : board.spaces[index];
  const money = (n: number) => `${board.currency}${n.toLocaleString()}`;

  if (!space || index === null) return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;

  const owner = state.owned[index];
  const ownerSeat = owner ? seatOf(state, owner) : undefined;
  const houses = state.houses[index] ?? 0;
  const group = space.kind === 'property' ? board.groups[space.group] : undefined;

  return (
    <Sheet open title={space.kind === 'property' || isOwnable(space) ? (space as { name: string }).name : 'Space'} onClose={onClose}>
      <div className="col">
        {group && (
          <span className="space-band" style={{ background: group.color }} aria-hidden />
        )}

        {!isOwnable(space) && (
          <p style={{ margin: 0 }}>
            {space.kind === 'tax' ? `Pay ${money(space.amount)}.`
              : space.kind === 'go' ? `Collect ${money(board.salary)} as you pass.`
              : space.kind === 'jail' ? 'Just visiting, unless you were sent here.'
              : space.kind === 'gotojail' ? 'Straight to jail. Do not pass Go.'
              : space.kind === 'parking' ? 'Nothing happens here.'
              : 'Draw a card.'}
          </p>
        )}

        {isOwnable(space) && (
          <>
            <ul className="list">
              <li><span className="muted">Price</span><strong>{money(space.price)}</strong></li>
              <li>
                <span className="muted">Owner</span>
                <strong>
                  {ownerSeat
                    ? <span className="row" style={{ gap: 6 }}>
                        <span aria-hidden>{ownerSeat.token}</span>{firstName(ownerSeat.name)}
                      </span>
                    : 'Unowned'}
                </strong>
              </li>
              {owner && (
                <li>
                  <span className="muted">Rent now</span>
                  <strong>
                    {space.kind === 'utility'
                      ? `${rentFor(state, index, 1)}× the dice`
                      : money(rentFor(state, index, 7))}
                  </strong>
                </li>
              )}
              {group && (
                <li><span className="muted">Houses</span><strong>{houses >= 5 ? 'Hotel' : houses || 'None'}</strong></li>
              )}
              {group && (
                <li><span className="muted">House costs</span><strong>{money(group.houseCost)}</strong></li>
              )}
              {owner && space.kind === 'property' && (
                <li>
                  <span className="muted">Full set?</span>
                  <strong>{hasMonopoly(state, owner, space.group) ? 'Yes — rent is doubled' : 'No'}</strong>
                </li>
              )}
            </ul>

            {space.kind === 'property' && (
              <div>
                <h3>Rent with houses</h3>
                <ul className="list">
                  {rentLadder(space.price).map((rent, built) => (
                    <li key={built} className={built === Math.min(houses, 5) && !!owner ? 'now' : undefined}>
                      <span className="muted">
                        {built === 0 ? 'No houses' : built === 5 ? 'Hotel' : `${built} house${built > 1 ? 's' : ''}`}
                      </span>
                      <strong className="tabular">{money(rent)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
