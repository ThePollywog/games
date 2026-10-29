import { AnimatePresence, motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { useToasts } from '../platform/notify';
import { Achievements } from './Achievements';
import { Leaderboard } from './Leaderboard';
import { Modal } from './Modal';
import { Settings } from './Settings';
import { Shop } from './Shop';
import { useUi } from './uiStore';

/** Global layers rendered above every screen. */
export function Overlays() {
  const { toasts, dismiss, levelUp, closeLevelUp } = useToasts();
  const { panel, close } = useUi();
  return (
    <>
      <div className="toasts">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ y: 30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => dismiss(t.id)}
            >
              <span className="toast-icon">{t.icon}</span>
              <div>
                <strong>{t.title}</strong>
                {t.body && <p>{t.body}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Modal open={!!levelUp} onClose={closeLevelUp}>
        {levelUp && (
          <div className="levelup">
            <motion.div className="levelup-badge" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 9 }}>
              {levelUp.level}
            </motion.div>
            <h2>Level up!</h2>
            <p className="muted">You are now a <strong>{levelUp.title}</strong></p>
            <div className="reward-chips">
              <span className="chip coin">
                <Coins size={16} /> +{levelUp.coins}
              </span>
            </div>
            <button className="btn primary block" onClick={closeLevelUp}>
              Awesome
            </button>
          </div>
        )}
      </Modal>

      <Modal open={panel === 'leaderboard'} onClose={close} title="Leaderboards" wide>
        <Leaderboard />
      </Modal>
      <Modal open={panel === 'achievements'} onClose={close} title="Achievements" wide>
        <Achievements />
      </Modal>
      <Modal open={panel === 'shop'} onClose={close} title="Palette Shop" wide>
        <Shop />
      </Modal>
      <Modal open={panel === 'settings'} onClose={close} title="Settings">
        <Settings />
      </Modal>
    </>
  );
}
