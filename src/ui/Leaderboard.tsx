import { useEffect, useState } from 'react';
import { isoWeek, utcDay } from '../../shared/dates.ts';
import { APP_GAMES, EDITION } from '../games/edition';
import type { GameId } from '../games/registry';
import { api, OFFLINE_MESSAGE, type BoardResponse } from '../platform/api';
import { useArcade } from '../platform/store';
import { useUi, type BoardTab } from './uiStore';

interface TabDef {
  id: BoardTab;
  label: string;
  board: (game: GameId) => string;
  unit: string;
  sub: string;
}

const week = () => isoWeek().split('-W')[1];

const SORT_TABS: TabDef[] = [
  { id: 'daily', label: 'Daily', board: (g) => `${g}:daily:${utcDay()}`, unit: 'pts', sub: "Today's puzzle · first solve counts" },
  { id: 'blitz', label: 'Blitz', board: (g) => `${g}:blitz:${isoWeek()}`, unit: 'pts', sub: `Week ${week()} · best 2-minute run` },
  { id: 'campaign', label: 'Campaign', board: (g) => `${g}:campaign`, unit: 'lvl', sub: 'Furthest campaign level' },
];
const HEXA_TABS: TabDef[] = [
  { id: 'daily', label: 'Daily', board: () => `hex-marks-the-spot:daily:${utcDay()}`, unit: 'pts', sub: "Today's seed · first game counts" },
  { id: 'weekly', label: 'Endless', board: () => `hex-marks-the-spot:weekly:${isoWeek()}`, unit: 'pts', sub: `Week ${week()} · best endless game` },
];
const XP_TAB: TabDef = EDITION
  ? { id: 'xp', label: 'XP', board: () => 'arcade:xp', unit: 'xp', sub: 'Lifetime XP' }
  : { id: 'xp', label: 'Arcade XP', board: () => 'arcade:xp', unit: 'xp', sub: 'Lifetime XP across all games' };

const tabsFor = (game: GameId) => [...(game === 'hex-marks-the-spot' ? HEXA_TABS : SORT_TABS), XP_TAB];


function detailText(d: Record<string, number>) {
  if (d.stars) return '★'.repeat(d.stars);
  if (d.solved) return `${d.solved} solved`;
  if (d.cleared) return `${d.cleared} tiles`;
  return '';
}

export function Leaderboard() {
  const { board: sel, open } = useUi();
  const playerId = useArcade((s) => s.playerId);
  const tabs = tabsFor(sel.game);
  const tab = tabs.find((t) => t.id === sel.tab) ?? tabs[0];
  const boardId = tab.board(sel.game);
  const [data, setData] = useState<BoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api
      .board(boardId)
      .then((d) => live && setData(d))
      .catch(() => live && setError(OFFLINE_MESSAGE));
    return () => {
      live = false;
    };
  }, [boardId]);

  const meInTop = data?.entries.some((e) => e.playerId === playerId);

  return (
    <div className="leaderboard">
      {tab.id !== 'xp' && APP_GAMES.length > 1 && (
        <div className="game-chips">
          {APP_GAMES.map((g) => (
            <button key={g.id} className={g.id === sel.game ? 'active' : ''} onClick={() => open('leaderboard', { game: g.id, tab: sel.tab })}>
              {g.name}
            </button>
          ))}
        </div>
      )}
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={t.id === tab.id ? 'active' : ''} onClick={() => open('leaderboard', { game: sel.game, tab: t.id })}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="muted small">{tab.sub}</p>
      {error && <p className="empty">{error}</p>}
      {!error && !data && <div className="spinner" />}
      {data && data.entries.length === 0 && <p className="empty">No scores yet — be the first!</p>}
      {data && data.entries.length > 0 && (
        <ol className="lb-list">
          {data.entries.map((e) => (
            <li key={e.playerId} className={e.playerId === playerId ? 'me' : ''}>
              <span className="lb-rank">{e.rank}</span>
              <span className="lb-name">{e.name}</span>
              <span className="lb-detail">{detailText(e.detail)}</span>
              <span className="lb-score">
                {e.score.toLocaleString()} <small>{tab.unit}</small>
              </span>
            </li>
          ))}
          {data.me && !meInTop && (
            <li className="me detached">
              <span className="lb-rank">{data.me.rank}</span>
              <span className="lb-name">You</span>
              <span className="lb-detail" />
              <span className="lb-score">
                {data.me.score.toLocaleString()} <small>{tab.unit}</small>
              </span>
            </li>
          )}
        </ol>
      )}
      {data && <p className="muted small center">{data.total.toLocaleString()} players ranked</p>}
      {api.showNative && (
        <button className="btn small ghost" onClick={() => api.showNative?.(boardId)}>
          Open in Game Center
        </button>
      )}
    </div>
  );
}
