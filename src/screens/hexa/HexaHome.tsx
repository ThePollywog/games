import { motion } from 'framer-motion';
import { CalendarDays, Trophy, Wrench } from 'lucide-react';
import { utcDay } from '../../../shared/dates.ts';
import { CLEAR_AT, MAX_HAMMERS, MAX_SHUFFLES } from '../../../shared/hexa/engine.ts';
import { EDITION } from '../../games/edition';
import { useArcade } from '../../platform/store';
import { go } from '../../router';
import { AppNav, HomeHeader, Maker } from '../../ui/AppNav';
import { useUi } from '../../ui/uiStore';
import { Countdown } from '../sort/SortHome';
import { HAMMER_COST, SHUFFLE_COST } from './HexaPlay';

export function HexaHome() {
  const hexa = useArcade((s) => s.hexa);
  const games = useArcade((s) => s.stats.hexaGames);
  const open = useUi((s) => s.open);
  const daily = hexa.daily[utcDay()];

  return (
    <div className="screen sort-home theme-hex-marks-the-spot">
      <HomeHeader title="Hex Marks the Spot" />

      <motion.section className="hero-card hexa-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="hero-chapter">Endless Voyage</div>
        <p className="muted small">
          Drop treasure stacks on the map. Neighbours with the same top color merge; {CLEAR_AT} of a color digs up points, and
          chain digs multiply. The voyage ends when the map fills up.
        </p>
        <motion.button className="btn primary huge" whileTap={{ scale: 0.96 }} onClick={() => go({ name: 'hexa-play', mode: 'endless' })}>
          Play
        </motion.button>
        <div className="hero-foot">
          <span>Best {hexa.best.toLocaleString()}</span>
          <span>{games} games</span>
        </div>
      </motion.section>

      <div className="mode-grid">
        <motion.button className="mode-card daily" whileTap={{ scale: 0.97 }} onClick={() => go({ name: 'hexa-play', mode: 'daily' })}>
          <span className="mode-emoji">
            <CalendarDays />
          </span>
          <strong>Daily Dig</strong>
          <span>Same pieces for everyone. One ranked game.</span>
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
        <motion.button className="mode-card blitz" whileTap={{ scale: 0.97 }} onClick={() => open('leaderboard', { game: 'hex-marks-the-spot', tab: 'weekly' })}>
          <span className="mode-emoji">
            <Trophy />
          </span>
          <strong>Leaderboards</strong>
          <span>Daily · Weekly endless</span>
        </motion.button>
        <div className="mode-card zen">
          <span className="mode-emoji">
            <Wrench />
          </span>
          <strong>Power-ups</strong>
          <span>
            Cannon blasts any stack ({HAMMER_COST} coins, {MAX_HAMMERS} per game) · Shuffle swaps your tray ({SHUFFLE_COST} coins,{' '}
            {MAX_SHUFFLES} per game). Drag pieces onto the map, or tap a piece then a cell.
          </span>
        </div>
      </div>
      {EDITION && <AppNav game="hex-marks-the-spot" />}
      {EDITION && <Maker />}
    </div>
  );
}
