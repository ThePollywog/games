import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { Coins, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { utcDay } from '../../../shared/dates.ts';
import { randomSeed } from '../../../shared/rng.ts';
import { isStuck } from '../../../shared/sort/engine.ts';
import {
  campaignConfig,
  campaignLevel,
  dailyLevel,
  generateLevel,
  isBossLevel,
  zenConfig,
  type Level,
  type SortGameId,
} from '../../../shared/sort/levels.ts';
import { scoreLevel, type ScoreBreakdown } from '../../../shared/sort/scoring.ts';
import { createSession } from '../../../shared/sort/session.ts';
import { chapterOf, SORT_META } from '../../games/registry';
import { Board } from '../../games/sort/Board';
import { fmtTime, GameTopBar, Stat, Toolbar } from '../../games/sort/Hud';
import { paletteById } from '../../games/sort/palettes';
import { awardSolve, HINT_COST, TUBE_COST, type Mode, type Rewards } from '../../games/sort/rewards';
import { useGameControls } from '../../games/sort/useGameControls';
import { api, type SubmitResponse } from '../../platform/api';
import { sfx } from '../../platform/feedback';
import { useArcade } from '../../platform/store';
import { go, type Route } from '../../router';
import { Modal } from '../../ui/Modal';
import { useUi } from '../../ui/uiStore';

type PlayRoute = Extract<Route, { name: 'sort-level' | 'sort-daily' | 'sort-zen' }>;

interface Spec {
  key: string;
  game: SortGameId;
  mode: Mode;
  level: Level;
  title: string;
  sub: string;
  campaignLevel?: number;
  date?: string;
  /** Daily only: first solve of the day is ranked, later ones are practice. */
  ranked?: boolean;
  tip?: string;
}

function buildSpec(route: PlayRoute, nonce: number): Spec {
  const { game } = route;
  const meta = SORT_META[game];
  if (route.name === 'sort-level') {
    const n = route.level;
    const config = campaignConfig(game, n);
    return {
      key: `${game}:c${n}:${nonce}`,
      game,
      mode: 'campaign',
      level: campaignLevel(game, n),
      title: `${isBossLevel(n) ? 'Boss · ' : ''}Level ${n}`,
      sub: chapterOf(game, n).name + (config.mystery ? ' · Mystery' : ''),
      campaignLevel: n,
      tip: meta.tips[n],
    };
  }
  if (route.name === 'sort-daily') {
    const date = utcDay();
    const ranked = !useArcade.getState().sort[game].daily[date];
    return {
      key: `${game}:d${date}:${nonce}`,
      game,
      mode: 'daily',
      level: dailyLevel(game, date),
      title: 'Daily Challenge',
      sub:
        new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) +
        (ranked ? ' · Ranked' : ' · Practice'),
      date,
      ranked,
    };
  }
  const config = zenConfig(game, route.colors);
  return {
    key: `${game}:z${route.colors}:${nonce}`,
    game,
    mode: 'zen',
    level: generateLevel(`zen:${randomSeed()}`, config),
    title: 'Zen',
    sub: `${config.colors} colors · relax`,
  };
}

export function SortPlay({ route }: { route: PlayRoute }) {
  const [nonce, setNonce] = useState(0);
  const spec = useMemo(() => buildSpec(route, nonce), [route, nonce]);
  return <Game key={spec.key} spec={spec} onReplay={() => setNonce((n) => n + 1)} />;
}

interface Win {
  score: ScoreBreakdown;
  rewards: Rewards;
  timeMs: number;
}

function Game({ spec, onReplay }: { spec: Spec; onReplay(): void }) {
  const { mode, level, game } = spec;
  const settings = useArcade((s) => s.settings);
  const palette = paletteById(useArcade((s) => s.palette));
  const [session, setSession] = useState(() => createSession(level));
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const start = useRef(performance.now());
  const [now, setNow] = useState(start.current);
  const [win, setWin] = useState<Win | null>(null);
  const [submit, setSubmit] = useState<{ res?: SubmitResponse; error?: string } | null>(null);
  const [tip, setTip] = useState(spec.tip);
  const [busy, setBusy] = useState(false);
  const free = mode === 'zen' || (mode === 'campaign' && (spec.campaignLevel ?? 99) <= 3);
  const controls = useGameControls(session, rerender, { hint: free ? 0 : HINT_COST, tube: mode === 'zen' ? 0 : TUBE_COST }, busy, SORT_META[game].container);
  const stats = session.stats();

  useEffect(() => {
    if (stats.solved) return;
    const t = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(t);
  }, [stats.solved]);

  const elapsed = (win?.timeMs ?? now - start.current);
  const stuck = !busy && !stats.solved && isStuck(session.board);

  function finish() {
    const timeMs = performance.now() - start.current;
    const s = session.stats();
    const score = scoreLevel(level, s, timeMs, { timeBonus: mode !== 'zen' });
    const rewards = awardSolve({ game, mode, level, stats: s, score, timeMs, campaignLevel: spec.campaignLevel, date: spec.date });
    if (spec.ranked && spec.date) {
      api
        .submitDaily(game, spec.date, [...session.log], timeMs)
        .then((res) => setSubmit({ res }))
        .catch((e: Error) => setSubmit({ error: e.message }));
    }
    setTimeout(() => {
      sfx.win();
      if (!settings.reducedMotion) {
        void confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors: palette.colors });
      }
      setWin({ score, rewards, timeMs });
    }, 650);
  }

  function restart() {
    if (busy) return;
    controls.setHint(null);
    if (mode === 'daily') {
      // Ranked: restart in place so the log (and score) reflect it.
      session.restart();
      rerender();
    } else {
      start.current = performance.now();
      setSession(createSession(level));
    }
  }

  return (
    <div className={`screen play theme-${game}`} style={{ background: palette.bg }}>
      <GameTopBar title={spec.title} sub={spec.sub} onBack={() => go({ name: 'sort-home', game })} />
      <div className="hud">
        {mode !== 'zen' && <Stat label="Time" value={fmtTime(elapsed)} />}
        <Stat label="Moves" value={stats.moves} warn={mode !== 'zen' && stats.moves > level.par} />
        {mode !== 'zen' && <Stat label="Par" value={level.par} />}
        {stats.maxCombo > 1 && <Stat label="Best combo" value={`x${stats.maxCombo}`} />}
      </div>

      {tip && (
        <motion.div className="tip" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setTip(undefined)}>
          {tip}
        </motion.div>
      )}
      {mode === 'daily' && stats.restarts === 0 && stats.moves === 0 && (
        <div className="tip subtle">
          {spec.ranked
            ? 'Ranked: your first solve counts. Time, moves, undos and restarts all matter.'
            : 'Practice run — your ranked score is already in. Come back tomorrow!'}
        </div>
      )}

      <Board
        session={session}
        skin={SORT_META[game].skin}
        palette={palette}
        colorblind={settings.colorblind}
        reducedMotion={settings.reducedMotion}
        hint={controls.hint}
        disabled={!!win}
        onPour={() => {
          controls.setHint(null);
          setTip(undefined);
          rerender();
        }}
        onSettled={(r) => r.solved && finish()}
        onBusyChange={setBusy}
      />

      {stuck && (
        <motion.div className="stuck" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <strong>No moves left!</strong>
          <span>Undo, add a {SORT_META[game].container}, or restart.</span>
        </motion.div>
      )}

      <Toolbar
        canUndo={session.canUndo}
        onUndo={controls.undo}
        onRestart={restart}
        onHint={controls.showHint}
        onTube={controls.addTube}
        hintCost={free ? 0 : HINT_COST}
        tubeCost={mode === 'zen' ? 0 : TUBE_COST}
        container={SORT_META[game].container}
        tubeUsed={stats.extras > 0}
        undos={stats.undos}
        busy={busy}
      />

      <WinModal
        win={win}
        spec={spec}
        submit={submit}
        onNext={() => {
          if (mode === 'campaign') go({ name: 'sort-level', game, level: (spec.campaignLevel ?? 0) + 1 });
          else if (mode === 'zen') onReplay();
          else go({ name: 'sort-home', game });
        }}
        onReplay={onReplay}
      />
    </div>
  );
}

function WinModal({
  win,
  spec,
  submit,
  onNext,
  onReplay,
}: {
  win: Win | null;
  spec: Spec;
  submit: { res?: SubmitResponse; error?: string } | null;
  onNext(): void;
  onReplay(): void;
}) {
  const openBoard = useUi((s) => s.open);
  if (!win) return null;
  const { score, rewards } = win;
  const rows: [string, number][] = [
    ['Colors sorted', score.base],
    ['Efficiency', score.efficiency],
    ...(spec.mode !== 'zen' ? ([['Speed bonus', score.time]] as [string, number][]) : []),
    ...(score.combo ? ([['Combos', score.combo]] as [string, number][]) : []),
    ...(score.penalties ? ([[`Undo / hints / extra ${SORT_META[spec.game].container}s`, -score.penalties]] as [string, number][]) : []),
  ];
  const headline = score.stars === 3 ? 'Perfect!' : score.stars === 2 ? 'Great job!' : 'Solved!';

  return (
    <Modal open onClose={() => go({ name: 'sort-home', game: spec.game })} dismissable={false}>
      <div className="win">
        <div className="stars">
          {[1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className={i <= score.stars ? 'on' : ''}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.18, type: 'spring', damping: 8 }}
            >
              ★
            </motion.span>
          ))}
        </div>
        <h2>{headline}</h2>
        <motion.div className="big-score" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7 }}>
          {score.total.toLocaleString()}
        </motion.div>
        <p className="muted small">{fmtTime(win.timeMs)} · par {spec.level.par}</p>
        <ul className="breakdown">
          {rows.map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <span className={v < 0 ? 'neg' : ''}>{v > 0 ? `+${v}` : v}</span>
            </li>
          ))}
        </ul>
        <div className="reward-chips">
          {rewards.xp > 0 && <span className="chip xp">+{rewards.xp} XP</span>}
          {rewards.coins > 0 && (
            <span className="chip coin">
              <Coins size={14} /> +{rewards.coins}
            </span>
          )}
          {rewards.streak && (
            <span className="chip streak">
              Day {rewards.streak.count} · +{rewards.streak.coins}
            </span>
          )}
        </div>

        {spec.ranked && (
          <div className="rank-box">
            {!submit && <span className="muted">Submitting score…</span>}
            {submit?.res?.best && (
              <span>
                <Trophy size={16} /> You're <strong>#{submit.res.best.rank}</strong> today
              </span>
            )}
            {submit?.error && <span className="muted">Offline — score saved on this device.</span>}
          </div>
        )}

        <div className="win-actions">
          {spec.mode === 'daily' ? (
            <>
              <button className="btn" onClick={onReplay}>
                Replay
              </button>
              <button className="btn primary" onClick={() => openBoard('leaderboard', { game: spec.game, tab: 'daily' })}>
                Leaderboard
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={onReplay}>
                Replay
              </button>
              <button className="btn primary" onClick={onNext}>
                {spec.mode === 'campaign' ? 'Next level' : 'New puzzle'}
              </button>
            </>
          )}
        </div>
        <button className="link center" onClick={() => go({ name: 'sort-home', game: spec.game })}>
          Back to menu
        </button>
      </div>
    </Modal>
  );
}
