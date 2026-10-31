import { Award, ChevronLeft, Palette, Settings, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { EDITION } from '../games/edition';
import type { GameId } from '../games/registry';
import { go } from '../router';
import { CoinPill, ProfileBar, StreakPill } from './ProfileBar';
import { useUi } from './uiStore';

/** Ranks · Awards · Shop · Settings. The arcade hub has it; in a single-game app the game's home does. */
export function AppNav({ game }: { game: GameId }) {
  const open = useUi((s) => s.open);
  return (
    <nav className="hub-nav">
      <button onClick={() => open('leaderboard', { game, tab: 'xp' })}>
        <Trophy size={22} />
        Ranks
      </button>
      <button onClick={() => open('achievements')}>
        <Award size={22} />
        Awards
      </button>
      <button onClick={() => open('shop')}>
        <Palette size={22} />
        Shop
      </button>
      <button onClick={() => open('settings')}>
        <Settings size={22} />
        Settings
      </button>
    </nav>
  );
}

/** The public site with the support and privacy pages, which the App Store listings also link to. */
const SITE = 'https://thepollywog.github.io/games/';

/**
 * The studio's mark: the Pollywog badge and name, with links to support and the privacy policy (Apple
 * wants the policy reachable inside the app; on iOS these open in Safari).
 */
export function Maker() {
  return (
    <>
      <p className="maker">
        <img src={`${import.meta.env.BASE_URL}pollywog.png`} alt="" />
        by The Pollywog
      </p>
      <p className="maker-links">
        <a href={`${SITE}support/`} target="_blank" rel="noopener">
          Support
        </a>
        <span aria-hidden="true">·</span>
        <a href={`${SITE}privacy/`} target="_blank" rel="noopener">
          Privacy
        </a>
      </p>
    </>
  );
}

/** A game's home header: back to the arcade, or (when the game is the whole app) the player profile. */
export function HomeHeader({ title }: { title: ReactNode }) {
  if (EDITION) {
    return (
      <>
        <ProfileBar />
        <h1 className="edition-title">{title}</h1>
      </>
    );
  }
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => go({ name: 'hub' })} aria-label="Back to arcade">
        <ChevronLeft />
      </button>
      <h1>{title}</h1>
      <StreakPill />
      <CoinPill />
    </header>
  );
}
