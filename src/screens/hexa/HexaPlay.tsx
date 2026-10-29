import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Bomb, Coins, Flag, Shuffle, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { utcDay } from '../../../shared/dates.ts';
import {
  apply,
  CELLS,
  CLEAR_AT,
  hexDailySeed,
  hexRunSeed,
  isFull,
  STONE,
  STONE_EVERY,
  MAX_HAMMERS,
  MAX_SHUFFLES,
  newGame,
  topRun,
  type HexAction,
  type HexState,
  type Stack,
  type Step,
} from '../../../shared/hexa/engine.ts';
import { randomSeed } from '../../../shared/rng.ts';
import { GameTopBar, Stat } from '../../games/sort/Hud';
import { paletteById, textOn } from '../../games/sort/palettes';
import { api, syncStats, type SubmitResponse } from '../../platform/api';
import { buzz, sfx } from '../../platform/feedback';
import { toast } from '../../platform/notify';
import { useArcade } from '../../platform/store';
import { go, type HexaMode } from '../../router';
import { Modal } from '../../ui/Modal';
import { useUi } from '../../ui/uiStore';

export const HAMMER_COST = 40;
export const SHUFFLE_COST = 30;

const SQ3 = Math.sqrt(3);
/** Board height in hex radii: 7 rows, plus room for stacks drawn upward from the top row. */
const GRID_H = 12.4;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cloneCells = (c: Stack[]) => c.map((s) => s.slice());

function hexPoints(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** A stack drawn as layered hex tiles rising from (cx, cy). */
function StackSvg({ stack, cx, cy, r, colors, label = true }: { stack: Stack; cx: number; cy: number; r: number; colors: string[]; label?: boolean }) {
  if (stack[0] === STONE) {
    return (
      <g className="hex-stone">
        <polygon points={hexPoints(cx, cy + r * 0.12, r * 0.86)} fill="#465351" />
        <polygon points={hexPoints(cx, cy, r * 0.86)} fill="#6e7a7f" stroke="#1c2d31" strokeWidth={2} />
        <text x={cx} y={cy + r * 0.2} textAnchor="middle" fontSize={r * 0.6}>
          🪨
        </text>
      </g>
    );
  }
  const th = Math.min(r * 0.16, (r * 2.2) / Math.max(1, stack.length));
  return (
    <g>
      {stack.map((c, k) => {
        const y = cy - k * th;
        return (
          <g key={k}>
            <polygon points={hexPoints(cx, y + th * 0.6, r * 0.88)} fill={shade(colors[c], 0.6)} />
            <polygon points={hexPoints(cx, y, r * 0.88)} fill={colors[c]} stroke={shade(colors[c], 0.75)} strokeWidth={1} />
          </g>
        );
      })}
      {label && stack.length > 0 && (
        <text x={cx} y={cy - (stack.length - 1) * th + r * 0.18} textAnchor="middle" className="hex-count" fontSize={r * 0.55} style={{ fill: textOn(colors[stack[stack.length - 1]]) }}>
          {topRun(stack)}
        </text>
      )}
    </g>
  );
}

interface Burst {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export function HexaPlay({ mode }: { mode: HexaMode }) {
  const [runKey, setRunKey] = useState(0);
  return <HexaGame key={`${mode}:${runKey}`} mode={mode} onAgain={() => setRunKey((k) => k + 1)} />;
}

function HexaGame({ mode, onAgain }: { mode: HexaMode; onAgain(): void }) {
  const settings = useArcade((s) => s.settings);
  const palette = paletteById(useArcade((s) => s.palette));
  const colors = palette.colors;
  const date = useMemo(() => utcDay(), []);
  const runSeed = useMemo(() => randomSeed().replace(/[^a-z0-9]/g, '').padEnd(6, '0'), []);
  const seed = mode === 'daily' ? hexDailySeed(date) : hexRunSeed(runSeed);
  // Fixed at start: finishing the daily records it, which must not flip this mid-game.
  const [ranked] = useState(() => mode === 'endless' || !useArcade.getState().hexa.daily[utcDay()]);

  const game = useRef<HexState>(newGame(seed));
  const log = useRef<HexAction[]>([]);
  const start = useRef(performance.now());
  const [cells, setCells] = useState<Stack[]>(() => cloneCells(game.current.cells));
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const [selected, setSelected] = useState<number | null>(null);
  const [hammer, setHammer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [over, setOver] = useState(false);
  const [submit, setSubmit] = useState<{ res?: SubmitResponse; error?: string } | null>(null);
  const [payout, setPayout] = useState<{ xp: number; coins: number; best: boolean } | null>(null);
  const [drag, setDrag] = useState<{ slot: number; x: number; y: number; x0: number; y0: number } | null>(null);
  const svgWrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 360, height: 0 });

  useEffect(() => {
    const el = svgWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = game.current;
  // The svg fills the board area exactly (so bursts and confetti share its coordinates) and the
  // grid, GRID_H radii tall, is fitted to both its width and height so it never runs under the tray.
  const { width, height } = box;
  const r = Math.min(Math.min(520, width) / (SQ3 * 7.4), height / GRID_H);
  const top = (height - r * GRID_H) / 2;
  const pos = (i: number) => {
    const [q, rr] = CELLS[i];
    return { x: width / 2 + r * SQ3 * (q + rr / 2), y: top + r * 2.2 + r * 1.5 * (rr + 3) };
  };
  const full = isFull(g);

  function addBurst(cell: number, text: string, color: string) {
    const p = pos(cell);
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x: p.x, y: p.y, text, color }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
  }

  async function play(steps: Step[], from: Stack[]) {
    const view = from;
    for (const st of steps) {
      await wait(st.kind === 'move' ? 150 : 260);
      if (st.kind === 'move') {
        const moved = view[st.from].splice(view[st.from].length - st.count, st.count);
        view[st.to].push(...moved);
        setPulse(st.to);
        sfx.ball(Math.min(6, view[st.to].length / 2));
      } else if (st.kind === 'stone') {
        view[st.cell] = [STONE];
        addBurst(st.cell, '🪨', '#465351');
        sfx.error();
        buzz(40);
      } else {
        view[st.cell].splice(view[st.cell].length - st.count, st.count);
        addBurst(st.cell, `+${st.points}${st.chain > 1 ? ` ×${st.chain}` : ''}`, colors[st.color]);
        sfx.complete(st.chain);
        buzz(st.chain > 1 ? [20, 40, 30] : 25);
        if (!settings.reducedMotion) {
          const rect = svgWrap.current?.getBoundingClientRect();
          const p = pos(st.cell);
          if (rect) void confetti({ particleCount: 40, spread: 80, startVelocity: 20, scalar: 0.7, ticks: 80, colors: [colors[st.color], '#fff'], origin: { x: (rect.left + p.x) / innerWidth, y: (rect.top + p.y) / innerHeight } });
        }
      }
      setCells(cloneCells(view));
    }
    setPulse(null);
  }

  async function act(a: HexAction, preview?: (c: Stack[]) => void) {
    if (busy || over) return;
    const before = cloneCells(g.cells);
    const steps = apply(g, seed, a);
    if (!steps) return;
    log.current.push(a);
    preview?.(before);
    setCells(cloneCells(before));
    rerender();
    setBusy(true);
    await play(steps, before);
    setCells(cloneCells(g.cells));
    setBusy(false);
    rerender();
  }

  function place(slot: number, cell: number) {
    const piece = g.tray[slot];
    if (!piece || g.cells[cell].length) {
      sfx.error();
      return;
    }
    setSelected(null);
    sfx.tap();
    buzz(10);
    void act(['p', slot, cell], (view) => {
      view[cell] = piece.slice();
    });
  }

  function tapCell(cell: number) {
    if (busy || over) return;
    if (hammer) {
      if (!g.cells[cell].length) return;
      if (!useArcade.getState().spend(HAMMER_COST)) return noCoins(HAMMER_COST);
      setHammer(false);
      addBurst(cell, '💥', '#e7730c');
      sfx.error();
      void act(['h', cell]);
      return;
    }
    if (selected !== null) place(selected, cell);
  }

  function noCoins(cost: number) {
    sfx.error();
    toast({ icon: '🪙', title: 'Not enough coins', body: `That costs ${cost}. Keep playing to earn more.` });
  }

  function shuffleTray() {
    if (busy || over || g.shuffles >= MAX_SHUFFLES) return;
    if (!useArcade.getState().spend(SHUFFLE_COST)) return noCoins(SHUFFLE_COST);
    setSelected(null);
    sfx.coin();
    void act(['s']);
  }

  function finish() {
    if (over) return;
    setOver(true);
    const timeMs = performance.now() - start.current;
    const s = useArcade.getState();
    const best = g.score > s.hexa.best;
    const xp = 10 + Math.floor(g.score / 40);
    const coins = Math.floor(g.score / 150) + Math.floor(g.cleared / 50) * 5;
    const daily = mode === 'daily' && ranked ? { ...s.hexa.daily, [date]: { score: g.score } } : s.hexa.daily;
    useArcade.setState({
      hexa: { best: Math.max(s.hexa.best, g.score), daily },
      stats: {
        ...s.stats,
        hexaGames: s.stats.hexaGames + 1,
        hexaCleared: s.stats.hexaCleared + g.cleared,
        hexaBestChain: Math.max(s.stats.hexaBestChain, g.bestChain),
        played: { ...s.stats.played, 'hex-marks-the-spot': (s.stats.played['hex-marks-the-spot'] ?? 0) + 1 },
      },
    });
    s.addRewards({ xp, coins });
    if (g.cleared > 0) s.touchStreak();
    syncStats();
    setPayout({ xp, coins, best });
    sfx.win();
    if (ranked && log.current.length) {
      const req = mode === 'daily' ? api.submitHexDaily(date, log.current, timeMs) : api.submitHexRun(runSeed, log.current, timeMs);
      req.then((res) => setSubmit({ res })).catch((e: Error) => setSubmit({ error: e.message }));
    }
  }

  // Board full and no way to make room: the game ends on its own.
  useEffect(() => {
    if (!busy && full && !over && g.hammers >= MAX_HAMMERS) finish();
  });

  // ---- drag & drop from the tray ----
  function startDrag(slot: number, e: RPointerEvent) {
    if (busy || over || !g.tray[slot]) return;
    setHammer(false);
    setSelected(slot);
    setDrag({ slot, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function moveDrag(e: RPointerEvent) {
    if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY });
  }
  function endDrag(e: RPointerEvent) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    // A plain tap just selects the piece; only a real drag drops it.
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 12) return;
    const el = document.elementFromPoint(e.clientX, e.clientY - 40)?.closest('[data-cell]');
    const cell = el ? Number(el.getAttribute('data-cell')) : NaN;
    if (Number.isInteger(cell) && !g.cells[cell].length) place(d.slot, cell);
  }

  const placeable = selected !== null && !hammer;
  const trayR = Math.min(34, width / 11);

  return (
    <div className="screen play hexa" style={{ background: palette.bg }} onPointerMove={moveDrag} onPointerUp={endDrag}>
      <GameTopBar
        title={mode === 'daily' ? 'Daily Dig' : 'Hex Marks the Spot'}
        sub={mode === 'daily' ? (ranked ? 'Ranked · first dig counts' : 'Practice') : 'Endless voyage · weekly board'}
        onBack={() => go({ name: 'hexa-home' })}
      />
      <div className="hud">
        <Stat label="Score" value={g.score.toLocaleString()} />
        <Stat label="Cleared" value={g.cleared} />
        <Stat label="Best chain" value={g.bestChain ? `x${g.bestChain}` : '—'} />
      </div>
      {/* A fixed-height slot, so the map keeps its size and position as this line grows. */}
      <div className="play-note">
        <p className="tip subtle">
          Stack {CLEAR_AT} of a color to dig it up. A reef rock surfaces every {STONE_EVERY} placements
          {g.placed ? ` — next in ${STONE_EVERY - (g.placed % STONE_EVERY)}` : ''}.
        </p>
      </div>

      <div className="hexa-board" ref={svgWrap}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {CELLS.map((_, i) => {
            const p = pos(i);
            const empty = cells[i].length === 0;
            return (
              <g key={i} data-cell={i} onPointerUp={() => !drag && tapCell(i)} className={`hex-cell${empty && placeable ? ' open' : ''}${hammer && !empty ? ' target' : ''}${pulse === i ? ' pulse' : ''}`}>
                <polygon points={hexPoints(p.x, p.y, r * 0.96)} className="hex-slot" />
                <StackSvg stack={cells[i]} cx={p.x} cy={p.y} r={r} colors={colors} />
              </g>
            );
          })}
        </svg>
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.div
              key={b.id}
              className="hex-burst"
              style={{ left: b.x, top: b.y, color: b.color }}
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: 1, scale: 1.1, y: -40 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {b.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="hexa-tray">
        {g.tray.map((piece, slot) => (
          <button
            key={slot}
            className={`tray-slot${selected === slot ? ' selected' : ''}${drag?.slot === slot ? ' dragging' : ''}`}
            disabled={!piece || busy || over}
            onPointerDown={(e) => startDrag(slot, e)}
            aria-label={`Piece ${slot + 1}`}
          >
            {piece && (
              <svg width={trayR * 2.4} height={trayR * 3.2}>
                <StackSvg stack={piece} cx={trayR * 1.2} cy={trayR * 2.3} r={trayR} colors={colors} label={false} />
              </svg>
            )}
          </button>
        ))}
      </div>

      <nav className="toolbar three">
        <motion.button whileTap={{ scale: 0.9 }} className={hammer ? 'active' : ''} disabled={busy || over || g.hammers >= MAX_HAMMERS} onClick={() => (setHammer((h) => !h), setSelected(null))}>
          <Bomb />
          <span>Cannon</span>
          <span className="cost">
            <Coins size={11} />
            {HAMMER_COST}
          </span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} disabled={busy || over || g.shuffles >= MAX_SHUFFLES} onClick={shuffleTray}>
          <Shuffle />
          <span>Shuffle</span>
          <span className="cost">
            <Coins size={11} />
            {SHUFFLE_COST}
          </span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} disabled={busy || over} onClick={finish}>
          <Flag />
          <span>End game</span>
        </motion.button>
      </nav>

      {drag && g.tray[drag.slot] && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) >= 12 && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y - 40 }}>
          <svg width={r * 2.4} height={r * 3.2}>
            <StackSvg stack={g.tray[drag.slot]!} cx={r * 1.2} cy={r * 2.3} r={r} colors={colors} label={false} />
          </svg>
        </div>
      )}

      {full && !over && !busy && (
        <motion.div className="stuck" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <strong>Map full!</strong>
          <span>
            Blast a stack with the cannon ({MAX_HAMMERS - g.hammers} left) or end the voyage.
          </span>
        </motion.div>
      )}

      <Modal open={over} onClose={() => go({ name: 'hexa-home' })} dismissable={false}>
        <div className="win">
          <h2>{payout?.best ? 'New best haul!' : 'Voyage over'}</h2>
          <div className="big-score">{g.score.toLocaleString()}</div>
          <p className="muted">
            {g.cleared} tiles cleared · {g.placed} stacks placed{g.bestChain > 1 ? ` · x${g.bestChain} chain` : ''}
          </p>
          <div className="reward-chips">
            {!!payout?.xp && <span className="chip xp">+{payout.xp} XP</span>}
            {!!payout?.coins && (
              <span className="chip coin">
                <Coins size={14} /> +{payout.coins}
              </span>
            )}
          </div>
          {ranked && log.current.length > 0 && (
            <div className="rank-box">
              {!submit && <span className="muted">Verifying game…</span>}
              {submit?.res?.best && (
                <span>
                  <Trophy size={16} /> {mode === 'daily' ? 'Today' : 'This week'}: <strong>#{submit.res.best.rank}</strong>
                </span>
              )}
              {submit?.error && <span className="muted">Couldn't reach the leaderboard.</span>}
            </div>
          )}
          <div className="win-actions">
            <button className="btn" onClick={() => useUi.getState().open('leaderboard', { game: 'hex-marks-the-spot', tab: mode === 'daily' ? 'daily' : 'weekly' })}>
              Leaderboard
            </button>
            <button className="btn primary" onClick={onAgain}>
              Play again
            </button>
          </div>
          <button className="link center" onClick={() => go({ name: 'hexa-home' })}>
            Back to menu
          </button>
        </div>
      </Modal>
    </div>
  );
}
