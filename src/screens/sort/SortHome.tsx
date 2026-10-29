import { motion } from 'framer-motion';
import { CalendarDays, Grid3x3, Trophy, Waves, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { msUntilUtcMidnight, utcDay } from '../../../shared/dates.ts';
import { dailyConfig, isBossLevel, type SortGameId } from '../../../shared/sort/levels.ts';
import { EDITION } from '../../games/edition';
import { chapterOf, SORT_META } from '../../games/registry';
import { useArcade } from '../../platform/store';
import { go } from '../../router';
import { Modal } from '../../ui/Modal';
import { AppNav, HomeHeader, Maker } from '../../ui/AppNav';
import { useUi } from '../../ui/uiStore';

export function Countdown() {
  const [ms, setMs] = useState(msUntilUtcMidnight());
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilUtcMidnight()), 30_000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span className="countdown">{h}h {m}m</span>;
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SortHome({ game }: { game: SortGameId }) {
  const meta = SORT_META[game];
  const prog = useArcade((s) => s.sort[game]);
  const open = useUi((s) => s.open);
  const [grid, setGrid] = useState(false);
  const [zen, setZen] = useState(Math.min(7, meta.zenMax));
  const today = utcDay();
  const dc = dailyConfig(game, today);
  const daily = prog.daily[today];
  const ch = chapterOf(game, prog.level);
  const totalStars = Object.values(prog.stars).reduce((a, b) => a + b, 0);
  const chapterStart = ch.index * 20 + 1;

  return (
    <div className={`screen sort-home theme-${game}`}>
      <HomeHeader
        title={
          meta.name
        }
      />

      <motion.section className="hero-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="hero-chapter">
          Chapter {ch.index + 1} · {ch.name}
        </div>
        <div className="chapter-track">
          {Array.from({ length: 20 }, (_, i) => {
            const n = chapterStart + i;
            const stars = prog.stars[n] ?? 0;
            return <span key={n} className={`dot${n === prog.level ? ' current' : ''}${stars ? ` s${stars}` : ''}${isBossLevel(n) ? ' boss' : ''}`} />;
          })}
        </div>
        <motion.button className="btn primary huge" whileTap={{ scale: 0.96 }} onClick={() => go({ name: 'sort-level', game, level: prog.level })}>
          {isBossLevel(prog.level) ? 'Boss · ' : ''}Level {prog.level}
        </motion.button>
        <div className="hero-foot">
          <span>★ {totalStars} stars</span>
          <button className="link" onClick={() => setGrid(true)}>
            <Grid3x3 size={14} /> All levels
          </button>
        </div>
      </motion.section>

      <div className="mode-grid">
        <motion.button className="mode-card daily" whileTap={{ scale: 0.97 }} onClick={() => go({ name: 'sort-daily', game })}>
          <span className="mode-emoji">
            <CalendarDays />
          </span>
          <strong>Daily Challenge</strong>
          <span>
            {DAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]} · {dc.colors} colors{dc.mystery ? ' · mystery' : ''}
          </span>
          <span className="mode-foot">
            {daily ? (
              `✓ ${daily.score.toLocaleString()} pts`
            ) : (
              <>
                Resets in <Countdown />
              </>
            )}
          </span>
        </motion.button>
        <motion.button className="mode-card blitz" whileTap={{ scale: 0.97 }} onClick={() => go({ name: 'sort-blitz', game })}>
          <span className="mode-emoji">
            <Zap />
          </span>
          <strong>Blitz</strong>
          <span>2 minutes. Endless puzzles. Weekly board.</span>
          <span className="mode-foot">Best {prog.blitzBest.toLocaleString()}</span>
        </motion.button>
        <div className="mode-card zen">
          <span className="mode-emoji">
            <Waves />
          </span>
          <strong>Zen</strong>
          <span>No timer, free hints. Pick your size.</span>
          <div className="zen-row">
            <input type="range" min={3} max={meta.zenMax} value={zen} onChange={(e) => setZen(Number(e.target.value))} aria-label="Colors" />
            <button className="btn small" onClick={() => go({ name: 'sort-zen', game, colors: zen })}>
              {zen} colors
            </button>
          </div>
        </div>
        <motion.button className="mode-card ranks" whileTap={{ scale: 0.97 }} onClick={() => open('leaderboard', { game, tab: 'daily' })}>
          <span className="mode-emoji">
            <Trophy />
          </span>
          <strong>Leaderboards</strong>
          <span>Daily · Blitz · Campaign</span>
        </motion.button>
      </div>

      {EDITION && <AppNav game={game} />}
      {EDITION && <Maker />}

      <Modal open={grid} onClose={() => setGrid(false)} title="Levels" wide>
        <div className="level-grid">
          {Array.from({ length: Math.max(20, Math.ceil(prog.level / 20) * 20) }, (_, i) => {
            const n = i + 1;
            const locked = n > prog.level;
            const stars = prog.stars[n] ?? 0;
            return (
              <button
                key={n}
                className={`lvl${locked ? ' locked' : ''}${isBossLevel(n) ? ' boss' : ''}`}
                disabled={locked}
                onClick={() => go({ name: 'sort-level', game, level: n })}
              >
                <span>{n}</span>
                <small>{locked ? '🔒' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</small>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
