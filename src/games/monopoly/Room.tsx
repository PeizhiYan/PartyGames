import { useEffect, useRef, useState } from 'react';
import BalanceChart from './BalanceChart';
import Dice from './Dice';
import Avatar from '../../ui/Avatar';
import Icon, { type IconName } from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import Sheet from '../../ui/Sheet';
import Board from './Board';
import { Token } from './Icons';
import SpaceSheet from './SpaceSheet';
import {
  BOARDS, COLORS, DEFAULT_BALANCE, PAY_REASONS, TOKENS, boardOf, canBuild, isBoardMode, newSeed,
  propertyValue, ranking, rollsAgain, seatOf, throwDice, totalWealth,
  type Mode, type MonopolyState, type Entry, type Seat,
} from './rules';
import { isOwnable } from './boards';
import { isOwner } from '../../rooms/rules';
import type { Room } from '../../types';
import { useGameAction } from '../../rooms/useRooms';
import { firstName, money, timeAgo } from '../../lib/format';

interface Props { room: Room; uid: string }
type Act = (action: unknown) => Promise<boolean>;

/** The bank for a Monopoly board. One component per phase of the game. */
export default function MonopolyRoom({ room, uid }: Props) {
  const state = room.state as MonopolyState;
  const { act, error, busy } = useGameAction(room.id);
  const me = seatOf(state, uid);
  const owner = isOwner(room, uid);
  const shared = { state, uid, me, owner, act, busy };

  // Someone let into the room after the game started has no seat in it. The host starting a new
  // game picks them up (see `syncSeats`), so they wait rather than seeing an empty wallet.
  if (!me && state.phase !== 'lobby') {
    return (
      <section className="card">
        <h3>You're watching</h3>
        <p className="muted" style={{ margin: 0 }}>
          This game was already under way when you joined, so you have no money in it. You'll be
          dealt in when the host starts the next one.
        </p>
      </section>
    );
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      {state.phase === 'lobby' && <Lobby {...shared} players={room.players.length} />}
      {state.phase === 'pick' && <Pick {...shared} />}
      {state.phase === 'roll' && <RollForOrder {...shared} />}
      {state.phase === 'order' && <Order {...shared} />}
      {(state.phase === 'playing' || state.phase === 'endVote') && (
        isBoardMode(state) ? <BoardPlay {...shared} /> : <Playing {...shared} />
      )}
      {state.phase === 'results' && <Results {...shared} />}
    </>
  );
}

interface PhaseProps {
  state: MonopolyState;
  uid: string;
  me: Seat | undefined;
  owner: boolean;
  act: Act;
  busy: boolean;
}

/* ─────────────────────────────── Before the game ─────────────────────────────── */

function Lobby({ state, owner, act, busy, players }: PhaseProps & { players: number }) {
  const [balance, setBalance] = useState(String(state.settings.startingBalance || DEFAULT_BALANCE));
  // Follow the host's changes, but don't fight the host's own typing.
  useEffect(() => {
    if (!owner) setBalance(String(state.settings.startingBalance));
  }, [owner, state.settings.startingBalance]);

  return (
    <>
      <section className="card">
        <h3>Who's playing</h3>
        <div className="player-grid">
          {state.seats.map((s) => (
            <div key={s.uid} className="player-chip">
              <Avatar name={s.name} photoURL={s.photoURL} size={32} />
              <span className="grow truncate">{firstName(s.name)}</span>
            </div>
          ))}
        </div>
        {players < 2 && <p className="empty">Share the room code — you need at least two players.</p>}
      </section>

      <section className="card">
        <h3>How are you playing?</h3>
        {owner ? (
          <Segmented
            label="Mode"
            block
            value={state.settings.mode}
            onChange={(mode: Mode) => act({ type: 'configure', mode })}
            options={[{ id: 'bank', label: 'Bank only' }, { id: 'board', label: 'Play the board' }]}
          />
        ) : (
          <p style={{ margin: 0 }}>
            <strong>{state.settings.mode === 'board' ? 'Playing the board here' : 'Bank only'}</strong>
          </p>
        )}
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9rem' }}>
          {state.settings.mode === 'board'
            ? 'Everything happens in the app — tokens, rent, cards, jail. No board on the table.'
            : 'You have a real board out. The app moves the money and keeps track of who bought what.'}
        </p>
      </section>

      <section className="card">
        <h3>Board</h3>
        <div className="board-choice">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={!owner}
              className={b.id === state.settings.boardId ? 'selected' : ''}
              onClick={() => act({ type: 'configure', boardId: b.id })}
            >
              <strong>{b.name}</strong>
              <small className="muted">{b.spaces.length} spaces · {b.currency}</small>
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.88rem' }}>
          Boards differ in length and in how many colour groups they have, so some games run
          shorter than others. In bank mode this is the list you pick properties from, so choose
          the one on your table.
        </p>
      </section>

      <section className="card">
        <h3>Bank settings</h3>
        {owner ? (
          <div className="col">
            <label className="field">
              <span>Starting balance</span>
              <div className="field-row">
                <input
                  className="money-input"
                  type="number"
                  inputMode="numeric"
                  value={balance}
                  min={100}
                  max={100000}
                  onChange={(e) => setBalance(e.target.value)}
                  onBlur={() => act({ type: 'configure', startingBalance: Number(balance) })}
                />
                <button type="button" disabled={busy}
                  onClick={() => act({ type: 'configure', startingBalance: Number(balance) })}>
                  Set
                </button>
              </div>
            </label>
            <div className="row between">
              <span className="col" style={{ gap: 2 }}>
                <strong style={{ fontSize: '0.95rem' }}>Show everyone's balance</strong>
                <small className="muted">Off keeps each player's cash to themselves.</small>
              </span>
              <Segmented
                label="Show balances"
                size="small"
                value={state.settings.showBalances ? 'on' : 'off'}
                onChange={(v) => act({ type: 'configure', showBalances: v === 'on' })}
                options={[{ id: 'off', label: 'Hide' }, { id: 'on', label: 'Show' }]}
              />
            </div>
          </div>
        ) : (
          <ul className="list">
            <li><span className="muted">Starting balance</span><strong>{money(state.settings.startingBalance)}</strong></li>
            <li><span className="muted">Balances</span><strong>{state.settings.showBalances ? 'Visible' : 'Private'}</strong></li>
          </ul>
        )}
      </section>

      {owner ? (
        <button type="button" className="primary block" disabled={busy || state.seats.length < 2}
          onClick={() => act({ type: 'start', seed: newSeed() })}>
          Start the game
        </button>
      ) : (
        <p className="empty">Waiting for the host to start…</p>
      )}
    </>
  );
}

function Pick({ state, uid, me, act, busy }: PhaseProps) {
  const [token, setToken] = useState(me?.token ?? '');
  const [color, setColor] = useState(me?.color ?? '');
  const takenTokens = state.seats.filter((s) => s.ready && s.uid !== uid).map((s) => s.token);

  if (me?.ready) {
    const waiting = state.seats.filter((s) => !s.ready);
    return (
      <section className="card">
        <div className="row center col" style={{ gap: 4, marginBottom: 14 }}>
          <Token token={me.token} color={me.color} size={58} />
          <strong>You're ready</strong>
          <small className="muted">Waiting for {waiting.map((s) => firstName(s.name)).join(', ')}…</small>
        </div>
        <ul className="list">
          {state.seats.map((s) => (
            <li key={s.uid}>
              <span className="row" style={{ gap: 8 }}>
                {s.ready ? <Token token={s.token} color={s.color} size={24} /> : <span aria-hidden>•</span>}
                <span>{firstName(s.name)}</span>
              </span>
              <span className={`badge${s.ready ? ' badge-live' : ''}`}>{s.ready ? 'Ready' : 'Choosing'}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h3>Pick your token</h3>
        <div className="choice-grid">
          {TOKENS.map((t) => (
            <button key={t} type="button" className={token === t ? 'selected' : ''}
              disabled={takenTokens.includes(t)} onClick={() => setToken(t)} aria-label={`Token ${t}`}>
              <Token token={t} color={color || 'var(--text-muted)'} size={36} />
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <h3>Pick your colour</h3>
        <div className="swatch-grid">
          {COLORS.map((c) => (
            <button key={c} type="button" className={color === c ? 'selected' : ''}
              style={{ background: c, borderColor: c }} onClick={() => setColor(c)} aria-label={`Colour ${c}`} />
          ))}
        </div>
      </section>
      <button type="button" className="primary block" disabled={busy || !token || !color}
        onClick={() => act({ type: 'pick', token, color })}>
        I'm ready
      </button>
    </>
  );
}

function RollForOrder({ state, me, act, busy }: PhaseProps) {
  const [rolling, setRolling] = useState(false);

  async function roll() {
    setRolling(true);
    const ok = await act({ type: 'rollOrder', dice: throwDice() });
    // Let the dice tumble for a moment either way, so it doesn't just snap to a number.
    window.setTimeout(() => setRolling(false), ok ? 500 : 0);
  }

  return (
    <section className="card">
      <h3>Who goes first?</h3>
      <div className="col" style={{ alignItems: 'center', gap: 14 }}>
        <Dice dice={me?.dice ?? null} rolling={rolling} />
        {me?.dice ? (
          <strong>You rolled {me.dice[0] + me.dice[1]}</strong>
        ) : (
          <button type="button" className="primary" disabled={busy || rolling} onClick={roll}>
            <Icon name="dice" size={18} /> Roll
          </button>
        )}
      </div>
      <ul className="list" style={{ marginTop: 14 }}>
        {state.seats.map((s) => (
          <li key={s.uid}>
            <span className="row" style={{ gap: 8 }}>
              <Token token={s.token} color={s.color} size={24} />
              <span>{firstName(s.name)}</span>
            </span>
            <span className={`badge${s.dice ? ' badge-live' : ''}`}>
              {s.dice ? `${s.dice[0]} + ${s.dice[1]} = ${s.dice[0] + s.dice[1]}` : 'Rolling…'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Order({ state, uid, act, busy }: PhaseProps) {
  const ordered = state.order
    .map((u) => state.seats.find((s) => s.uid === u))
    .filter((s): s is Seat => s !== undefined);
  return (
    <>
      <section className="card">
        <h3>Play order</h3>
        {ordered.map((s, i) => (
          <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
            <span className="rank-medal" aria-hidden>
              {i === 0 ? <Icon name="trophy" size={22} /> : i + 1}
            </span>
            <Token token={s.token} color={s.color} size={30} />
            <span className="grow truncate"><strong>{s.uid === uid ? 'You' : firstName(s.name)}</strong></span>
            <span className="badge tabular">{s.dice ? s.dice[0] + s.dice[1] : '—'}</span>
          </div>
        ))}
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          The app doesn't police turns — this is just who starts.
        </p>
      </section>
      <button type="button" className="primary block" disabled={busy} onClick={() => act({ type: 'beginPlay' })}>
        Let's play
      </button>
    </>
  );
}

/* ─────────────────────────────── The game ─────────────────────────────── */

type Dialog = 'buy' | 'send' | 'pay' | 'request' | null;

function Playing({ state, uid, me, act, busy }: PhaseProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [search, setSearch] = useState('');
  const bankBoard = boardOf(state.settings.boardId);
  /** Everything on this board nobody has bought yet, narrowed by the search box. */
  const forSale = bankBoard.spaces
    .map((space, index) => ({ space, index }))
    .filter((e): e is { space: Extract<typeof e.space, { price: number }>; index: number } =>
      isOwnable(e.space) && !state.owned[e.index])
    .filter((e) => e.space.name.toLowerCase().includes(search.trim().toLowerCase()));
  const [rolling, setRolling] = useState(false);
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<string>(PAY_REASONS[0]);
  const [leaving, setLeaving] = useState(false);

  const others = state.seats.filter((s) => s.uid !== uid);
  const mine = state.log.filter((e) => ('from' in e && e.from === uid) || ('to' in e && e.to === uid));
  const recent = [...mine].reverse().slice(0, 12);
  const value = Math.floor(Number(amount));
  const valid = Number.isFinite(value) && value > 0;

  // Somebody else's roll flashes up for a few seconds on everyone's screen.
  const [flash, setFlash] = useState<MonopolyState['lastRoll']>(null);
  const seenRoll = useRef<number | null>(null);
  useEffect(() => {
    const roll = state.lastRoll;
    if (!roll || roll.at === seenRoll.current) return;
    seenRoll.current = roll.at;
    setFlash(roll);
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [state.lastRoll]);

  function close() {
    setDialog(null);
    setSearch('');
    setTarget('');
    setAmount('');
    setNote('');
    setReason(PAY_REASONS[0]);
  }

  async function submit(action: unknown) {
    if (await act(action)) close();
  }

  async function roll() {
    setRolling(true);
    await act({ type: 'roll', dice: throwDice() });
    window.setTimeout(() => setRolling(false), 600);
  }

  const request = state.requests.find((r) => r.uid !== uid);
  const requester = request ? state.seats.find((s) => s.uid === request.uid) : undefined;

  return (
    <>
      <section className="balance">
        <strong>{money(me?.balance)}</strong>
        <span>Your balance</span>
      </section>

      <div className="row between" style={{ margin: '12px 0 0' }}>
        <span className="row" style={{ gap: 8 }}>
          <span className="player-chip" style={{ background: 'transparent', padding: 0 }}>
            <Token token={me?.token ?? null} color={me?.color} size={30} />
            <span className="col" style={{ gap: 0 }}>
              <strong style={{ fontSize: '0.92rem' }}>You</strong>
              <small className="muted">
                {state.order[0] === uid ? 'You started' : `${firstName(state.seats.find((s) => s.uid === state.order[0])?.name ?? '')} started`}
              </small>
            </span>
          </span>
        </span>
        <button type="button" disabled={busy || rolling} onClick={roll}>
          <Icon name="dice" size={18} /> Roll
        </button>
      </div>

      {flash && (
        <div className="room-banner" style={{ marginTop: 12 }}>
          <Dice dice={flash.dice} />
          <span className="grow">
            <strong>{flash.uid === uid ? 'You' : firstName(state.seats.find((s) => s.uid === flash.uid)?.name ?? 'Someone')}</strong>
            {' rolled '}
            <strong className="tabular">{flash.total}</strong>
          </span>
        </div>
      )}

      <div className="action-grid action-grid-4">
        <button type="button" onClick={() => setDialog('buy')}>
          <Icon name="tag" size={24} /><span>Buy</span>
        </button>
        <button type="button" onClick={() => setDialog('send')}>
          <Icon name="send" size={24} /><span>Send</span>
        </button>
        <button type="button" onClick={() => setDialog('pay')}>
          <Icon name="bank" size={24} /><span>Pay bank</span>
        </button>
        <button type="button" onClick={() => setDialog('request')}>
          <Icon name="cash" size={24} /><span>Request</span>
        </button>
      </div>

      <section className="card">
        <h3>Everyone else</h3>
        <div className="player-grid">
          {others.map((s) => (
            <div key={s.uid} className="player-chip">
              <Token token={s.token} color={s.color} size={30} />
              <span className="grow" style={{ minWidth: 0 }}>
                <small className="truncate">{firstName(s.name)}</small>
                <b>{state.settings.showBalances ? money(s.balance) : '•••'}</b>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Your money</h3>
        {recent.length === 0 ? <p className="empty">Nothing yet.</p> : (
          <ul className="entries">
            {recent.map((e) => <LogRow key={e.id} entry={e} uid={uid} seats={state.seats} />)}
          </ul>
        )}
      </section>

      <button type="button" className="block" onClick={() => setLeaving(true)}>End the game</button>

      {/* Buying a property off the board on the table */}
      <Sheet open={dialog === 'buy'} title="Buy a property" onClose={close}>
        <div className="col">
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            From the <strong>{bankBoard.name}</strong> board. The price is the printed one, and
            recording it here is what lets the final standings add themselves up.
          </p>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search" aria-label="Search properties" />
          <div className="col" style={{ gap: 6, maxHeight: '46vh', overflowY: 'auto' }}>
            {forSale.length === 0 && <p className="empty">Nothing left unowned.</p>}
            {forSale.map(({ index, space }) => (
              <button key={index} type="button" className="row between" disabled={busy}
                onClick={async () => { if (await act({ type: 'buyProperty', space: index })) close(); }}>
                <span className="row" style={{ gap: 8, minWidth: 0 }}>
                  {space.kind === 'property' && (
                    <span className="swatch" style={{
                      background: bankBoard.groups[space.group]?.color, width: 10, height: 18, borderRadius: 3,
                    }} aria-hidden />
                  )}
                  <span className="truncate">{space.name}</span>
                </span>
                <strong className="tabular">{bankBoard.currency}{space.price.toLocaleString()}</strong>
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Send money */}
      <Sheet open={dialog === 'send'} title="Send money" onClose={close}>
        <div className="col">
          <span className="field"><span>To</span></span>
          <div className="player-grid">
            {others.map((s) => (
              <button key={s.uid} type="button" className={`player-chip${target === s.uid ? ' selected' : ''}`}
                style={{ borderColor: target === s.uid ? s.color ?? undefined : 'transparent', borderWidth: 2, borderStyle: 'solid' }}
                onClick={() => setTarget(s.uid)}>
                <Token token={s.token} color={s.color} size={30} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <small className="truncate">{firstName(s.name)}</small>
                  {state.settings.showBalances && <b>{money(s.balance)}</b>}
                </span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Amount</span>
            <input className="money-input" type="number" inputMode="numeric" min={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
          </label>
          <label className="field">
            <span>What for? (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="Rent on Park Lane" />
          </label>
          <button type="button" className="primary block" disabled={busy || !target || !valid}
            onClick={() => submit({ type: 'send', to: target, amount: value, note })}>
            <Icon name="send" size={16} /> Send {valid ? money(value) : ''}
          </button>
        </div>
      </Sheet>

      {/* Pay the bank */}
      <Sheet open={dialog === 'pay'} title="Pay the bank" onClose={close}>
        <div className="col">
          <label className="field">
            <span>What for?</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {PAY_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Amount</span>
            <input className="money-input" type="number" inputMode="numeric" min={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
            <small className="muted">You have {money(me?.balance)}.</small>
          </label>
          <button type="button" className="primary block" disabled={busy || !valid}
            onClick={() => submit({ type: 'payBank', amount: value, reason })}>
            <Icon name="bank" size={16} /> Pay {valid ? money(value) : ''}
          </button>
        </div>
      </Sheet>

      {/* Ask the bank */}
      <Sheet open={dialog === 'request'} title="Request from the bank" onClose={close}>
        <div className="col">
          <p className="row" style={{ gap: 8, margin: 0, color: 'var(--warning)' }}>
            <Icon name="info" size={16} /> Everyone else has to approve this.
          </p>
          <label className="field">
            <span>Amount</span>
            <input className="money-input" type="number" inputMode="numeric" min={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="200" autoFocus />
          </label>
          <label className="field">
            <span>What for?</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="Passed Go" />
          </label>
          <button type="button" className="primary block" disabled={busy || !valid}
            onClick={() => submit({ type: 'requestBank', amount: value, reason: note })}>
            Ask for {valid ? money(value) : ''}
          </button>
        </div>
      </Sheet>

      {/* Someone else wants money from the bank: everyone has to answer. */}
      <Sheet open={!!request && !!requester} title="Bank request">
        {request && requester && (
          <div className="col">
            <div className="col" style={{ alignItems: 'center', gap: 6 }}>
              <Token token={requester.token} color={requester.color} size={56} />
              <strong>{firstName(requester.name)} wants {money(request.amount)}</strong>
              {request.reason && <small className="muted">{request.reason}</small>}
            </div>
            <div>
              <div className="row between">
                <small className="muted">Approvals</small>
                <small className="muted tabular">{request.approvedBy.length} / {state.seats.length - 1}</small>
              </div>
              <div className="approvals" aria-hidden>
                {Array.from({ length: Math.max(1, state.seats.length - 1) }, (_, i) => (
                  <span key={i} className={i < request.approvedBy.length ? 'done' : ''} />
                ))}
              </div>
            </div>
            {request.approvedBy.includes(uid) ? (
              <p className="success row center" style={{ margin: 0 }}>
                <Icon name="check" size={16} /> You approved — waiting for the others.
              </p>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="danger-fill grow" disabled={busy}
                  onClick={() => act({ type: 'respondBank', id: request.id, approve: false })}>
                  Reject
                </button>
                <button type="button" className="success-fill grow" disabled={busy}
                  onClick={() => act({ type: 'respondBank', id: request.id, approve: true })}>
                  Approve
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* Ending the game needs everyone's agreement. */}
      <Sheet open={leaving && state.phase === 'playing'} title="End the game?" onClose={() => setLeaving(false)}>
        <div className="col">
          <p className="muted" style={{ margin: 0 }}>
            Everyone has to agree. Then you each type in what your property is worth and the app ranks you.
          </p>
          <button type="button" className="primary block" disabled={busy}
            onClick={async () => { if (await act({ type: 'endGame' })) setLeaving(false); }}>
            Ask everyone to finish
          </button>
        </div>
      </Sheet>

      <Sheet open={state.phase === 'endVote'} title="End the game?">
        {state.endVote && (
          <div className="col">
            <p style={{ margin: 0 }}>
              <strong>
                {state.endVote.by === uid ? 'You' : firstName(state.seats.find((s) => s.uid === state.endVote!.by)?.name ?? 'Someone')}
              </strong>
              {' wants to finish. Everyone has to agree.'}
            </p>
            <div>
              <div className="row between">
                <small className="muted">Agreed</small>
                <small className="muted tabular">{state.endVote.approvedBy.length} / {state.seats.length}</small>
              </div>
              <div className="approvals" aria-hidden>
                {state.seats.map((s, i) => (
                  <span key={s.uid} className={i < state.endVote!.approvedBy.length ? 'done' : ''} />
                ))}
              </div>
            </div>
            {state.endVote.approvedBy.includes(uid) ? (
              <p className="success row center" style={{ margin: 0 }}>
                <Icon name="check" size={16} /> Waiting for the others…
              </p>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="grow" disabled={busy}
                  onClick={() => act({ type: 'respondEnd', approve: false })}>
                  Keep playing
                </button>
                <button type="button" className="primary grow" disabled={busy}
                  onClick={() => act({ type: 'respondEnd', approve: true })}>
                  Finish
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

function LogRow({ entry, uid, seats }: { entry: Entry; uid: string; seats: Seat[] }) {
  const name = (u: string) => firstName(seats.find((s) => s.uid === u)?.name ?? 'someone');
  let icon: IconName = 'bank';
  let label = '';
  let out = true;

  if (entry.kind === 'transfer') {
    out = entry.from === uid;
    icon = out ? 'out' : 'in';
    label = out ? `To ${name(entry.to)}` : `From ${name(entry.from)}`;
    if (entry.note) label += ` · ${entry.note}`;
  } else if (entry.kind === 'payBank') {
    label = `Bank · ${entry.note || 'Payment'}`;
  } else {
    out = false;
    label = `Bank · ${entry.note || 'Received'}`;
  }

  return (
    <li>
      <span className="entry-kind" aria-hidden><Icon name={icon} size={16} /></span>
      <span className="grow col" style={{ gap: 0, minWidth: 0 }}>
        <span className="truncate" style={{ fontSize: '0.9rem' }}>{label}</span>
        <small className="muted">{timeAgo(entry.at)}</small>
      </span>
      <span className={`entry-amount ${out ? 'out' : 'in'}`}>
        {out ? '−' : '+'}{money(entry.amount)}
      </span>
    </li>
  );
}

/* ─────────────────────────────── After the game ─────────────────────────────── */

/* ─────────────────────────────── Playing the board ─────────────────────────────── */

const CORNER_NAMES: Record<string, string> = {
  go: 'Go', jail: 'Jail', parking: 'Free parking', gotojail: 'Go to jail',
  chance: 'Chance', chest: 'Community Chest',
};

/** What to call a space in a sentence. */
function spaceLabel(board: ReturnType<typeof boardOf>, index: number): string {
  const space = board.spaces[index];
  if (!space) return '';
  return 'name' in space ? space.name : CORNER_NAMES[space.kind] ?? space.kind;
}

/**
 * Board mode. The ring is read-only; everything you can do sits underneath it, and only the
 * player on move has anything to press.
 */
function BoardPlay({ state, uid, me, act, busy }: PhaseProps) {
  const board = boardOf(state.settings.boardId);
  const [rolling, setRolling] = useState(false);
  const [building, setBuilding] = useState(false);
  /** Which space the player has tapped to read. The board itself shows no words on a phone. */
  const [looking, setLooking] = useState<number | null>(null);

  const myTurn = state.turn === uid && !me?.bankrupt;
  const onMove = state.seats.find((s) => s.uid === state.turn);
  const pending = state.pending;
  const offered = pending ? board.spaces[pending.space] : undefined;
  const buildable = me ? Object.keys(state.owned)
    .map(Number)
    .filter((i) => canBuild(state, me.uid, i)) : [];

  async function roll() {
    setRolling(true);
    await act({ type: 'roll', dice: throwDice() });
    window.setTimeout(() => setRolling(false), 500);
  }

  return (
    <div className="board-play">
      {/*
        Two columns once there is room: the board on the left, everything you do on the right.
        Below the breakpoint they stack, board first.
      */}
      <div className="board-play-board">
        <Board state={state} board={board} uid={uid} onSelect={setLooking} />
      </div>

      <div className="board-play-side">
      {state.card && (
        <div className="room-banner" role="status">
          <Icon name="card" size={20} />
          <span className="grow">{state.card.text}</span>
        </div>
      )}

      {/* Where you are, spelled out — the one space you always need to be able to read. */}
      {me && !me.bankrupt && (
        <button type="button" className="here-card" onClick={() => setLooking(me.position)}>
          <Token token={me.token} color={me.color} size={30} />
          <span className="grow col" style={{ gap: 0, minWidth: 0 }}>
            <small className="muted">{me.jailTurns > 0 ? 'In jail' : 'You are on'}</small>
            <strong className="truncate">{spaceLabel(board, me.position)}</strong>
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      <div className="row between" style={{ margin: '12px 0' }}>
        <span className="turn-pill">
          {me?.bankrupt ? 'You are out' : myTurn ? 'Your turn' : `${firstName(onMove?.name ?? '')}'s turn`}
        </span>
        <strong className="tabular">{board.currency}{(me?.balance ?? 0).toLocaleString()}</strong>
      </div>

      {/* Flat dice, for the layout that has no board middle to throw them into. */}
      {state.lastRoll && (
        <div className="row center dice-aside" style={{ marginBottom: 12 }}>
          <Dice dice={state.lastRoll.dice} rolling={rolling} />
        </div>
      )}

      {myTurn && (
        <div className="action-grid">
          <button type="button" disabled={busy || rolling || state.rolled || !!pending} onClick={roll}>
            <Icon name="dice" size={24} /><span>Roll</span>
          </button>
          <button type="button" disabled={busy || buildable.length === 0} onClick={() => setBuilding(true)}>
            <Icon name="home" size={24} /><span>Build</span>
          </button>
          <button type="button" disabled={busy || !state.rolled || !!pending || rollsAgain(state, uid)}
            onClick={() => act({ type: 'endTurn' })}>
            <Icon name="check" size={24} /><span>End turn</span>
          </button>
        </div>
      )}

      <section className="card">
        <h3>Players</h3>
        <div className="player-grid">
          {state.seats.map((s) => (
            <div key={s.uid} className="player-chip" style={{ opacity: s.bankrupt ? 0.5 : 1 }}>
              <Token token={s.token} color={s.color} size={30} />
              <span className="grow" style={{ minWidth: 0 }}>
                <small className="truncate">
                  {s.uid === uid ? 'You' : firstName(s.name)}
                  {s.jailTurns > 0 && ' · in jail'}
                  {s.bankrupt && ' · out'}
                </small>
                <b>{state.settings.showBalances || s.uid === uid
                  ? `${board.currency}${s.balance.toLocaleString()}`
                  : '•••'}</b>
              </span>
            </div>
          ))}
        </div>
      </section>

      <Sheet open={!!pending && myTurn} title="Buy it?">
        {pending && offered && isOwnable(offered) && (
          <div className="col">
            <p style={{ margin: 0 }}>
              <strong>{offered.name}</strong> is unowned. It costs{' '}
              <strong>{board.currency}{pending.price.toLocaleString()}</strong>.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Decline and it stays with the bank — there is no auction.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="grow" disabled={busy} onClick={() => act({ type: 'decline' })}>
                No thanks
              </button>
              <button type="button" className="primary grow" disabled={busy} onClick={() => act({ type: 'buy' })}>
                Buy it
              </button>
            </div>
          </div>
        )}
      </Sheet>

      </div>

      <SpaceSheet state={state} board={board} index={looking} onClose={() => setLooking(null)} />

      <Sheet open={building} title="Build a house" onClose={() => setBuilding(false)}>
        <div className="col">
          {buildable.length === 0 ? (
            <p className="empty">Nothing to build on yet — you need every property in a colour group.</p>
          ) : buildable.map((index) => {
            const space = board.spaces[index];
            if (space?.kind !== 'property') return null;
            const cost = board.groups[space.group].houseCost;
            return (
              <button key={index} type="button" className="row between" disabled={busy}
                onClick={async () => { if (await act({ type: 'build', space: index })) setBuilding(false); }}>
                <span className="row" style={{ gap: 6 }}>
                  {space.name} ·
                  {state.houses[index]
                    ? <Houses count={state.houses[index]} />
                    : <span className="muted">no houses</span>}
                </span>
                <strong>{board.currency}{cost.toLocaleString()}</strong>
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

/** A drawn cup for the win, then plain numbers — medal emoji are three different pictures. */
function Houses({ count }: { count: number }) {
  return (
    <span className="row" style={{ gap: 1 }} title={`${count} house${count === 1 ? '' : 's'}`}>
      {Array.from({ length: count }, (_, i) => <Icon key={i} name="home" size={14} />)}
    </span>
  );
}

function Results({ state, uid, owner, act, busy }: PhaseProps) {
  const ranked = ranking(state);
  return (
    <>
      <div className="col" style={{ alignItems: 'center', gap: 2, margin: '8px 0 18px' }}>
        <span className="trophy-mark" aria-hidden><Icon name="trophy" size={44} /></span>
        <h1>Final standings</h1>
        <p className="muted" style={{ margin: 0 }}>Cash plus everything you bought — added up for you.</p>
      </div>

      {ranked.map((s, i) => (
        <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
          <span className="rank-medal" aria-hidden>
            {i === 0 ? <Icon name="trophy" size={22} /> : i + 1}
          </span>
          <Token token={s.token} color={s.color} size={30} />
          <span className="grow col" style={{ gap: 0, minWidth: 0 }}>
            <strong className="truncate">{s.uid === uid ? 'You' : firstName(s.name)}</strong>
            <small className="muted tabular">
              {money(s.balance)} cash · {money(propertyValue(state, s.uid))} property
              {s.bankrupt && ' · bankrupt'}
            </small>
          </span>
          <strong className="tabular">{money(totalWealth(state, s))}</strong>
        </div>
      ))}

      <div style={{ marginTop: 16 }}><BalanceChart state={state} /></div>

      {owner ? (
        <button type="button" className="primary block" disabled={busy}
          onClick={() => act({ type: 'newGame' })}>
          Play again
        </button>
      ) : (
        <p className="empty">The host can start another game.</p>
      )}
    </>
  );
}
