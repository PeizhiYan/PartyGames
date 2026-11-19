import { useState, type CSSProperties } from 'react';
import Die from '../../ui/Die';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
import Character from '../cast/Character';
import Confetti from '../cast/Confetti';
import Seat from '../cast/Seat';
import { AddComputer, RemoveComputer, type Seating } from '../cast/Seating';
import { isComputer } from '../local';
import { assignSpecies } from '../cast/cast';
import { bubbleFor, expressionFor, useMoments, type Detect } from '../cast/moments';
import { EXAMPLES } from './help';
import { m } from './messages';
import { t } from '../../i18n';
import {
  CATEGORIES, LOWER, ROLLS_PER_TURN, UPPER, UPPER_BONUS, UPPER_BONUS_AT, YAHTZEE_BONUS, choices,
  currentSeat, grandTotal, ranking, throwFive, upperBonus, upperTotal,
  type Category, type Seat as SeatState, type YahtzeeAction, type YahtzeeState,
} from './rules';
import { firstName } from '../../lib/format';
import './Yahtzee.css';

export interface TableProps {
  state: YahtzeeState;
  uid: string;
  act: (action: YahtzeeAction) => unknown;
  busy: boolean;
  error: string;
  /** The host starts each game. */
  owner: boolean;
  /** The host's controls for computer players, in a room's lobby. */
  seating?: Seating;
  /**
   * Several people are playing on this one device, and `uid` is whoever holds it now. Everyone
   * is then called by name: "You" would mean a different person every turn.
   */
  hotseat?: boolean;
}

/** Notices boxes being filled, so the card can flash them and the faces can react. */
const detect: Detect<YahtzeeState> = (prev, next) => {
  const out: ReturnType<Detect<YahtzeeState>> = [];
  for (const seat of next.seats) {
    const before = prev.seats.find((s) => s.uid === seat.uid);
    if (!before) continue;
    for (const c of CATEGORIES) {
      if (before.card[c] !== undefined || seat.card[c] === undefined) continue;
      const points = seat.card[c]!;
      const name = firstName(seat.name);
      if (c === 'yahtzee' && points === 50) {
        out.push({ kind: 'yahtzee', uid: seat.uid, text: m().yahtzeeShout, tone: 'gold', expression: 'happy', ttl: 2800, data: { category: c } });
      } else {
        out.push({
          kind: 'score', uid: seat.uid, ttl: 2200, data: { category: c, points, name },
          expression: points === 0 ? 'sad' : points >= 25 ? 'happy' : undefined,
          text: points >= 25 ? `+${points}!` : undefined, tone: points >= 25 ? 'gold' : undefined,
        });
      }
    }
    if (seat.yahtzeeBonuses > (before.yahtzeeBonuses ?? 0)) {
      out.push({ kind: 'yahtzee', uid: seat.uid, text: m().bonusShout(YAHTZEE_BONUS), tone: 'gold', expression: 'happy', ttl: 2800 });
    }
  }
  return out;
};

/** A die's tumble is a pure function of where it is and which roll this is, so it never reshuffles. */
const tumble = (i: number, roll: number): CSSProperties => ({
  '--spin': `${((i * 97 + roll * 61) % 3 === 0 ? -1 : 1) * (360 + ((i * 53 + roll * 29) % 180))}deg`,
  '--hop': `${-24 - ((i * 31 + roll * 17) % 18)}px`,
  animationDelay: `${i * 45}ms`,
} as CSSProperties);

/**
 * The whole Yahtzee screen, for both the room and the solo game.
 *
 * On a wide screen: a felt dice tray on the left, a paper scorecard on the right. On a phone the
 * card comes first and the tray docks to the bottom of the screen, so a whole turn — roll, hold,
 * roll, score — happens without scrolling.
 */
export default function YahtzeeTable({ state, uid, act, busy, error, owner, seating, hotseat }: TableProps) {
  const [help, setHelp] = useState<Category | 'bonus' | 'zero' | null>(null);
  const moments = useMoments(state, detect);
  const looks = assignSpecies(state.seats.map((s) => s.uid));
  const nameOf = (s: { uid: string; name: string }) => (!hotseat && s.uid === uid ? t.common.you : firstName(s.name));

  if (state.phase === 'lobby') {
    return (
      <div className="yz-lobby">
        <h2>{m().aroundTable}</h2>
        <div className="yz-lobby-seats">
          {state.seats.map((s) => (
            <Seat key={s.uid} uid={s.uid} species={looks[s.uid]} name={nameOf(s)} size={56}
              corner={seating && isComputer(s.uid) ? <RemoveComputer name={s.name} onRemove={() => seating.remove(s.uid)} /> : undefined} />
          ))}
          {seating?.add && <AddComputer onAdd={seating.add} size={56} />}
        </div>
        <p className="muted">
          {m().lobbyBlurb}
        </p>
        {owner
          ? <button type="button" className="primary" disabled={busy || state.seats.length < 1} onClick={() => act({ type: 'start' })}>
              {m().startWith(state.seats.length)}
            </button>
          : <p className="empty">{m().waitingStart}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  const current = currentSeat(state);
  const me = state.seats.find((s) => s.uid === uid);
  const myTurn = state.phase === 'playing' && current?.uid === uid;
  const rollsLeft = ROLLS_PER_TURN - state.rolls;
  const rolled = state.rolls > 0;
  const options = myTurn && me && rolled ? choices(me, state.dice) : [];
  const best = options.length ? options.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const celebrating = moments.some((m) => m.kind === 'yahtzee');
  const lastScore = [...moments].reverse().find((m) => m.kind === 'score' || m.kind === 'yahtzee');
  const fresh = new Set(moments.filter((m) => m.kind === 'score' || m.kind === 'yahtzee')
    .map((m) => `${m.uid}:${m.data?.category as string}`));

  const faceOf = (s: SeatState) => expressionFor(moments, s.uid,
    state.phase === 'results'
      ? (ranking(state)[0]?.uid === s.uid ? 'happy' : 'idle')
      : s.uid === current?.uid && isComputer(s.uid) ? 'thinking' : 'idle');

  return (
    <div className={`yz${state.phase === 'results' ? ' done' : ''}`}>
      {state.phase === 'results' && <Results state={state} nameOf={nameOf} owner={owner} busy={busy} act={act} species={looks} />}

      <section className="yz-sheet" aria-label={m().scorecard}>
        <div className="yz-card-wrap">
          <table className="yz-card">
            <thead>
              <tr>
                <th scope="col" className="yz-corner">
                  <button type="button" className="link-button" onClick={() => setHelp('zero')}>{m().howScoring}</button>
                </th>
                {state.seats.map((s) => (
                  <th key={s.uid} scope="col" className={s.uid === current?.uid && state.phase === 'playing' ? 'turn' : ''}>
                    <span className="yz-head">
                      <span className="yz-head-face">
                        <Character uid={s.uid} species={looks[s.uid]} size={30} expression={faceOf(s)} />
                        {bubbleFor(moments, s.uid) && <span key={bubbleFor(moments, s.uid)!.key} className={`bubble ${bubbleFor(moments, s.uid)!.tone ?? ''}`}>{bubbleFor(moments, s.uid)!.text}</span>}
                      </span>
                      <span className="yz-head-name">{nameOf(s)}</span>
                      <strong className="yz-head-total">{grandTotal(s)}</strong>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UPPER.map((c) => <Row key={c} c={c} state={state} uid={uid} options={options} best={best?.category} fresh={fresh}
                busy={busy} onHelp={setHelp} onPick={(category) => act({ type: 'score', category })} />)}
              <tr className="yz-sub">
                <th scope="row">
                  <button type="button" className="yz-name" onClick={() => setHelp('bonus')}>
                    {m().bonus} <Icon name="info" size={13} />
                  </button>
                  <small className="yz-desc">{m().bonusShort(UPPER_BONUS_AT, UPPER_BONUS)}</small>
                </th>
                {state.seats.map((s) => {
                  const up = upperTotal(s);
                  return (
                    <td key={s.uid}>
                      {upperBonus(s)
                        ? <strong className="yz-bonus-won">+{UPPER_BONUS}</strong>
                        : <span className="yz-meter" title={m().meter(up, UPPER_BONUS_AT)}>
                            <span style={{ width: `${Math.min(100, (up / UPPER_BONUS_AT) * 100)}%` }} />
                            <small>{up}/{UPPER_BONUS_AT}</small>
                          </span>}
                    </td>
                  );
                })}
              </tr>
              {LOWER.map((c) => <Row key={c} c={c} state={state} uid={uid} options={options} best={best?.category} fresh={fresh}
                busy={busy} onHelp={setHelp} onPick={(category) => act({ type: 'score', category })} />)}
              {state.seats.some((s) => s.yahtzeeBonuses > 0) && (
                <tr className="yz-sub">
                  <th scope="row"><span className="yz-name static">{m().yahtzeeBonus}</span></th>
                  {state.seats.map((s) => <td key={s.uid}>{s.yahtzeeBonuses ? `+${s.yahtzeeBonuses * YAHTZEE_BONUS}` : '—'}</td>)}
                </tr>
              )}
              <tr className="yz-total">
                <th scope="row">{m().total}</th>
                {state.seats.map((s) => <td key={s.uid}>{grandTotal(s)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {state.phase === 'playing' && (
        <section className={`yz-tray${myTurn ? ' mine' : ''}`} aria-label={m().dice}>
          <div className="yz-tray-head">
            {current && <Character uid={current.uid} species={looks[current.uid]} size={34} expression={faceOf(current)} />}
            <div className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate" style={{ display: 'block' }}>
                {myTurn && !hotseat ? t.cast.yourTurn : t.cast.turnOf(firstName(current?.name ?? ''))}
              </strong>
              <small className="muted">
                {lastScore?.data?.name
                  ? m().scored(lastScore.data.name as string, lastScore.data.points as number, m().categories[lastScore.data.category as Category])
                  : m().round(Math.min(13, state.round + 1))}
              </small>
            </div>
            <span className="yz-pips" aria-label={m().rollsLeft(rollsLeft)}>
              {Array.from({ length: ROLLS_PER_TURN }, (_, i) => <i key={i} className={i < rollsLeft ? 'left' : ''} />)}
            </span>
          </div>

          <div className="yz-dice" key={`${state.turn}-${state.round}-${state.rolls}`}>
            {state.dice.map((value, i) => (
              <span key={i} className={`yz-die-slot${rolled && !state.held[i] ? ' tumble' : ''}${!rolled ? ' idle' : ''}`}
                style={rolled && !state.held[i] ? tumble(i, state.rolls + state.round * 3) : undefined}>
                <Die value={value} held={state.held[i]}
                  onToggle={myTurn && rolled && rollsLeft > 0 && !busy
                    ? () => act({ type: 'hold', index: i, held: !state.held[i] })
                    : undefined} />
                <small className="yz-held-tag">{state.held[i] ? m().kept : ''}</small>
              </span>
            ))}
          </div>

          <div className="yz-tray-foot">
            <button type="button" className="primary yz-roll" disabled={!myTurn || rollsLeft <= 0 || busy}
              onClick={() => act({ type: 'roll', dice: throwFive() })}>
              <Icon name="dice" size={18} />
              {!rolled ? m().rollButton : rollsLeft > 0 ? m().rollAgain(rollsLeft) : m().pickBox}
            </button>
            <span className="yz-hint">
              {!myTurn ? m().watch
                : !rolled ? m().threeRolls
                : best ? <>{m().best}<strong>{m().categories[best.category]}</strong> · {best.score}</>
                : m().pickToScore}
            </span>
          </div>
          {celebrating && <div className="yz-celebrate"><span>YAHTZEE!</span><Confetti /></div>}
        </section>
      )}

      {error && <p className="error row center">{error}</p>}

      <Sheet open={help !== null} title={help === 'bonus' ? m().upperBonus : help === 'zero' ? m().howScoring : help ? m().categories[help] : ''}
        onClose={() => setHelp(null)}>
        {help === 'bonus' && <p style={{ margin: 0 }}>{m().bonusHelp}</p>}
        {help === 'zero' && (
          <div className="col">
            <p style={{ margin: 0 }}>{m().howToPlay}</p>
            <p style={{ margin: 0 }}>{m().zeroHelp}</p>
            <p style={{ margin: 0 }}>{m().bonusHelp}</p>
          </div>
        )}
        {help && help !== 'bonus' && help !== 'zero' && (
          <div className="col">
            <p style={{ margin: 0 }}>{m().help[help].long}</p>
            <div className="yz-example">
              {EXAMPLES[help].example.map((v, i) => <Die key={i} value={v} />)}
              <span className="yz-example-score">= {EXAMPLES[help].scores}</span>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Row({ c, state, uid, options, best, fresh, busy, onHelp, onPick }: {
  c: Category;
  state: YahtzeeState;
  uid: string;
  options: { category: Category; score: number }[];
  best?: Category;
  fresh: Set<string>;
  busy: boolean;
  onHelp: (c: Category) => void;
  onPick: (c: Category) => void;
}) {
  const current = currentSeat(state);
  return (
    <tr>
      <th scope="row">
        <button type="button" className="yz-name" onClick={() => onHelp(c)} aria-label={m().whatIsThis(m().categories[c])}>
          {m().categories[c]} <Icon name="info" size={13} />
        </button>
        <small className="yz-desc">{m().help[c].short}</small>
      </th>
      {state.seats.map((s) => {
        const filled = s.card[c];
        const option = s.uid === uid ? options.find((o) => o.category === c) : undefined;
        const live = s.uid === current?.uid && state.phase === 'playing';
        return (
          <td key={s.uid} className={`${live ? 'turn' : ''}${fresh.has(`${s.uid}:${c}`) ? ' fresh' : ''}`}>
            {filled !== undefined
              ? <span className={`yz-filled${filled === 0 ? ' zero' : ''}`}>{filled}</span>
              : option
                ? <button type="button" className={`yz-pick${option.score === 0 ? ' zero' : ''}${best === c && option.score > 0 ? ' best' : ''}`}
                    disabled={busy} onClick={() => onPick(c)} aria-label={m().scoreIn(option.score, m().categories[c])}>
                    {option.score}
                  </button>
                : <span className="yz-empty" />}
          </td>
        );
      })}
    </tr>
  );
}

function Results({ state, nameOf, owner, busy, act, species }: Pick<TableProps, 'state' | 'owner' | 'busy' | 'act'> & {
  species: ReturnType<typeof assignSpecies>;
  nameOf: (s: SeatState) => string;
}) {
  const order = ranking(state);
  const winner = order[0];
  // Everyone level on the top score shares it; "You win!" for a tie would be a lie.
  const top = grandTotal(winner);
  const winners = order.filter((s) => grandTotal(s) === top);
  const names = winners.map((s) => (nameOf(s) === t.common.you ? m().you : nameOf(s)));
  return (
    <section className="yz-results">
      <Confetti />
      <Character uid={winner.uid} species={species[winner.uid]} size={72} expression="happy" />
      <h2>
        {winners.length > 1
          ? m().tie(t.common.list(names))
          : nameOf(winner) === t.common.you ? m().youWin : m().wins(nameOf(winner))}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {order.map((s, i) => `${i + 1}. ${nameOf(s)} ${grandTotal(s)}`).join('   ·   ')}
      </p>
      {owner
        ? <button type="button" className="primary" disabled={busy} onClick={() => act({ type: 'again' })}>{t.cast.playAgain}</button>
        : <p className="empty" style={{ margin: 0 }}>{m().waitingAnother}</p>}
    </section>
  );
}
