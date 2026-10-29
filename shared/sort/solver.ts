import { boardKey, isSolved, pour, usefulMoves, type Board, type Move } from './engine.ts';

/**
 * Weighted A*. Each pour removes at most one color "segment", so segment count is an
 * admissible heuristic; weighting it trades a little optimality for a lot of speed.
 * Used for level validation, par calculation, and in-game hints.
 */
export function solve(start: Board, opts: { maxNodes?: number; weight?: number } = {}): Move[] | null {
  const maxNodes = opts.maxNodes ?? 60000;
  const weight = opts.weight ?? 2;
  if (isSolved(start)) return [];

  const boards: Board[] = [start];
  const parent: number[] = [-1];
  const moveOf: (Move | null)[] = [null];
  const depth: number[] = [0];
  const seen = new Map<string, number>([[boardKey(start), 0]]);
  const heap = new MinHeap();
  heap.push(weight * segments(start), 0);

  while (heap.size) {
    const idx = heap.pop();
    const b = boards[idx];
    const g = depth[idx] + 1;
    for (const m of usefulMoves(b)) {
      const nb = pour(b, m[0], m[1]).board;
      const key = boardKey(nb);
      const prev = seen.get(key);
      if (prev !== undefined && prev <= g) continue;
      seen.set(key, g);
      const id = boards.length;
      boards.push(nb);
      parent.push(idx);
      moveOf.push(m);
      depth.push(g);
      if (isSolved(nb)) return reconstruct(id, parent, moveOf);
      if (id >= maxNodes) return null;
      heap.push(g + weight * segments(nb), id);
    }
  }
  return null;
}

function segments(b: Board): number {
  let s = 0;
  for (const t of b.tubes) {
    const u = t.units;
    if (!u.length) continue;
    s++;
    for (let i = 1; i < u.length; i++) if (u[i] !== u[i - 1]) s++;
  }
  return s;
}

function reconstruct(id: number, parent: number[], moveOf: (Move | null)[]): Move[] {
  const path: Move[] = [];
  for (let i = id; parent[i] !== -1; i = parent[i]) path.push(moveOf[i]!);
  return path.reverse();
}

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return top;
  }
}
