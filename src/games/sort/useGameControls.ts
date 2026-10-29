import { useEffect, useState } from 'react';
import type { Move } from '../../../shared/sort/engine.ts';
import type { Session } from '../../../shared/sort/session.ts';
import { solve } from '../../../shared/sort/solver.ts';
import { sfx } from '../../platform/feedback';
import { toast } from '../../platform/notify';
import { useArcade } from '../../platform/store';

/** Undo / hint / extra-container handling shared by every sort game mode. */
export function useGameControls(
  session: Session,
  rerender: () => void,
  costs: { hint: number; tube: number },
  busy: boolean,
  container = 'tube',
) {
  const [hint, setHint] = useState<Move | null>(null);

  function pay(cost: number, what: string) {
    if (cost === 0) return true;
    if (useArcade.getState().spend(cost)) {
      sfx.coin();
      return true;
    }
    sfx.error();
    toast({ icon: '🪙', title: 'Not enough coins', body: `${what} costs ${cost}. Solve puzzles and keep your streak to earn more.` });
    return false;
  }

  const undo = () => {
    if (!busy && session.undo()) {
      setHint(null);
      sfx.tap();
      rerender();
    }
  };

  const showHint = () => {
    if (busy || session.stats().solved) return;
    const path = solve(session.board, { maxNodes: 120_000 });
    if (!path?.length) {
      sfx.error();
      toast({ icon: '🤔', title: 'No way out from here', body: `Undo a few moves or add a ${container}.` });
      return;
    }
    if (!pay(costs.hint, 'A hint')) return;
    session.useHint();
    setHint(path[0]);
    rerender();
  };

  const addTube = () => {
    if (busy || session.stats().extras > 0 || session.stats().solved) return;
    if (!pay(costs.tube, `An extra ${container}`)) return;
    session.addTube();
    setHint(null);
    rerender();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'z' || e.key === 'u') undo();
      if (e.key === 'h') showHint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return { hint, setHint, undo, showHint, addTube };
}
