// Pure, immutable sort-puzzle rules shared by Water Sort, Ball Sort and Nuts & Bolts.
// Tubes are stored bottom -> top.

export type Color = number;

export interface Tube {
  units: Color[];
  /** Mystery layers: a hidden unit shows as "?" until it becomes the top of its tube. */
  hidden: boolean[];
}

export interface Board {
  tubes: Tube[];
  /** Units per color; also the default tube height. */
  capacity: number;
  /** Per-tube heights when tubes differ (Nuts & Bolts). */
  caps?: number[];
  /** Move one unit per action instead of the whole matching run (Ball Sort). */
  single?: boolean;
}

export type Move = [from: number, to: number];

export const capOf = (b: Board, i: number) => b.caps?.[i] ?? b.capacity;

export const topColor = (t: Tube): Color | undefined => t.units[t.units.length - 1];

/** How many units would leave the tube in one pour (contiguous, revealed, same color). */
export function topRun(t: Tube): number {
  const n = t.units.length;
  if (n === 0) return 0;
  const c = t.units[n - 1];
  let run = 0;
  for (let i = n - 1; i >= 0 && t.units[i] === c && !t.hidden[i]; i--) run++;
  return run;
}

/** Holds every unit of one color, nothing else, and nothing hidden. */
export function isComplete(t: Tube, group: number): boolean {
  if (t.units.length !== group) return false;
  const c = t.units[0];
  return t.units.every((u, i) => u === c && !t.hidden[i]);
}

const isUniform = (t: Tube): boolean =>
  t.units.length > 0 && t.units.every((u, i) => u === t.units[0] && !t.hidden[i]);

export function canPour(b: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const s = b.tubes[from];
  const d = b.tubes[to];
  if (!s || !d || s.units.length === 0) return false;
  if (isComplete(s, b.capacity)) return false;
  if (d.units.length >= capOf(b, to)) return false;
  return d.units.length === 0 || topColor(d) === topColor(s);
}

export function pour(b: Board, from: number, to: number): { board: Board; amount: number } {
  const s: Tube = { units: [...b.tubes[from].units], hidden: [...b.tubes[from].hidden] };
  const d: Tube = { units: [...b.tubes[to].units], hidden: [...b.tubes[to].hidden] };
  const room = capOf(b, to) - d.units.length;
  const amount = Math.min(b.single ? 1 : topRun(s), room);
  for (let k = 0; k < amount; k++) {
    d.units.push(s.units.pop()!);
    s.hidden.pop();
    d.hidden.push(false);
  }
  if (s.hidden.length) s.hidden[s.hidden.length - 1] = false;
  const tubes = b.tubes.slice();
  tubes[from] = s;
  tubes[to] = d;
  return { board: { ...b, tubes }, amount };
}

export const isSolved = (b: Board): boolean =>
  b.tubes.every((t) => t.units.length === 0 || isComplete(t, b.capacity));

/** Legal moves minus the pointless ones (e.g. moving an already-sorted stack into an empty tube). */
export function usefulMoves(b: Board): Move[] {
  const out: Move[] = [];
  for (let f = 0; f < b.tubes.length; f++) {
    const s = b.tubes[f];
    if (s.units.length === 0 || isComplete(s, b.capacity)) continue;
    // With uniform heights a sorted stack gains nothing from an empty tube; with mixed
    // heights it can (it frees a taller bolt), unless the target is no taller.
    const uniform = isUniform(s);
    const triedEmpty = new Set<number>(); // empty tubes of equal height are interchangeable
    for (let t = 0; t < b.tubes.length; t++) {
      if (!canPour(b, f, t)) continue;
      if (b.tubes[t].units.length === 0) {
        const cap = capOf(b, t);
        if (triedEmpty.has(cap)) continue;
        if (uniform && (!b.caps || cap <= capOf(b, f))) continue;
        triedEmpty.add(cap);
      }
      out.push([f, t]);
    }
  }
  return out;
}

export const isStuck = (b: Board): boolean => !isSolved(b) && usefulMoves(b).length === 0;

export function boardKey(b: Board): string {
  return b.tubes
    .map(
      (t, i) =>
        (b.caps ? `${capOf(b, i)}:` : '') +
        t.units.map((u, j) => (t.hidden[j] ? '?' : '') + u.toString(36)).join(''),
    )
    .sort()
    .join('|');
}

export const emptyTube = (): Tube => ({ units: [], hidden: [] });

/** Adds an empty tube of default height (the "+Tube" power-up). */
export const withTube = (b: Board): Board => ({
  ...b,
  tubes: [...b.tubes, emptyTube()],
  caps: b.caps ? [...b.caps, b.capacity] : undefined,
});
