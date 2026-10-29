import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface Entry {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  detail: Record<string, number>;
}

const RENAMED_GAMES = {
  'water-sort': 'shipshape',
  'ball-sort': 'buoy-oh-buoy',
  'nut-sort': 'knots-and-bolts',
  'hexa-stack': 'hex-marks-the-spot',
};

export function openDb(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
      board TEXT NOT NULL,
      player_id TEXT NOT NULL REFERENCES players(id),
      score INTEGER NOT NULL,
      detail TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (board, player_id)
    );
    CREATE INDEX IF NOT EXISTS scores_rank ON scores(board, score DESC, updated_at);
  `);
  // Game ids were renamed to match the app names; boards are prefixed with them.
  const rename = db.prepare(`UPDATE OR IGNORE scores SET board = ? || substr(board, ?) WHERE board LIKE ? || ':%'`);
  for (const [from, to] of Object.entries(RENAMED_GAMES)) rename.run(to, from.length + 1, from);

  const upsertPlayer = db.prepare(`
    INSERT INTO players (id, name, created_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);
  // Keeps each player's personal best per board.
  const upsertScore = db.prepare(`
    INSERT INTO scores (board, player_id, score, detail, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(board, player_id) DO UPDATE SET
      score = excluded.score, detail = excluded.detail, updated_at = excluded.updated_at
    WHERE excluded.score > scores.score
  `);
  const insertFirst = db.prepare(`
    INSERT INTO scores (board, player_id, score, detail, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(board, player_id) DO NOTHING
  `);
  const top = db.prepare(`
    SELECT s.player_id AS playerId, p.name, s.score, s.detail
    FROM scores s JOIN players p ON p.id = s.player_id
    WHERE s.board = ? ORDER BY s.score DESC, s.updated_at ASC LIMIT ?
  `);
  const mine = db.prepare(`SELECT score, detail, updated_at FROM scores WHERE board = ? AND player_id = ?`);
  const rankOf = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM scores
    WHERE board = ? AND (score > ? OR (score = ? AND updated_at < ?))
  `);
  const count = db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE board = ?`);

  function me(board: string, playerId: string): Omit<Entry, 'name'> | null {
    const row = mine.get(board, playerId) as { score: number; detail: string; updated_at: number } | undefined;
    if (!row) return null;
    const { rank } = rankOf.get(board, row.score, row.score, row.updated_at) as { rank: number };
    return { rank, playerId, score: row.score, detail: JSON.parse(row.detail) };
  }

  return {
    setName(id: string, name: string) {
      upsertPlayer.run(id, name, Date.now());
    },
    /** `firstOnly` boards rank a player's first verified result; others keep their best. */
    submit(board: string, playerId: string, name: string, score: number, detail: object = {}, firstOnly = false) {
      upsertPlayer.run(playerId, name, Date.now());
      (firstOnly ? insertFirst : upsertScore).run(board, playerId, Math.round(score), JSON.stringify(detail), Date.now());
      return me(board, playerId);
    },
    board(board: string, limit: number, playerId?: string) {
      const rows = top.all(board, limit) as { playerId: string; name: string; score: number; detail: string }[];
      const entries: Entry[] = rows.map((r, i) => ({ ...r, rank: i + 1, detail: JSON.parse(r.detail) }));
      const { n } = count.get(board) as { n: number };
      return { board, total: n, entries, me: playerId ? me(board, playerId) : null };
    },
    close: () => db.close(),
  };
}

export type Db = ReturnType<typeof openDb>;
