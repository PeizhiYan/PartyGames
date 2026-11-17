import { useState, type CSSProperties } from 'react';
import Die from '../../ui/Die';
import Icon from '../../ui/Icon';
import Sheet from '../../ui/Sheet';
import Character from '../cast/Character';
import Confetti from '../cast/Confetti';
import Seat from '../cast/Seat';
import { isComputer } from '../local';
import { assignSpecies } from '../cast/cast';
import { bubbleFor, expressionFor, useMoments, type Detect } from '../cast/moments';
import { BONUS_HELP, HELP, ZERO_HELP } from './help';
import {
  CATEGORIES, CATEGORY_LABEL, LOWER, ROLLS_PER_TURN, UPPER, UPPER_BONUS, UPPER_BONUS_AT, YAHTZEE_BONUS, choices,
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
        out.push({ kind: 'yahtzee', uid: seat.uid, text: 'YAHTZEE!', tone: 'gold', expression: 'happy', ttl: 2800, data: { category: c } });
      } else {
        out.push({
          kind: 'score', uid: seat.uid, ttl: 2200, data: { category: c, points, name },
          expression: points === 0 ? 'sad' : points >= 25 ? 'happy' : undefined,
          text: points >= 25 ? `+${points}!` : undefined, tone: points >= 25 ? 'gold' : undefined,
        });
      }
    }
    if (seat.yahtzeeBonuses > (before.yahtzeeBonuses ?? 0)) {
      out.push({ kind: 'yahtzee', uid: seat.uid, text: `+${YAHTZEE_BONUS} bonus!`, tone: 'gold', expression: 'happy', ttl: 2800 });
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
export default function YahtzeeTable({ state, uid, act, busy, error, owner }: TableProps) {
  const [help, setHelp] = useState<Category | 'bonus' | 'zero' | null>(null);
  const moments = useMoments(state, detect);
  const looks = assignSpecies(state.seats.map((s) => s.uid));

  if (state.phase === 'lobby') {
    return (
      <div className="yz-lobby">
        <h2>Around the table</h2>
        <div className="yz-lobby-seats">
          {state.seats.map((s) => <Seat key={s.uid} uid={s.uid} species={looks[s.uid]} name={s.uid === uid ? 'You' : firstName(s.name)} size={56} />)}
        </div>
        <p className="muted">
          Thirteen turns each. Roll up to three times a turn, keeping the dice you like, then fill
          one box on your card. Biggest total wins.
        </p>
        {owner
          ? <button type="button" className="primary" disabled={busy || state.seats.length < 1} onClick={() => act({ type: 'start' })}>
              Start with {state.seats.length} player{state.seats.length === 1 ? '' : 's'}
            </button>
          : <p className="empty">Waiting for the host to start…</p>}
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
      {state.phase === 'results' && <Results state={state} uid={uid} owner={owner} busy={busy} act={act} species={looks} />}

      <section className="yz-sheet" aria-label="Scorecard">
        <div className="yz-card-wrap">
          <table className="yz-card">
            <thead>
              <tr>
                <th scope="col" className="yz-corner">
                  <button type="button" className="link-button" onClick={() => setHelp('zero')}>How scoring works</button>
                </th>
                {state.seats.map((s) => (
                  <th key={s.uid} scope="col" className={s.uid === current?.uid && state.phase === 'playing' ? 'turn' : ''}>
                    <span className="yz-head">
                      <span className="yz-head-face">
                        <Character uid={s.uid} species={looks[s.uid]} size={30} expression={faceOf(s)} />
                        {bubbleFor(moments, s.uid) && <span key={bubbleFor(moments, s.uid)!.key} className={`bubble ${bubbleFor(moments, s.uid)!.tone ?? ''}`}>{bubbleFor(moments, s.uid)!.text}</span>}
                      </span>
                      <span className="yz-head-name">{s.uid === uid ? 'You' : firstName(s.name)}</span>
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
                    Bonus <Icon name="info" size={13} />
                  </button>
                  <small className="yz-desc">{UPPER_BONUS_AT}+ up top · +{UPPER_BONUS}</small>
                </th>
                {state.seats.map((s) => {
                  const up = upperTotal(s);
                  return (
                    <td key={s.uid}>
                      {upperBonus(s)
                        ? <strong className="yz-bonus-won">+{UPPER_BONUS}</strong>
                        : <span className="yz-meter" title={`${up} of ${UPPER_BONUS_AT}`}>
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
                  <th scope="row"><span className="yz-name static">Yahtzee bonus</span></th>
                  {state.seats.map((s) => <td key={s.uid}>{s.yahtzeeBonuses ? `+${s.yahtzeeBonuses * YAHTZEE_BONUS}` : '—'}</td>)}
                </tr>
              )}
              <tr className="yz-total">
                <th scope="row">Total</th>
                {state.seats.map((s) => <td key={s.uid}>{grandTotal(s)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {state.phase === 'playing' && (
        <section className={`yz-tray${myTurn ? ' mine' : ''}`} aria-label="Dice">
          <div className="yz-tray-head">
            {current && <Character uid={current.uid} species={looks[current.uid]} size={34} expression={faceOf(current)} />}
            <div className="grow" style={{ minWidth: 0 }}>
              <strong className="truncate" style={{ display: 'block' }}>
                {myTurn ? 'Your turn' : `${firstName(current?.name ?? '')}'s turn`}
              </strong>
              <small className="muted">
                {lastScore?.data?.name
                  ? `${lastScore.data.name as string} scored ${lastScore.data.points as number} · ${CATEGORY_LABEL[lastScore.data.category as Category]}`
                  : `Round ${Math.min(13, state.round + 1)} of 13`}
              </small>
            </div>
            <span className="yz-pips" aria-label={`${rollsLeft} rolls left`}>
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
                <small className="yz-held-tag">{state.held[i] ? 'kept' : ''}</small>
              </span>
            ))}
          </div>

          <div className="yz-tray-foot">
            <button type="button" className="primary yz-roll" disabled={!myTurn || rollsLeft <= 0 || busy}
              onClick={() => act({ type: 'roll', dice: throwFive() })}>
              <Icon name="dice" size={18} />
              {!rolled ? 'Roll' : rollsLeft > 0 ? `Roll again · ${rollsLeft}` : 'Pick a box'}
            </button>
            <span className="yz-hint">
              {!myTurn ? 'Watch the dice…'
                : !rolled ? 'Three rolls this turn.'
                : best ? <>Best: <strong>{CATEGORY_LABEL[best.category]}</strong> · {best.score}</>
                : 'Pick a box to score.'}
            </span>
          </div>
          {celebrating && <div className="yz-celebrate"><span>YAHTZEE!</span><Confetti /></div>}
        </section>
      )}

      {error && <p className="error row center">{error}</p>}

      <Sheet open={help !== null} title={help === 'bonus' ? 'The upper bonus' : help === 'zero' ? 'How scoring works' : help ? CATEGORY_LABEL[help] : ''}
        onClose={() => setHelp(null)}>
        {help === 'bonus' && <p style={{ margin: 0 }}>{BONUS_HELP}</p>}
        {help === 'zero' && (
          <div className="col">
            <p style={{ margin: 0 }}>Each turn: roll up to three times, tapping dice between rolls to keep them, then fill one box on your card. Tap any box's name for what it needs.</p>
            <p style={{ margin: 0 }}>{ZERO_HELP}</p>
            <p style={{ margin: 0 }}>{BONUS_HELP}</p>
          </div>
        )}
        {help && help !== 'bonus' && help !== 'zero' && (
          <div className="col">
            <p style={{ margin: 0 }}>{HELP[help].long}</p>
            <div className="yz-example">
              {HELP[help].example.map((v, i) => <Die key={i} value={v} />)}
              <span className="yz-example-score">= {HELP[help].scores}</span>
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
        <button type="button" className="yz-name" onClick={() => onHelp(c)} aria-label={`${CATEGORY_LABEL[c]} — what is this?`}>
          {CATEGORY_LABEL[c]} <Icon name="info" size={13} />
        </button>
        <small className="yz-desc">{HELP[c].short}</small>
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
                    disabled={busy} onClick={() => onPick(c)} aria-label={`Score ${option.score} in ${CATEGORY_LABEL[c]}`}>
                    {option.score}
                  </button>
                : <span className="yz-empty" />}
          </td>
        );
      })}
    </tr>
  );
}

function Results({ state, uid, owner, busy, act, species }: Pick<TableProps, 'state' | 'uid' | 'owner' | 'busy' | 'act'> & { species: ReturnType<typeof assignSpecies> }) {
  const order = ranking(state);
  const winner = order[0];
  // Everyone level on the top score shares it; "You win!" for a tie would be a lie.
  const top = grandTotal(winner);
  const winners = order.filter((s) => grandTotal(s) === top);
  const names = winners.map((s) => (s.uid === uid ? 'you' : firstName(s.name)));
  return (
    <section className="yz-results">
      <Confetti />
      <Character uid={winner.uid} species={species[winner.uid]} size={72} expression="happy" />
      <h2>
        {winners.length > 1
          ? `A tie between ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}!`
          : winner.uid === uid ? 'You win!' : `${firstName(winner.name)} wins!`}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {order.map((s, i) => `${i + 1}. ${s.uid === uid ? 'You' : firstName(s.name)} ${grandTotal(s)}`).join('   ·   ')}
      </p>
      {owner
        ? <button type="button" className="primary" disabled={busy} onClick={() => act({ type: 'again' })}>Play again</button>
        : <p className="empty" style={{ margin: 0 }}>Waiting for the host to start another…</p>}
    </section>
  );
}
