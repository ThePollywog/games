import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { utcDay } from '../../shared/dates.ts';
import { SORT_GAME_IDS } from '../../shared/sort/levels.ts';
import { GAMES, type GameId } from '../games/registry';
import { useArcade, type ArcadeState } from '../platform/store';
import { go, type Route } from '../router';
import { AppNav, Maker } from '../ui/AppNav';
import { ProfileBar } from '../ui/ProfileBar';
import { Countdown } from './sort/SortHome';

const dailyRoute = (id: GameId): Route => (id === 'hex-marks-the-spot' ? { name: 'hexa-play', mode: 'daily' } : { name: 'sort-daily', game: id });

function dailyDone(s: ArcadeState, id: GameId, day: string) {
  return id === 'hex-marks-the-spot' ? !!s.hexa.daily[day] : !!s.sort[id].daily[day];
}

function badge(s: ArcadeState, id: GameId) {
  if (id === 'hex-marks-the-spot') return s.hexa.best ? `Best ${s.hexa.best.toLocaleString()}` : 'New!';
  return `Level ${s.sort[id].level}`;
}

export function Hub() {
  const state = useArcade();
  const today = utcDay();
  const done = GAMES.filter((g) => dailyDone(state, g.id, today)).length;

  return (
    <div className="screen hub">
      <ProfileBar />
      <h1 className="logo">
        Pollywog <span>Arcade</span>
      </h1>
      <p className="tagline">Brain-teasing puzzles. Zero ads.{import.meta.env.VITE_STATIC ? '' : ' Real leaderboards.'}</p>

      <section className="daily-banner">
        <div className="daily-icon">
          <CalendarDays size={28} />
        </div>
        <div>
          <strong>
            Daily Challenges · {done}/{GAMES.length}
          </strong>
          <div className="daily-chips">
            {GAMES.map((g) => (
              <button key={g.id} className={dailyDone(state, g.id, today) ? 'done' : ''} onClick={() => go(dailyRoute(g.id))}>
                {dailyDone(state, g.id, today) ? '✓ ' : ''}{g.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <Countdown />
      </section>

      <div className="game-grid">
        {GAMES.map((g, i) => (
          <motion.button
            key={g.id}
            className="game-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileTap={{ scale: 0.97 }}
            onClick={() => go(g.route)}
          >
            <img className="game-emoji" src={`${import.meta.env.BASE_URL}icons/${g.id}.png`} alt="" />
            <strong>{g.name}</strong>
            <span className="game-tag">{g.tagline}</span>
            <span className="game-badge">{badge(state, g.id)}</span>
          </motion.button>
        ))}
      </div>

      <AppNav game={SORT_GAME_IDS[0]} />
      <Maker />
    </div>
  );
}
