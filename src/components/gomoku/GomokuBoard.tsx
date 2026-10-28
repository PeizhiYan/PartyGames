import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SIZE, colOf, idx, rowOf, type Board, type Player } from '../../domain/gomoku/board';
import './GomokuBoard.css';

/** Board padding and stone size as a share of one cell, so everything scales with the canvas. */
const PAD_CELLS = 0.72;
const STONE = 0.44;
const STAR_POINTS = [idx(3, 3), idx(3, 11), idx(7, 7), idx(11, 3), idx(11, 11)];
const COLUMN_LABELS = 'ABCDEFGHJKLMNOP'; // 15 letters, I skipped, as on a real board

interface Props {
  board: Board;
  /** The stone the player would place. Null while watching or when it isn't their turn. */
  placing: Player | null;
  lastMove: number | null;
  winLine: number[];
  /** Per-cell scores from the AI's heat map, or null to hide it. */
  heat: number[] | null;
  onPlace: (cell: number) => void;
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * The board, drawn on a canvas so 225 intersections cost one element instead of 225.
 *
 * Tapping an intersection on a phone is easy to get wrong by a cell, so a tap only *aims*: it puts
 * a translucent stone down and a confirm button appears under the board. Tapping the same
 * intersection again (or the button) plays it.
 */
export default function GomokuBoard({ board, placing, lastMove, winLine, heat, onPlace }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [aim, setAim] = useState<number | null>(null);

  // Forget the aim when it stops being this player's move. The board arrives as a fresh array on
  // every snapshot — including an opponent's presence heartbeat — so the board itself is not a
  // safe thing to watch here; an aimed-at point that gets taken is caught when drawing instead.
  useEffect(() => { setAim(null); }, [placing]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => setSize(Math.floor(Math.min(wrap.clientWidth, window.innerHeight * 0.62)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cell = size / (SIZE - 1 + 2 * PAD_CELLS);
    const pad = cell * PAD_CELLS;
    const at = (i: number) => ({ x: pad + colOf(i) * cell, y: pad + rowOf(i) * cell });
    const end = pad + (SIZE - 1) * cell;

    // Wood
    const wood = ctx.createLinearGradient(0, 0, size * 0.6, size);
    wood.addColorStop(0, cssVar(canvas, '--board-wood-1', '#e8c88a'));
    wood.addColorStop(1, cssVar(canvas, '--board-wood-2', '#d2a45c'));
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, size, size);
    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // The AI's heat map goes under the grid, so the lines stay readable on top of it.
    if (heat) {
      const peak = Math.max(...heat);
      if (peak > 0) {
        for (let i = 0; i < heat.length; i++) {
          if (board[i] !== 0 || heat[i] <= 0) continue;
          const t = heat[i] / peak;
          if (t < 0.08) continue;
          // Cool blue for quiet cells through to hot orange for the moves that matter.
          const r = t < 0.5 ? Math.round(60 + 390 * t) : 255;
          const g = t < 0.5 ? Math.round(110 + 200 * t) : Math.round(210 - 180 * (t - 0.5) * 2);
          const b = t < 0.5 ? Math.round(230 - 460 * t) : 0;
          const { x, y } = at(i);
          const radius = cell * (0.55 + 0.55 * t);
          const aura = ctx.createRadialGradient(x, y, 0, x, y, radius);
          aura.addColorStop(0, `rgba(${r},${g},${b},${(0.2 + 0.45 * t).toFixed(2)})`);
          aura.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Grid
    const line = cssVar(canvas, '--board-line', 'rgba(60,35,10,0.42)');
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(0.6, cell * 0.025);
    for (let k = 0; k < SIZE; k++) {
      const p = pad + k * cell;
      ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(end, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, end); ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.2, cell * 0.05);
    ctx.strokeRect(pad, pad, end - pad, end - pad);

    // Star points
    ctx.fillStyle = line;
    for (const i of STAR_POINTS) {
      const { x, y } = at(i);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.6, cell * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }

    const paintStone = (i: number, player: Player, alpha = 1) => {
      const { x, y } = at(i);
      const r = cell * STONE;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = r * 0.7;
      ctx.shadowOffsetY = r * 0.22;
      const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x + r * 0.1, y + r * 0.15, r * 1.1);
      if (player === 1) {
        body.addColorStop(0, '#6f6f6f');
        body.addColorStop(0.4, '#2c2c2c');
        body.addColorStop(1, '#000');
      } else {
        body.addColorStop(0, '#fff');
        body.addColorStop(0.5, '#f0f0f0');
        body.addColorStop(1, '#b9b9b9');
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Specular highlight, after the shadow is cleared.
      ctx.save();
      ctx.globalAlpha = alpha;
      const spec = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x - r * 0.3, y - r * 0.3, r * 0.75);
      spec.addColorStop(0, `rgba(255,255,255,${player === 1 ? 0.5 : 0.8})`);
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    for (let i = 0; i < board.length; i++) {
      if (board[i] !== 0) paintStone(i, board[i] as Player);
    }

    // The latest stone gets a dot, so it's obvious what just happened.
    if (lastMove !== null && board[lastMove] !== 0) {
      const { x, y } = at(lastMove);
      ctx.fillStyle = board[lastMove] === 1 ? '#ff5d8f' : '#c2185b';
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }

    // The winning five, struck through.
    if (winLine.length >= 2) {
      const first = at(winLine[0]);
      const last = at(winLine[winLine.length - 1]);
      ctx.strokeStyle = 'rgba(255,60,120,0.92)';
      ctx.lineWidth = Math.max(2.5, cell * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    if (aim !== null && placing && board[aim] === 0) {
      paintStone(aim, placing, 0.45);
      const { x, y } = at(aim);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.5, cell * 0.06);
      ctx.beginPath();
      ctx.arc(x, y, cell * (STONE + 0.14), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coordinates, drawn in the padding ring.
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.font = `${Math.max(7, cell * 0.34)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (let k = 0; k < SIZE; k++) {
      const p = pad + k * cell;
      ctx.textAlign = 'center';
      ctx.fillText(COLUMN_LABELS[k], p, pad * 0.45);
      ctx.textAlign = 'center';
      ctx.fillText(String(SIZE - k), pad * 0.42, p);
    }
  }, [board, placing, lastMove, winLine, heat, aim, size]);

  useEffect(() => { draw(); }, [draw]);

  function cellAt(clientX: number, clientY: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cell = rect.width / (SIZE - 1 + 2 * PAD_CELLS);
    const pad = cell * PAD_CELLS;
    const col = Math.round((clientX - rect.left - pad) / cell);
    const row = Math.round((clientY - rect.top - pad) / cell);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return idx(row, col);
  }

  function tap(clientX: number, clientY: number) {
    if (!placing) return;
    const cell = cellAt(clientX, clientY);
    if (cell === null || board[cell] !== 0) return;
    // Second tap on the same intersection plays it; a tap elsewhere just moves the aim.
    if (aim === cell) { setAim(null); onPlace(cell); }
    else setAim(cell);
  }

  return (
    <div className="gomoku" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="gomoku-canvas"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Gomoku board, ${board.filter((s) => s !== 0).length} stones played`}
        onPointerUp={(e) => tap(e.clientX, e.clientY)}
      />
      <div className="gomoku-confirm" aria-live="polite">
        {aim !== null && placing ? (
          <>
            <span className="muted">
              {COLUMN_LABELS[colOf(aim)]}{SIZE - rowOf(aim)}
            </span>
            <button type="button" className="primary small"
              onClick={() => { setAim(null); onPlace(aim); }}>Place stone</button>
            <button type="button" className="small" onClick={() => setAim(null)}>Cancel</button>
          </>
        ) : (
          placing && <span className="muted">Tap an intersection, then tap again to place.</span>
        )}
      </div>
    </div>
  );
}
