import { useSoundOn } from '../../hooks/useSound';
import { t } from '../../i18n';
import { cardText, m, noteText } from './messages';
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

  // Dice on every roll, a coin whenever money moves, a card when one is drawn, a chime on your
  // turn on the board, and a fanfare for the final standings.
  useSoundOn(state.lastRoll?.at ?? null, (at) => (at ? 'dice' : null));
  useSoundOn(state.log.length, () => 'coin');
  useSoundOn(state.card?.at ?? null, (at) => (at ? 'card' : null));
  useSoundOn(isBoardMode(state) && state.phase === 'playing' && state.turn === uid, (on) => (on ? 'turn' : null));
  useSoundOn(state.phase === 'results', (done) => (done ? 'win' : null));

  // Someone let into the room after the game started has no seat in it. The host starting a new
  // game picks them up (see `syncSeats`), so they wait rather than seeing an empty wallet.
  if (!me && state.phase !== 'lobby') {
    return (
      <section className="card">
        <h3>{m().watchingTitle}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {m().watchingBody}
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
        <h3>{m().whoPlaying}</h3>
        <div className="player-grid">
          {state.seats.map((s) => (
            <div key={s.uid} className="player-chip">
              <Avatar name={s.name} photoURL={s.photoURL} size={32} />
              <span className="grow truncate">{firstName(s.name)}</span>
            </div>
          ))}
        </div>
        {players < 2 && <p className="empty">{m().shareCode}</p>}
      </section>

      <section className="card">
        <h3>{m().howPlaying}</h3>
        {owner ? (
          <Segmented
            label={m().mode}
            block
            value={state.settings.mode}
            onChange={(mode: Mode) => act({ type: 'configure', mode })}
            options={[{ id: 'bank', label: m().bankOnly }, { id: 'board', label: m().playBoard }]}
          />
        ) : (
          <p style={{ margin: 0 }}>
            <strong>{state.settings.mode === 'board' ? m().playingBoardHere : m().bankOnly}</strong>
          </p>
        )}
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9rem' }}>
          {state.settings.mode === 'board'
            ? m().boardHelp
            : m().bankHelp}
        </p>
      </section>

      <section className="card">
        <h3>{m().board}</h3>
        <div className="board-choice">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={!owner}
              className={b.id === state.settings.boardId ? 'selected' : ''}
              onClick={() => act({ type: 'configure', boardId: b.id })}
            >
              <strong>{m().boards[b.id] ?? b.name}</strong>
              <small className="muted">{m().boardMeta(b.spaces.length, b.currency)}</small>
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.88rem' }}>
          {m().boardsHelp}
        </p>
      </section>

      <section className="card">
        <h3>{m().bankSettings}</h3>
        {owner ? (
          <div className="col">
            <label className="field">
              <span>{m().startingBalance}</span>
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
                  {m().set}
                </button>
              </div>
            </label>
            <div className="row between">
              <span className="col" style={{ gap: 2 }}>
                <strong style={{ fontSize: '0.95rem' }}>{m().showBalances}</strong>
                <small className="muted">{m().showBalancesHelp}</small>
              </span>
              <Segmented
                label={m().showBalancesLabel}
                size="small"
                value={state.settings.showBalances ? 'on' : 'off'}
                onChange={(v) => act({ type: 'configure', showBalances: v === 'on' })}
                options={[{ id: 'off', label: m().hide }, { id: 'on', label: m().show }]}
              />
            </div>
          </div>
        ) : (
          <ul className="list">
            <li><span className="muted">{m().startingBalance}</span><strong>{money(state.settings.startingBalance)}</strong></li>
            <li><span className="muted">{m().balances}</span><strong>{state.settings.showBalances ? m().visible : m().private}</strong></li>
          </ul>
        )}
      </section>

      {owner ? (
        <button type="button" className="primary block" disabled={busy || state.seats.length < 2}
          onClick={() => act({ type: 'start', seed: newSeed() })}>
          {m().startGame}
        </button>
      ) : (
        <p className="empty">{m().waitingStart}</p>
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
          <strong>{m().youreReady}</strong>
          <small className="muted">{m().waitingFor(t.common.list(waiting.map((s) => firstName(s.name))))}</small>
        </div>
        <ul className="list">
          {state.seats.map((s) => (
            <li key={s.uid}>
              <span className="row" style={{ gap: 8 }}>
                {s.ready ? <Token token={s.token} color={s.color} size={24} /> : <span aria-hidden>•</span>}
                <span>{firstName(s.name)}</span>
              </span>
              <span className={`badge${s.ready ? ' badge-live' : ''}`}>{s.ready ? m().ready : m().choosing}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h3>{m().pickToken}</h3>
        <div className="choice-grid">
          {TOKENS.map((tk) => (
            <button key={tk} type="button" className={token === tk ? 'selected' : ''}
              disabled={takenTokens.includes(tk)} onClick={() => setToken(tk)} aria-label={m().token(m().tokens[tk] ?? tk)}>
              <Token token={tk} color={color || 'var(--text-muted)'} size={36} />
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <h3>{m().pickColour}</h3>
        <div className="swatch-grid">
          {COLORS.map((c) => (
            <button key={c} type="button" className={color === c ? 'selected' : ''}
              style={{ background: c, borderColor: c }} onClick={() => setColor(c)} aria-label={m().colour(c)} />
          ))}
        </div>
      </section>
      <button type="button" className="primary block" disabled={busy || !token || !color}
        onClick={() => act({ type: 'pick', token, color })}>
        {m().imReady}
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
      <h3>{m().whoFirst}</h3>
      <div className="col" style={{ alignItems: 'center', gap: 14 }}>
        <Dice dice={me?.dice ?? null} rolling={rolling} />
        {me?.dice ? (
          <strong>{m().youRolled(me.dice[0] + me.dice[1])}</strong>
        ) : (
          <button type="button" className="primary" disabled={busy || rolling} onClick={roll}>
            <Icon name="dice" size={18} /> {m().roll}
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
              {s.dice ? `${s.dice[0]} + ${s.dice[1]} = ${s.dice[0] + s.dice[1]}` : m().rolling}
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
        <h3>{m().playOrder}</h3>
        {ordered.map((s, i) => (
          <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
            <span className="rank-medal" aria-hidden>
              {i === 0 ? <Icon name="trophy" size={22} /> : i + 1}
            </span>
            <Token token={s.token} color={s.color} size={30} />
            <span className="grow truncate"><strong>{s.uid === uid ? t.common.you : firstName(s.name)}</strong></span>
            <span className="badge tabular">{s.dice ? s.dice[0] + s.dice[1] : '—'}</span>
          </div>
        ))}
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          {m().orderHelp}
        </p>
      </section>
      <button type="button" className="primary block" disabled={busy} onClick={() => act({ type: 'beginPlay' })}>
        {m().letsPlay}
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
        <span>{m().yourBalance}</span>
      </section>

      <div className="row between" style={{ margin: '12px 0 0' }}>
        <span className="row" style={{ gap: 8 }}>
          <span className="player-chip" style={{ background: 'transparent', padding: 0 }}>
            <Token token={me?.token ?? null} color={me?.color} size={30} />
            <span className="col" style={{ gap: 0 }}>
              <strong style={{ fontSize: '0.92rem' }}>{t.common.you}</strong>
              <small className="muted">
                {state.order[0] === uid ? m().youStarted : m().started(firstName(state.seats.find((s) => s.uid === state.order[0])?.name ?? ''))}
              </small>
            </span>
          </span>
        </span>
        <button type="button" disabled={busy || rolling} onClick={roll}>
          <Icon name="dice" size={18} /> {m().roll}
        </button>
      </div>

      {flash && (
        <div className="room-banner" style={{ marginTop: 12 }}>
          <Dice dice={flash.dice} />
          <span className="grow">
            <strong>{flash.uid === uid ? t.common.you : firstName(state.seats.find((s) => s.uid === flash.uid)?.name ?? m().someone)}</strong>
            {m().rolled}
            <strong className="tabular">{flash.total}</strong>
          </span>
        </div>
      )}

      <div className="action-grid action-grid-4">
        <button type="button" onClick={() => setDialog('buy')}>
          <Icon name="tag" size={24} /><span>{m().buy}</span>
        </button>
        <button type="button" onClick={() => setDialog('send')}>
          <Icon name="send" size={24} /><span>{m().send}</span>
        </button>
        <button type="button" onClick={() => setDialog('pay')}>
          <Icon name="bank" size={24} /><span>{m().payBank}</span>
        </button>
        <button type="button" onClick={() => setDialog('request')}>
          <Icon name="cash" size={24} /><span>{m().request}</span>
        </button>
      </div>

      <section className="card">
        <h3>{m().everyoneElse}</h3>
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
        <h3>{m().yourMoney}</h3>
        {recent.length === 0 ? <p className="empty">{m().nothingYet}</p> : (
          <ul className="entries">
            {recent.map((e) => <LogRow key={e.id} entry={e} uid={uid} seats={state.seats} />)}
          </ul>
        )}
      </section>

      <button type="button" className="block" onClick={() => setLeaving(true)}>{m().endGame}</button>

      {/* Buying a property off the board on the table */}
      <Sheet open={dialog === 'buy'} title={m().buyProperty} onClose={close}>
        <div className="col">
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            {m().fromBoardBefore}<strong>{m().boards[bankBoard.id] ?? bankBoard.name}</strong>{m().fromBoardAfter}
          </p>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={m().search} aria-label={m().searchProperties} />
          <div className="col" style={{ gap: 6, maxHeight: '46vh', overflowY: 'auto' }}>
            {forSale.length === 0 && <p className="empty">{m().nothingLeft}</p>}
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
      <Sheet open={dialog === 'send'} title={m().sendMoney} onClose={close}>
        <div className="col">
          <span className="field"><span>{m().to}</span></span>
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
            <span>{m().amount}</span>
            <input className="money-input" type="number" inputMode="numeric" min={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
          </label>
          <label className="field">
            <span>{m().whatForOptional}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder={m().rentExample} />
          </label>
          <button type="button" className="primary block" disabled={busy || !target || !valid}
            onClick={() => submit({ type: 'send', to: target, amount: value, note })}>
            <Icon name="send" size={16} /> {m().sendAmount(valid ? money(value) : '')}
          </button>
        </div>
      </Sheet>

      {/* Pay the bank */}
      <Sheet open={dialog === 'pay'} title={m().payTheBank} onClose={close}>
        <div className="col">
          <label className="field">
            <span>{m().whatFor}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {PAY_REASONS.map((r) => <option key={r} value={r}>{m().payReasons[r] ?? r}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{m().amount}</span>
            <input className="money-input" type="number" inputMode="numeric" min={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
            <small className="muted">{m().youHave(money(me?.balance))}</small>
          </label>
          <button type="button" className="primary block" disabled={busy || !valid}
            onClick={() => submit({ type: 'payBank', amount: value, reason })}>
            <Icon name="bank" size={16} /> {m().payAmount(valid ? money(value) : '')}
          </button>
        </div>
      </Sheet>

      {/* Ask the bank */}
      <Sheet open={dialog === 'request'} title={m().requestTitle} onClose={close}>
        <div className="col">
          <p className="row" style={{ gap: 8, margin: 0, color: 'var(--warning)' }}>
            <Icon name="info" size={16} /> {m().othersApprove}
          </p>
          <label className="field">
            <span>{m().amount}</span>
            <input className="money-input" type="number" inputMode="numeric" min={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="200" autoFocus />
          </label>
          <label className="field">
            <span>{m().whatFor}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder={m().passedGo} />
          </label>
          <button type="button" className="primary block" disabled={busy || !valid}
            onClick={() => submit({ type: 'requestBank', amount: value, reason: note })}>
            {m().askFor(valid ? money(value) : '')}
          </button>
        </div>
      </Sheet>

      {/* Someone else wants money from the bank: everyone has to answer. */}
      <Sheet open={!!request && !!requester} title={m().bankRequest}>
        {request && requester && (
          <div className="col">
            <div className="col" style={{ alignItems: 'center', gap: 6 }}>
              <Token token={requester.token} color={requester.color} size={56} />
              <strong>{m().wants(firstName(requester.name), money(request.amount))}</strong>
              {request.reason && <small className="muted">{request.reason}</small>}
            </div>
            <div>
              <div className="row between">
                <small className="muted">{m().approvals}</small>
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
                <Icon name="check" size={16} /> {m().youApproved}
              </p>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="danger-fill grow" disabled={busy}
                  onClick={() => act({ type: 'respondBank', id: request.id, approve: false })}>
                  {m().reject}
                </button>
                <button type="button" className="success-fill grow" disabled={busy}
                  onClick={() => act({ type: 'respondBank', id: request.id, approve: true })}>
                  {m().approve}
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* Ending the game needs everyone's agreement. */}
      <Sheet open={leaving && state.phase === 'playing'} title={m().endTitle} onClose={() => setLeaving(false)}>
        <div className="col">
          <p className="muted" style={{ margin: 0 }}>
            {m().endHelp}
          </p>
          <button type="button" className="primary block" disabled={busy}
            onClick={async () => { if (await act({ type: 'endGame' })) setLeaving(false); }}>
            {m().askFinish}
          </button>
        </div>
      </Sheet>

      <Sheet open={state.phase === 'endVote'} title={m().endTitle}>
        {state.endVote && (
          <div className="col">
            <p style={{ margin: 0 }}>
              <strong>
                {state.endVote.by === uid ? t.common.you : firstName(state.seats.find((s) => s.uid === state.endVote!.by)?.name ?? m().someone)}
              </strong>
              {m().wantsFinish}
            </p>
            <div>
              <div className="row between">
                <small className="muted">{m().agreed}</small>
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
                <Icon name="check" size={16} /> {m().waitingOthers}
              </p>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="grow" disabled={busy}
                  onClick={() => act({ type: 'respondEnd', approve: false })}>
                  {m().keepPlaying}
                </button>
                <button type="button" className="primary grow" disabled={busy}
                  onClick={() => act({ type: 'respondEnd', approve: true })}>
                  {m().finish}
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
  const name = (u: string) => firstName(seats.find((s) => s.uid === u)?.name ?? m().someone);
  let icon: IconName = 'bank';
  let label = '';
  let out = true;

  if (entry.kind === 'transfer') {
    out = entry.from === uid;
    icon = out ? 'out' : 'in';
    label = out ? m().logTo(name(entry.to)) : m().logFrom(name(entry.from));
    if (entry.note) label += ` · ${noteText(entry.note)}`;
  } else if (entry.kind === 'payBank') {
    label = m().logBank(entry.note ? noteText(entry.note) : m().payment);
  } else {
    out = false;
    label = m().logBank(entry.note ? noteText(entry.note) : m().received);
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

const cornerName = (kind: string): string => (m().spaces as Record<string, string>)[kind] ?? kind;

/** What to call a space in a sentence. */
function spaceLabel(board: ReturnType<typeof boardOf>, index: number): string {
  const space = board.spaces[index];
  if (!space) return '';
  return 'name' in space ? space.name : cornerName(space.kind);
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
          <span className="grow">{cardText(state.card.text)}</span>
        </div>
      )}

      {/* Where you are, spelled out — the one space you always need to be able to read. */}
      {me && !me.bankrupt && (
        <button type="button" className="here-card" onClick={() => setLooking(me.position)}>
          <Token token={me.token} color={me.color} size={30} />
          <span className="grow col" style={{ gap: 0, minWidth: 0 }}>
            <small className="muted">{me.jailTurns > 0 ? m().inJail : m().youAreOn}</small>
            <strong className="truncate">{spaceLabel(board, me.position)}</strong>
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      <div className="row between" style={{ margin: '12px 0' }}>
        <span className="turn-pill">
          {me?.bankrupt ? m().youAreOut : myTurn ? t.cast.yourTurn : t.cast.turnOf(firstName(onMove?.name ?? ''))}
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
            <Icon name="dice" size={24} /><span>{m().roll}</span>
          </button>
          <button type="button" disabled={busy || buildable.length === 0} onClick={() => setBuilding(true)}>
            <Icon name="home" size={24} /><span>{m().build}</span>
          </button>
          <button type="button" disabled={busy || !state.rolled || !!pending || rollsAgain(state, uid)}
            onClick={() => act({ type: 'endTurn' })}>
            <Icon name="check" size={24} /><span>{m().endTurn}</span>
          </button>
        </div>
      )}

      <section className="card">
        <h3>{m().players}</h3>
        <div className="player-grid">
          {state.seats.map((s) => (
            <div key={s.uid} className="player-chip" style={{ opacity: s.bankrupt ? 0.5 : 1 }}>
              <Token token={s.token} color={s.color} size={30} />
              <span className="grow" style={{ minWidth: 0 }}>
                <small className="truncate">
                  {s.uid === uid ? t.common.you : firstName(s.name)}
                  {s.jailTurns > 0 && m().inJailTag}
                  {s.bankrupt && m().outTag}
                </small>
                <b>{state.settings.showBalances || s.uid === uid
                  ? `${board.currency}${s.balance.toLocaleString()}`
                  : '•••'}</b>
              </span>
            </div>
          ))}
        </div>
      </section>

      <Sheet open={!!pending && myTurn} title={m().buyIt}>
        {pending && offered && isOwnable(offered) && (
          <div className="col">
            <p style={{ margin: 0 }}>
              {m().unownedBefore}<strong>{offered.name}</strong>{m().unownedMiddle}
              <strong>{board.currency}{pending.price.toLocaleString()}</strong>{m().unownedAfter}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {m().noAuction}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="grow" disabled={busy} onClick={() => act({ type: 'decline' })}>
                {m().noThanks}
              </button>
              <button type="button" className="primary grow" disabled={busy} onClick={() => act({ type: 'buy' })}>
                {m().buyItButton}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      </div>

      <SpaceSheet state={state} board={board} index={looking} onClose={() => setLooking(null)} />

      <Sheet open={building} title={m().buildHouse} onClose={() => setBuilding(false)}>
        <div className="col">
          {buildable.length === 0 ? (
            <p className="empty">{m().nothingToBuild}</p>
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
                    : <span className="muted">{m().noHouses}</span>}
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
    <span className="row" style={{ gap: 1 }} title={m().houses(count)}>
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
        <h1>{m().finalStandings}</h1>
        <p className="muted" style={{ margin: 0 }}>{m().standingsHelp}</p>
      </div>

      {ranked.map((s, i) => (
        <div key={s.uid} className={`rank-row${i === 0 ? ' winner' : ''}`}>
          <span className="rank-medal" aria-hidden>
            {i === 0 ? <Icon name="trophy" size={22} /> : i + 1}
          </span>
          <Token token={s.token} color={s.color} size={30} />
          <span className="grow col" style={{ gap: 0, minWidth: 0 }}>
            <strong className="truncate">{s.uid === uid ? t.common.you : firstName(s.name)}</strong>
            <small className="muted tabular">
              {m().wealth(money(s.balance), money(propertyValue(state, s.uid)))}
              {s.bankrupt && m().bankrupt}
            </small>
          </span>
          <strong className="tabular">{money(totalWealth(state, s))}</strong>
        </div>
      ))}

      <div style={{ marginTop: 16 }}><BalanceChart state={state} /></div>

      {owner ? (
        <button type="button" className="primary block" disabled={busy}
          onClick={() => act({ type: 'newGame' })}>
          {t.cast.playAgain}
        </button>
      ) : (
        <p className="empty">{m().hostCanStart}</p>
      )}
    </>
  );
}
