import Avatar from '../../ui/Avatar';
import Die from '../../ui/Die';
import Icon from '../../ui/Icon';
import {
  CATEGORY_LABEL, LOWER, ROLLS_PER_TURN, UPPER, UPPER_BONUS_AT, YAHTZEE_BONUS, choices, currentSeat,
  grandTotal, ranking, throwFive, upperBonus, upperTotal, type Category, type Seat, type YahtzeeAction,
  type YahtzeeState,
} from './rules';
import { firstName } from '../../lib/format';
import './Yahtzee.css';

export interface TableProps {
  state: YahtzeeState;
  uid: string;
  act: (action: YahtzeeAction) => unknown;
  busy: boolean;
  error: string;
  /** Whether this viewer is the host: starts the game and calls the next one. */
  owner: boolean;
  /** Set briefly after a roll so the dice tumble. */
  rolling: boolean;
  onRoll?: () => void;
}

/**
 * The table everyone sees: the dice, the roll button, and the scorecard with a column per seat.
 * Shared by the room and the solo screen — the only difference between them is where `act` goes.
 */
export default function YahtzeeTable({ state, uid, act, busy, error, owner, rolling, onRoll }: TableProps) {
  const me = state.seats.find((s) => s.uid === uid);
  const current = currentSeat(state);
  const myTurn = state.phase === 'playing' && current?.uid === uid;
  const rollsLeft = ROLLS_PER_TURN - state.rolls;
  const rolled = state.rolls > 0;
  const options = myTurn && me && rolled ? choices(me, state.dice) : [];

  function roll() {
    if (!myTurn || rollsLeft <= 0) return;
    onRoll?.();
    act({ type: 'roll', dice: throwFive() });
  }

  if (state.phase === 'lobby') {
    return (
      <>
        <section className="card">
          <h3>Who's playing</h3>
          <div className="player-grid">
            {state.seats.map((s) => (
              <div key={s.uid} className="player-chip">
                <Avatar name={s.name} photoURL={s.photoURL} size={32} />
                <span className="grow truncate">{s.uid === uid ? 'You' : firstName(s.name)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9rem' }}>
            Thirteen boxes each. Three rolls a turn — hold the dice you like between them.
          </p>
        </section>
        {owner
          ? <button type="button" className="primary block" disabled={busy || state.seats.length < 1} onClick={() => act({ type: 'start' })}>Start the game</button>
          : <p className="empty">Waiting for the host to start…</p>}
        {error && <p className="error">{error}</p>}
      </>
    );
  }

  const status = state.phase === 'results' ? 'Final scores'
    : myTurn ? (rolled ? `Your turn · ${rollsLeft} roll${rollsLeft === 1 ? '' : 's'} left` : 'Your turn · roll')
    : `${firstName(current?.name ?? '')}'s turn`;

  return (
    <>
      <div className="row center" style={{ marginBottom: 4 }}>
        <span className="turn-pill">{status}</span>
      </div>

      {state.phase === 'playing' && (
        <>
          <div className="yz-dice">
            {state.dice.map((value, i) => (
              <Die key={i} value={value} rolling={rolling} held={state.held[i]}
                onToggle={myTurn && rolled && rollsLeft > 0 && !busy
                  ? () => act({ type: 'hold', index: i, held: !state.held[i] })
                  : undefined} />
            ))}
          </div>
          <div className="row center" style={{ marginBottom: 12 }}>
            <button type="button" className="primary" disabled={!myTurn || rollsLeft <= 0 || busy || rolling} onClick={roll}>
              <Icon name="dice" size={18} />
              {rolled ? `Roll again (${rollsLeft})` : 'Roll'}
            </button>
          </div>
          {myTurn && rolled && (
            <p className="muted row center" style={{ marginTop: -6, marginBottom: 10, fontSize: '0.88rem' }}>
              {rollsLeft > 0 ? 'Tap dice to hold them, or pick a box to score now.' : 'Pick a box to score.'}
            </p>
          )}
        </>
      )}

      {error && <p className="error row center">{error}</p>}

      <section className="card">
        <Scorecard state={state} uid={uid} options={options} onPick={(category) => act({ type: 'score', category })} busy={busy} />
      </section>

      {state.phase === 'results' && (
        <>
          {ranking(state).map((s, i) => (
            <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
              <span className="rank-medal" aria-hidden>{i === 0 ? <Icon name="trophy" size={22} /> : i + 1}</span>
              <Avatar name={s.name} photoURL={s.photoURL} size={30} />
              <span className="grow truncate"><strong>{s.uid === uid ? 'You' : firstName(s.name)}</strong></span>
              <strong className="tabular">{grandTotal(s)}</strong>
            </div>
          ))}
          {owner
            ? <button type="button" className="primary block" disabled={busy} onClick={() => act({ type: 'again' })}>Play again</button>
            : <p className="empty">Waiting for the host to start another…</p>}
        </>
      )}
    </>
  );
}

function Scorecard({ state, uid, options, onPick, busy }: {
  state: YahtzeeState;
  uid: string;
  options: { category: Category; score: number }[];
  onPick: (category: Category) => void;
  busy: boolean;
}) {
  const current = currentSeat(state);
  const cell = (seat: Seat, category: Category) => {
    const filled = seat.card[category];
    if (filled !== undefined) return <span className={`filled${filled === 0 ? ' zero' : ''}`}>{filled}</span>;
    const option = seat.uid === uid ? options.find((o) => o.category === category) : undefined;
    if (option) {
      return (
        <button type="button" className={`pick${option.score === 0 ? ' zero' : ''}`} disabled={busy}
          onClick={() => onPick(category)} aria-label={`Score ${option.score} in ${CATEGORY_LABEL[category]}`}>
          {option.score}
        </button>
      );
    }
    return <span className="muted">·</span>;
  };
  const row = (category: Category) => (
    <tr key={category}>
      <th scope="row">{CATEGORY_LABEL[category]}</th>
      {state.seats.map((s) => <td key={s.uid} className={s.uid === current?.uid && state.phase === 'playing' ? 'turn' : ''}>{cell(s, category)}</td>)}
    </tr>
  );
  const section = (label: string, value: (s: Seat) => number | string) => (
    <tr className="section">
      <th scope="row">{label}</th>
      {state.seats.map((s) => <td key={s.uid}>{value(s)}</td>)}
    </tr>
  );
  return (
    <div className="yz-card-wrap">
      <table className="yz-card">
        <thead>
          <tr>
            <th scope="col"></th>
            {state.seats.map((s) => (
              <th key={s.uid} scope="col" className={s.uid === current?.uid && state.phase === 'playing' ? 'turn' : ''}>
                <span className="yz-seat">
                  <Avatar name={s.name} photoURL={s.photoURL} size={26} />
                  <span>{s.uid === uid ? 'You' : firstName(s.name)}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER.map(row)}
          {section(`Bonus (${UPPER_BONUS_AT}+)`, (s) => `${upperTotal(s)} · ${upperBonus(s) ? '+35' : '—'}`)}
          {LOWER.map(row)}
          {section(`Yahtzee bonus`, (s) => (s.yahtzeeBonuses ? `+${s.yahtzeeBonuses * YAHTZEE_BONUS}` : '—'))}
          <tr className="section total">
            <th scope="row">Total</th>
            {state.seats.map((s) => <td key={s.uid}>{grandTotal(s)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
