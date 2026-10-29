import confetti from 'canvas-confetti';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { capOf, isComplete, topRun, type Move, type Tube } from '../../../shared/sort/engine.ts';
import type { PourResult, Session } from '../../../shared/sort/session.ts';
import { buzz, sfx } from '../../platform/feedback';
import type { Skin } from '../registry';
import { SYMBOLS, type Palette } from './palettes';

interface Props {
  session: Session;
  skin: Skin;
  palette: Palette;
  colorblind: boolean;
  reducedMotion: boolean;
  disabled?: boolean;
  hint: Move | null;
  /** Fired when the move lands, so the HUD updates promptly. */
  onPour(r: PourResult, to: number): void;
  onSettled?(r: PourResult): void;
  /** True while any move is still animating; undo/restart/etc. should wait for it. */
  onBusyChange?(busy: boolean): void;
}

interface Stream {
  x: number;
  top: number;
  bottom: number;
  width: number;
  color: string;
}

interface Flyer {
  colors: number[];
  x: number;
  y: number;
}

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function Board({ session, skin, palette, colorblind, reducedMotion, disabled, hint, onPour, onSettled, onBusyChange }: Props) {
  const board = session.board;
  const group = board.capacity;
  const [selected, setSelected] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [streams, setStreams] = useState<Record<number, Stream>>({});
  const [flyers, setFlyers] = useState<Record<number, Flyer>>({});
  const [floaters, setFloaters] = useState<Floater[]>([]);
  // Moves commit to the session on tap, so several can be in flight at once. Tubes involved in an
  // in-flight move are locked and show their pre-move contents until the move lands.
  const locked = useRef(new Set<number>());
  const [shown, setShown] = useState<Record<number, Tube>>({});
  const seq = useRef(0);
  const wrap = useRef<HTMLDivElement>(null);
  const tubeEls = useRef<(HTMLDivElement | null)[]>([]);
  const flyerEls = useRef<Record<number, HTMLDivElement | null>>({});
  const { w, h } = useSize(wrap);

  // Layout: one row for small boards, two rows otherwise; tubes scale to fit both axes.
  const n = board.tubes.length;
  const maxCap = Math.max(...board.tubes.map((_, i) => capOf(board, i)));
  const rows = n <= 6 ? 1 : 2;
  const perRow = Math.ceil(n / rows);
  const unitRatio = skin === 'nuts' ? 0.62 : 0.85; // unit height / tube width
  const headRatio = skin === 'nuts' ? 0.55 : 0.45;
  const ratio = maxCap * unitRatio + headRatio + (skin === 'nuts' ? 0.25 : 0.3);
  const gapY = skin === 'liquid' ? 28 : 36;
  let tubeW = Math.min(skin === 'nuts' ? 74 : 64, ((w - 8) / perRow) * (skin === 'nuts' ? 0.78 : 0.66));
  tubeW = Math.max(22, Math.min(tubeW, (h / rows - gapY) / (ratio + 0.4)));
  const unitH = tubeW * unitRatio;
  const headroom = tubeW * headRatio;
  const tubeHOf = (i: number) => headroom + capOf(board, i) * unitH + (skin === 'nuts' ? tubeW * 0.25 : 0);
  const baseH = skin === 'nuts' ? tubeW * 0.25 : 0; // bolt base plate
  const lift = tubeW * 0.45;
  const rowsOf = Array.from({ length: rows }, (_, r) => board.tubes.map((_, i) => i).slice(r * perRow, (r + 1) * perRow));

  /** Y (board coords) of the bottom edge of slot j in tube i. */
  const slotBottom = (i: number, j: number) => {
    const el = tubeEls.current[i]!;
    return el.offsetTop + el.offsetHeight - baseH - j * unitH;
  };
  /** How far a lifted item rises so it hovers just above its tube. */
  const hoverY = (i: number) => tubeEls.current[i]!.offsetTop - unitH * 0.35;

  function flash(i: number) {
    setShake(i);
    setTimeout(() => setShake((s) => (s === i ? null : s)), 400);
  }

  function celebrate(to: number, r: PourResult) {
    const el = tubeEls.current[to];
    const box = wrap.current?.getBoundingClientRect();
    if (!el || !box) return;
    const rect = el.getBoundingClientRect();
    if (!reducedMotion) {
      void confetti({
        particleCount: 26 + r.combo * 12,
        spread: 70,
        startVelocity: 22 + r.combo * 4,
        scalar: 0.7,
        ticks: 90,
        colors: [palette.colors[r.color], '#ffffff'],
        origin: { x: (rect.left + rect.width / 2) / innerWidth, y: rect.top / innerHeight },
      });
    }
    if (r.combo > 1) {
      const id = Date.now() + to;
      const text = r.combo >= 5 ? `INSANE x${r.combo}!` : r.combo >= 3 ? `COMBO x${r.combo}!` : `Combo x${r.combo}`;
      setFloaters((f) => [...f, { id, x: rect.left + rect.width / 2 - box.left, y: rect.top - box.top - 10, text }]);
      setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1300);
    }
    sfx.complete(Math.max(1, r.combo));
    buzz(r.combo > 1 ? [20, 40, 20, 40, 40] : [25, 30, 25]);
  }

  function moveSound(r: PourResult, fillBefore: number) {
    if (skin === 'liquid') sfx.pour(r.amount, fillBefore);
    else if (skin === 'balls') sfx.ball(fillBefore);
    else sfx.nut(r.amount);
  }

  /** Liquid: the tube flies over, tilts, and a stream pours down. */
  async function animatePour(id: number, from: number, to: number, r: PourResult, fillBefore: number, land: () => void) {
    const el = tubeEls.current[from]!;
    const dst = tubeEls.current[to]!;
    // offsetLeft/Top ignore transforms and are relative to .board (the offset parent).
    const sx = el.offsetLeft + el.offsetWidth / 2;
    const sy = el.offsetTop;
    const dx = dst.offsetLeft + dst.offsetWidth / 2;
    const dy = dst.offsetTop;
    const dir = dx >= sx ? 1 : -1;
    const mouthX = dx - dir * tubeW * 0.2;
    const mouthY = dy - tubeW * 0.9;
    const tilted = `translate(${mouthX - sx}px, ${mouthY - sy}px) rotate(${dir * 98}deg)`;
    el.style.zIndex = '30';
    const a1 = el.animate([{ transform: `translateY(${-lift}px)` }, { transform: tilted }], {
      duration: 260,
      easing: 'cubic-bezier(.3,.7,.35,1)',
      fill: 'forwards',
    });
    await a1.finished;
    const bottom = slotBottom(to, fillBefore) - 4;
    const color = palette.colors[r.color];
    setStreams((s) => ({ ...s, [id]: { x: dx, top: mouthY, bottom, width: Math.max(4, tubeW * 0.16), color } }));
    land();
    await wait(140 + r.amount * 80);
    setStreams(({ [id]: _, ...rest }) => rest);
    const a2 = el.animate([{ transform: tilted }, { transform: 'translateY(0)' }], {
      duration: 230,
      easing: 'cubic-bezier(.4,0,.3,1)',
      fill: 'forwards',
    });
    await a2.finished;
    a1.cancel();
    a2.cancel();
    el.style.zIndex = '';
  }

  /** Balls & nuts: the lifted items arc across and drop (or screw) into place. */
  async function animateFly(id: number, from: number, to: number, r: PourResult, fillBefore: number, land: () => void) {
    const src = tubeEls.current[from]!;
    const dst = tubeEls.current[to]!;
    const sx = src.offsetLeft + src.offsetWidth / 2;
    const dx = dst.offsetLeft + dst.offsetWidth / 2;
    const startY = hoverY(from);
    const overY = Math.min(hoverY(from), hoverY(to));
    const endY = slotBottom(to, fillBefore);
    setFlyers((f) => ({ ...f, [id]: { colors: Array(r.amount).fill(r.color), x: sx, y: startY } }));
    await wait(0); // let the flyer mount
    await new Promise(requestAnimationFrame);
    const el = flyerEls.current[id];
    if (el) {
      const across = Math.abs(dx - sx);
      const a = el.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(0, ${overY - startY}px)`, offset: 0.15 },
          { transform: `translate(${dx - sx}px, ${overY - startY}px)`, offset: 0.65 },
          { transform: `translate(${dx - sx}px, ${endY - startY}px)` },
        ],
        { duration: 300 + Math.min(220, across * 0.6) + (skin === 'nuts' ? 120 : 0), easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' },
      );
      await a.finished;
    }
    land();
    setFlyers(({ [id]: _, ...rest }) => rest);
    if (skin === 'balls') {
      const ball = tubeEls.current[to]?.querySelectorAll<HTMLElement>('.ball')[fillBefore];
      ball?.animate([{ transform: 'translateY(-14%)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-5%)' }, { transform: 'translateY(0)' }], {
        duration: 260,
        easing: 'ease-out',
      });
    }
  }

  async function doMove(from: number, to: number) {
    const before = session.board;
    const r = session.pour(from, to);
    if (!r) return;
    const id = ++seq.current;
    const fillBefore = before.tubes[to].units.length;
    locked.current.add(from).add(to);
    onBusyChange?.(true);
    setSelected(null);

    const land = () => {
      setShown(({ [from]: _f, [to]: _t, ...rest }) => rest);
      moveSound(r, fillBefore);
      onPour(r, to);
      if (r.completed) celebrate(to, r);
    };

    if (reducedMotion || !tubeEls.current[from] || !tubeEls.current[to]) {
      land();
    } else if (skin === 'liquid') {
      setShown((s) => ({ ...s, [from]: before.tubes[from], [to]: before.tubes[to] }));
      await animatePour(id, from, to, r, fillBefore, land);
    } else {
      // The source drops its items into the flyer immediately; the target waits for them.
      setShown((s) => ({ ...s, [to]: before.tubes[to] }));
      await animateFly(id, from, to, r, fillBefore, land);
    }
    locked.current.delete(from);
    locked.current.delete(to);
    if (locked.current.size === 0) onBusyChange?.(false);
    onSettled?.(r);
  }

  function tap(i: number) {
    if (disabled || locked.current.has(i)) return;
    const t = board.tubes[i];
    const pourable = t.units.length > 0 && !isComplete(t, group);
    if (selected === null) {
      if (!pourable) {
        if (t.units.length === 0) return;
        flash(i);
        sfx.error();
        return;
      }
      setSelected(i);
      sfx.tap();
      buzz(8);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (session.canPour(selected, i)) {
      void doMove(selected, i);
      return;
    }
    flash(i);
    sfx.error();
    buzz(30);
    setSelected(pourable ? i : null);
  }

  function renderUnits(i: number, t: Tube) {
    const isSel = selected === i && skin !== 'liquid';
    // Lifted items hover above the tube while selected.
    const moving = isSel ? (board.single ? 1 : topRun(t)) : 0;
    // The whole lifted run rises together so its lowest item hovers just above the rim.
    const liftBy = tubeHOf(i) - baseH - (t.units.length - moving) * unitH + unitH * 0.35;
    return t.units.map((c, j) => {
      const hidden = t.hidden[j];
      const lifted = j >= t.units.length - moving;
      const style: CSSProperties = {
        bottom: baseH + j * unitH,
        height: skin === 'liquid' ? unitH + 0.6 : unitH,
        fontSize: unitH * 0.42,
        ['--c' as string]: hidden ? undefined : palette.colors[c],
        transform: lifted ? `translateY(${-liftBy}px)` : undefined,
      };
      const label = hidden ? '?' : colorblind ? SYMBOLS[c] : null;
      if (skin === 'liquid') {
        return (
          <div
            key={j}
            className={`liquid${hidden ? ' mystery' : ''}${j === t.units.length - 1 ? ' surface' : ''}`}
            style={{ ...style, background: hidden ? undefined : palette.colors[c] }}
          >
            {label}
          </div>
        );
      }
      return (
        <div key={j} className={`${skin === 'balls' ? 'ball' : 'nut'}-slot${lifted ? ' lifted' : ''}`} style={style}>
          <div className={`${skin === 'balls' ? 'ball' : 'nut'}${hidden ? ' mystery' : ''}`}>{label}</div>
        </div>
      );
    });
  }

  return (
    <div className={`board skin-${skin}`} ref={wrap} style={{ ['--tw' as string]: `${tubeW}px`, ['--uh' as string]: `${unitH}px` }}>
      <div className="board-rows" style={{ gap: gapY }}>
        {rowsOf.map((row, r) => (
          <div className="board-row" key={r} style={{ gap: Math.max(6, tubeW * (skin === 'nuts' ? 0.22 : 0.38)) }}>
            {row.map((i) => {
              const t = shown[i] ?? board.tubes[i];
              const done = isComplete(t, group);
              const cls = [
                'tube',
                `skin-${skin}`,
                selected === i && 'selected',
                done && 'complete',
                shake === i && 'shake',
                hint && (hint[0] === i ? 'hint-from' : hint[1] === i ? 'hint-to' : ''),
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  key={i}
                  ref={(el) => {
                    tubeEls.current[i] = el;
                  }}
                  className={cls}
                  style={{ width: tubeW, height: tubeHOf(i), '--lift': `${-lift}px` } as CSSProperties}
                  onPointerDown={() => tap(i)}
                  role="button"
                  aria-label={`${skin === 'nuts' ? 'Bolt' : 'Tube'} ${i + 1}`}
                >
                  {skin === 'nuts' ? (
                    <>
                      <div className="bolt-rod" />
                      <div className="bolt-base" />
                      {renderUnits(i, t)}
                    </>
                  ) : (
                    <div className="glass">{renderUnits(i, t)}</div>
                  )}
                  {done && <div className="cork" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {Object.entries(streams).map(([id, st]) => (
        <div
          key={id}
          className="stream"
          style={{ left: st.x - st.width / 2, top: st.top, height: st.bottom - st.top, width: st.width, background: st.color }}
        />
      ))}
      {Object.entries(flyers).map(([id, f]) => (
        <div
          key={id}
          ref={(el) => {
            flyerEls.current[Number(id)] = el;
          }}
          className={`flyer ${skin}`}
          style={{ left: f.x - tubeW / 2, top: f.y - unitH * f.colors.length, width: tubeW, height: unitH * f.colors.length }}
        >
          {f.colors.map((c, k) => (
            <div key={k} className={`${skin === 'balls' ? 'ball' : 'nut'}-slot`} style={{ bottom: k * unitH, height: unitH, ['--c' as string]: palette.colors[c] } as CSSProperties}>
              <div className={skin === 'balls' ? 'ball' : 'nut spinning'}>{colorblind ? SYMBOLS[c] : null}</div>
            </div>
          ))}
        </div>
      ))}
      {floaters.map((f) => (
        <div key={f.id} className="floater" style={{ left: f.x, top: f.y }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}
