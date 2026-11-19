import { m } from './messages';
import { isOwnable, rentLadder, type BoardDef } from './boards';
import { hasMonopoly, rentFor, seatOf, type MonopolyState } from './rules';
import { Token } from './Icons';
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
    <Sheet open title={space.kind === 'property' || isOwnable(space) ? (space as { name: string }).name : 'name' in space ? space.name : ((m().spaces as Record<string, string>)[space.kind] ?? m().spaces.space)} onClose={onClose}>
      <div className="col">
        {group && (
          <span className="space-band" style={{ background: group.color }} aria-hidden />
        )}

        {!isOwnable(space) && (
          <p style={{ margin: 0 }}>
            {space.kind === 'tax' ? m().sheet.pay(money(space.amount))
              : space.kind === 'go' ? m().sheet.collect(money(board.salary))
              : space.kind === 'jail' ? m().sheet.visiting
              : space.kind === 'gotojail' ? m().sheet.straightToJail
              : space.kind === 'parking' ? m().sheet.nothing
              : m().sheet.drawCard}
          </p>
        )}

        {isOwnable(space) && (
          <>
            <ul className="list">
              <li><span className="muted">{m().sheet.price}</span><strong>{money(space.price)}</strong></li>
              <li>
                <span className="muted">{m().sheet.owner}</span>
                <strong>
                  {ownerSeat
                    ? <span className="row" style={{ gap: 6 }}>
                        <Token token={ownerSeat.token} color={ownerSeat.color} size={20} />{firstName(ownerSeat.name)}
                      </span>
                    : m().sheet.unowned}
                </strong>
              </li>
              {owner && (
                <li>
                  <span className="muted">{m().sheet.rentNow}</span>
                  <strong>
                    {space.kind === 'utility'
                      ? m().sheet.timesDice(rentFor(state, index, 1))
                      : money(rentFor(state, index, 7))}
                  </strong>
                </li>
              )}
              {group && (
                <li><span className="muted">{m().sheet.houses}</span><strong>{houses >= 5 ? m().sheet.hotel : houses || m().sheet.none}</strong></li>
              )}
              {group && (
                <li><span className="muted">{m().sheet.houseCosts}</span><strong>{money(group.houseCost)}</strong></li>
              )}
              {owner && space.kind === 'property' && (
                <li>
                  <span className="muted">{m().sheet.fullSet}</span>
                  <strong>{hasMonopoly(state, owner, space.group) ? m().sheet.doubled : m().sheet.no}</strong>
                </li>
              )}
            </ul>

            {space.kind === 'property' && (
              <div>
                <h3>{m().sheet.rentWithHouses}</h3>
                <ul className="list">
                  {rentLadder(space.price).map((rent, built) => (
                    <li key={built} className={built === Math.min(houses, 5) && !!owner ? 'now' : undefined}>
                      <span className="muted">
                        {built === 0 ? m().sheet.noHouses : built === 5 ? m().sheet.hotel : m().houses(built)}
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
