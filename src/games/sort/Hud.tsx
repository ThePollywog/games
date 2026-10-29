import { motion } from 'framer-motion';
import { ChevronLeft, Coins, Lightbulb, Plus, RotateCcw, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { CoinPill } from '../../ui/ProfileBar';

export const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function GameTopBar({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack(): void; right?: ReactNode }) {
  return (
    <header className="topbar game">
      <button className="icon-btn" onClick={onBack} aria-label="Back">
        <ChevronLeft />
      </button>
      <div className="title-stack">
        <h1>{title}</h1>
        {sub && <span>{sub}</span>}
      </div>
      {right ?? <CoinPill />}
    </header>
  );
}

export function Stat({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className={`stat${warn ? ' warn' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface ToolbarProps {
  canUndo: boolean;
  onUndo(): void;
  onRestart(): void;
  onHint(): void;
  onTube(): void;
  hintCost: number;
  tubeCost: number;
  tubeUsed: boolean;
  /** What the extra container is called in this game (bottle, channel, bollard). */
  container: string;
  undos: number;
  /** Pours still animating: board-changing actions wait for them to land. */
  busy?: boolean;
}

export function Toolbar(p: ToolbarProps) {
  const cost = (n: number) =>
    n > 0 ? (
      <span className="cost">
        <Coins size={11} />
        {n}
      </span>
    ) : (
      <span className="cost free">free</span>
    );
  return (
    <nav className="toolbar">
      <motion.button whileTap={{ scale: 0.9 }} onClick={p.onUndo} disabled={!p.canUndo || p.busy}>
        <Undo2 />
        <span>Undo</span>
        {p.undos > 0 && <span className="cost">{p.undos}</span>}
      </motion.button>
      <motion.button whileTap={{ scale: 0.9 }} onClick={p.onRestart} disabled={p.busy}>
        <RotateCcw />
        <span>Restart</span>
      </motion.button>
      <motion.button whileTap={{ scale: 0.9 }} onClick={p.onHint} disabled={p.busy}>
        <Lightbulb />
        <span>Hint</span>
        {cost(p.hintCost)}
      </motion.button>
      <motion.button whileTap={{ scale: 0.9 }} onClick={p.onTube} disabled={p.tubeUsed || p.busy}>
        <Plus />
        <span className="cap">{p.container}</span>
        {p.tubeUsed ? <span className="cost">used</span> : cost(p.tubeCost)}
      </motion.button>
    </nav>
  );
}
