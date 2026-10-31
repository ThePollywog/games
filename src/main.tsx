import '@fontsource/black-ops-one/latin-400.css';
import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline play and install for the web builds (see scripts/pwa.ts). The native apps bundle their files.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
