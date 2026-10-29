import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Trophy, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { randomSeed } from '../../../shared/rng.ts';
import { isStuck } from '../../../shared/sort/engine.ts';
import { blitzLevel, type SortGameId } from '../../../shared/sort/levels.ts';
import { BLITZ_BONUS_MS, BLITZ_MS, scoreLevel } from '../../../shared/sort/scoring.ts';
import { createSession, type Action } from '../../../shared/sort/session.ts';
import { SORT_META } from '../../games/registry';
import { Board } from '../../games/sort/Board';
import { fmtTime, GameTopBar, Stat, Toolbar } from '../../games/sort/Hud';
import { paletteById } from '../../games/sort/palettes';
import { awardBlitzRun, awardSolve, HINT_COST, TUBE_COST } from '../../games/sort/rewards';
import { useGameControls } from '../../games/sort/useGameControls';
import { api, type SubmitResponse } from '../../platform/api';
import { buzz, sfx } from '../../platform/feedback';
import { useArcade } from '../../platform/store';
import { go } from '../../router';
import { Modal } from '../../ui/Modal';
import { useUi } from '../../ui/uiStore';

type Phase = 'ready' | 'playing' | 'over';

export function SortBlitz({ game }: { game: SortGameId }) {
  const [runKey, setRunKey] = useState(0);
  return <BlitzRun key={runKey} game={game} onAgain={() => setRunKey((k) => k + 1)} />;
}

function BlitzRun({ game, onAgain }: { game: SortGameId; onAgain(): void }) {
  const home = () => go({ name: 'sort-home', game });
  const settings = useArcade((s) => s.settings);
  const palette = paletteById(useArcade((s) => s.palette));
  const best = useArcade((s) => s.sort[game].blitzBest);
  const runSeed = useMemo(() => randomSeed().replace(/[^a-z0-9]/g, '').padEnd(6, '0'), []);
  const [phase, setPhase] = useState<Phase>('ready');
  const [index, setIndex] = useState(0);
  const level = useMemo(() => blitzLevel(game, runSeed, index), [game, runSeed, index]);
  const [session, setSession] = useState(() => createSession(level));
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const [busy, setBusy] = useState(false);
  const controls = useGameControls(session, rerender, { hint: HINT_COST, tube: TUBE_COST }, busy, SORT_META[game].container);

  const deadline = useRef(0);
  const levelStart = useRef(0);
  const logs = useRef<{ actions: Action[]; timeMs: number }[]>([]);
  const [score, setScore] = useState(0);
  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState<{ id: number; pts: number } | null>(null);
  const [submit, setSubmit] = useState<{ res?: SubmitResponse; error?: string } | null>(null);
  const [payout, setPayout] = useState<{ coins: number; newBest: boolean } | null>(null);

  const remaining = Math.max(0, deadline.current - now);

  useEffect(() => {
    if (phase !== 'playing') return;
    let lastTick = -1;
    const t = setInterval(() => {
      const n = performance.now();
      setNow(n);
      const secs = Math.ceil((deadline.current - n) / 1000);
      if (secs <= 5 && secs > 0 && secs !== lastTick) {
        lastTick = secs;
        sfx.tick();
      }
      if (n >= deadline.current) end();
    }, 100);
    return () => clearInterval(t);
  });

  function begin() {
    const t = performance.now();
    deadline.current = t + BLITZ_MS;
    levelStart.current = t;
    setNow(t);
    setPhase('playing');
  }

  const ended = useRef(false);
  function end() {
    if (ended.current) return;
    ended.current = true;
    setPhase('over');
    sfx.win();
    buzz([40, 60, 40]);
    const solved = logs.current.length;
    setPayout(awardBlitzRun(game, solved, score));
    if (solved > 0) {
      api
        .submitBlitz(game, runSeed, logs.current)
        .then((res) => setSubmit({ res }))
        .catch((e: Error) => setSubmit({ error: e.message }));
    }
  }

  function solvedLevel() {
    const t = performance.now();
    const timeMs = t - levelStart.current;
    const stats = session.stats();
    const s = scoreLevel(level, stats, timeMs, { timeBonus: false });
    logs.current.push({ actions: [...session.log], timeMs });
    awardSolve({ game, mode: 'blitz', level, stats, score: s, timeMs });
    setScore((x) => x + s.total);
    deadline.current += BLITZ_BONUS_MS;
    setFlash({ id: t, pts: s.total });
    const next = index + 1;
    setTimeout(() => {
      const lvl = blitzLevel(game, runSeed, next);
      setIndex(next);
      setSession(createSession(lvl));
      controls.setHint(null);
      levelStart.current = performance.now();
    }, 350);
  }

  const stats = session.stats();
  const stuck = phase === 'playing' && !busy && !stats.solved && isStuck(session.board);
  const low = remaining < 10_000;

  return (
    <div className={`screen play blitz theme-${game}`} style={{ background: palette.bg }}>
      <GameTopBar title="Blitz" sub={`Puzzle ${index + 1}`} onBack={home} />
      <div className="blitz-clock">
        <div className={`clock${low ? ' low' : ''}`}>{phase === 'ready' ? fmtTime(BLITZ_MS) : fmtTime(remaining + 999)}</div>
        <div className="bar">
          <div style={{ width: `${Math.min(100, (remaining / BLITZ_MS) * 100)}%` }} className={low ? 'low' : ''} />
        </div>
      </div>
      <div className="hud">
        <Stat label="Score" value={score.toLocaleString()} />
        <Stat label="Solved" value={logs.current.length} />
        <Stat label="Moves" value={stats.moves} />
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            className="blitz-flash"
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -10, scale: 1 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => setTimeout(() => setFlash((f) => (f?.id === flash.id ? null : f)), 500)}
          >
            +{flash.pts} · +5s
          </motion.div>
        )}
      </AnimatePresence>

      <Board
        key={index}
        session={session}
        skin={SORT_META[game].skin}
        palette={palette}
        colorblind={settings.colorblind}
        reducedMotion={settings.reducedMotion}
        hint={controls.hint}
        disabled={phase !== 'playing'}
        onPour={() => {
          controls.setHint(null);
          rerender();
        }}
        onSettled={(r) => r.solved && phase === 'playing' && solvedLevel()}
        onBusyChange={setBusy}
      />

      {stuck && (
        <div className="stuck">
          <strong>Stuck!</strong>
          <span>Undo or restart — the clock is ticking.</span>
        </div>
      )}

      <Toolbar
        canUndo={session.canUndo}
        onUndo={controls.undo}
        onRestart={() => {
          if (busy) return;
          session.restart();
          controls.setHint(null);
          rerender();
        }}
        onHint={controls.showHint}
        onTube={controls.addTube}
        hintCost={HINT_COST}
        tubeCost={TUBE_COST}
        container={SORT_META[game].container}
        tubeUsed={stats.extras > 0}
        undos={stats.undos}
        busy={busy}
      />

      <Modal open={phase === 'ready'} onClose={home}>
        <div className="win">
          <div className="blitz-icon">
            <Zap size={44} />
          </div>
          <h2>Blitz</h2>
          <p className="muted">
            Solve as many puzzles as you can in <strong>2 minutes</strong>. Every solve adds <strong>+5 seconds</strong>. Puzzles get harder as you go.
          </p>
          <p className="muted small">Your best: {best.toLocaleString()} · Weekly leaderboard</p>
          <button className="btn primary huge block" onClick={begin}>
            Start
          </button>
        </div>
      </Modal>

      <Modal open={phase === 'over'} onClose={home} dismissable={false}>
        <div className="win">
          <h2>Time!</h2>
          <div className="big-score">{score.toLocaleString()}</div>
          <p className="muted">
            {logs.current.length} puzzle{logs.current.length === 1 ? '' : 's'} solved
          </p>
          <div className="reward-chips">
            {payout?.newBest && <span className="chip xp">New personal best!</span>}
            {!!payout?.coins && (
              <span className="chip coin">
                <Coins size={14} /> +{payout.coins}
              </span>
            )}
          </div>
          {logs.current.length > 0 && (
            <div className="rank-box">
              {!submit && <span className="muted">Verifying run…</span>}
              {submit?.res?.best && (
                <span>
                  <Trophy size={16} /> Weekly rank <strong>#{submit.res.best.rank}</strong>
                </span>
              )}
              {submit?.error && <span className="muted">Couldn't reach the leaderboard.</span>}
            </div>
          )}
          <div className="win-actions">
            <button className="btn" onClick={() => useUi.getState().open('leaderboard', { game, tab: 'blitz' })}>
              Leaderboard
            </button>
            <button className="btn primary" onClick={onAgain}>
              Play again
            </button>
          </div>
          <button className="link center" onClick={home}>
            Back to menu
          </button>
        </div>
      </Modal>
    </div>
  );
}
