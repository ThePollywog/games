import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { dayDiff, isoWeek, utcDay } from '../shared/dates.ts';
import { hexDailySeed, hexRunSeed, verifyHex } from '../shared/hexa/engine.ts';
import { isSortGame, SORT_GAME_IDS } from '../shared/sort/levels.ts';
import { verifyBlitz, verifyDaily } from '../shared/sort/verify.ts';
import { openDb } from './db.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT ?? 8787);
const DIST = join(ROOT, 'dist');
const db = openDb(process.env.DB_FILE ?? join(ROOT, 'data', 'arcade.db'));

/** Boards anyone may read. Writes go through the verified endpoints below. */
const SORT = SORT_GAME_IDS.join('|');
const BOARD_RE = new RegExp(
  `^((${SORT}):(daily:\\d{4}-\\d{2}-\\d{2}|blitz:\\d{4}-W\\d{2}|campaign)|hex-marks-the-spot:(daily:\\d{4}-\\d{2}-\\d{2}|weekly:\\d{4}-W\\d{2})|arcade:xp)$`,
);
const PLAYER_RE = /^[a-z0-9-]{8,64}$/i;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 18);
  if (name.length < 2) throw new HttpError(400, 'name must be 2–18 letters or numbers');
  return name;
}

function player(body: Record<string, unknown>) {
  const id = String(body.playerId ?? '');
  if (!PLAYER_RE.test(id)) throw new HttpError(400, 'bad player id');
  return { id, name: cleanName(body.name) };
}

// Tiny per-IP token bucket for writes.
const buckets = new Map<string, { tokens: number; at: number }>();
function rateLimit(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: 30, at: now };
  b.tokens = Math.min(30, b.tokens + ((now - b.at) / 60000) * 30);
  b.at = now;
  if (b.tokens < 1) throw new HttpError(429, 'slow down');
  b.tokens--;
  buckets.set(ip, b);
  if (buckets.size > 10000) buckets.clear();
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512 * 1024) throw new HttpError(413, 'payload too large');
    chunks.push(chunk);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'invalid JSON');
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  const path = url.pathname;

  if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true, day: utcDay(), week: isoWeek() });

  if (req.method === 'GET' && path.startsWith('/api/boards/')) {
    const board = decodeURIComponent(path.slice('/api/boards/'.length));
    if (!BOARD_RE.test(board)) throw new HttpError(404, 'unknown board');
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
    const pid = url.searchParams.get('player') ?? undefined;
    return send(res, 200, db.board(board, limit, pid && PLAYER_RE.test(pid) ? pid : undefined));
  }

  if (req.method !== 'POST') throw new HttpError(404, 'not found');
  rateLimit(req.socket.remoteAddress ?? '?');
  const body = await readJson(req);
  const p = player(body);

  // Dailies accept today ±1 day so every timezone can finish "its" day.
  const openDaily = () => {
    const date = String(body.date ?? '');
    const offset = dayDiff(utcDay(), date);
    if (!(offset >= -1 && offset <= 1)) throw new HttpError(400, 'that daily is closed');
    return date;
  };

  const sortRoute = path.match(/^\/api\/sort\/([a-z-]+)\/(daily|blitz)$/);
  if (sortRoute) {
    const [, game, kind] = sortRoute;
    if (!isSortGame(game)) throw new HttpError(404, 'unknown game');
    if (kind === 'daily') {
      const date = openDaily();
      const v = verifyDaily(game, date, body.actions, body.timeMs);
      if (!v.ok) throw new HttpError(422, v.error);
      const board = `${game}:daily:${date}`;
      return send(res, 200, { board, score: v.score, best: db.submit(board, p.id, p.name, v.score, v.detail, true) });
    }
    const v = verifyBlitz(game, String(body.runSeed ?? ''), body.levels);
    if (!v.ok) throw new HttpError(422, v.error);
    const board = `${game}:blitz:${isoWeek()}`;
    return send(res, 200, { board, score: v.score, best: db.submit(board, p.id, p.name, v.score, v.detail) });
  }

  switch (path) {
    case '/api/players': {
      db.setName(p.id, p.name);
      return send(res, 200, { ok: true, name: p.name });
    }
    case '/api/hexa/daily': {
      const date = openDaily();
      const v = verifyHex(hexDailySeed(date), body.actions, body.timeMs);
      if (!v.ok) throw new HttpError(422, v.error);
      const board = `hex-marks-the-spot:daily:${date}`;
      return send(res, 200, { board, score: v.score, best: db.submit(board, p.id, p.name, v.score, v.detail, true) });
    }
    case '/api/hexa/run': {
      const run = String(body.runSeed ?? '');
      if (!/^[a-z0-9]{4,16}$/.test(run)) throw new HttpError(400, 'bad seed');
      const v = verifyHex(hexRunSeed(run), body.actions, body.timeMs);
      if (!v.ok) throw new HttpError(422, v.error);
      const board = `hex-marks-the-spot:weekly:${isoWeek()}`;
      return send(res, 200, { board, score: v.score, best: db.submit(board, p.id, p.name, v.score, v.detail) });
    }
    case '/api/stats': {
      // Progression boards are self-reported (bounded); skill boards above are verified.
      const xp = Math.floor(Number(body.xp));
      if (Number.isFinite(xp) && xp > 0 && xp < 50_000_000) db.submit('arcade:xp', p.id, p.name, xp);
      const campaign = (body.campaign ?? {}) as Record<string, unknown>;
      for (const game of SORT_GAME_IDS) {
        const next = Math.floor(Number(campaign[game]));
        if (Number.isFinite(next) && next > 1 && next < 100_000)
          db.submit(`${game}:campaign`, p.id, p.name, next - 1, { level: next - 1 });
      }
      return send(res, 200, { ok: true });
    }
  }
  throw new HttpError(404, 'not found');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

async function serveStatic(res: ServerResponse, pathname: string) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\]|\.\.)+/, '');
  let file = join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file) || !extname(file)) file = join(DIST, 'index.html');
  const data = await readFile(file);
  const immutable = file.includes(`${join(DIST, 'assets')}`);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(data);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (existsSync(DIST)) await serveStatic(res, url.pathname);
    else send(res, 404, { error: 'run `npm run build` or use the Vite dev server' });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { error: err instanceof HttpError ? err.message : 'server error' });
  }
}).listen(PORT, () => console.log(`Pour Arcade API on http://localhost:${PORT}`));
