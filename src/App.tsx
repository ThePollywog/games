import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo } from 'react';
import { EDITION } from './games/edition';
import { signIn } from './platform/gameCenter';
import { startWatchers } from './platform/notify';
import { parse, useHash } from './router';
import { HexaHome } from './screens/hexa/HexaHome';
import { HexaPlay } from './screens/hexa/HexaPlay';
import { Hub } from './screens/Hub';
import { SortBlitz } from './screens/sort/SortBlitz';
import { SortHome } from './screens/sort/SortHome';
import { SortPlay } from './screens/sort/SortPlay';
import { Overlays } from './ui/Overlays';
import { useUi } from './ui/uiStore';

export function App() {
  const hash = useHash();
  const route = useMemo(() => parse(hash), [hash]);

  useEffect(() => startWatchers(), []);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) void signIn();
  }, []);
  useEffect(() => useUi.getState().close(), [hash]);

  let screen;
  switch (route.name) {
    case 'hub':
      // A single-game app opens straight onto that game's home.
      screen = EDITION === 'hex-marks-the-spot' ? <HexaHome /> : EDITION ? <SortHome game={EDITION} /> : <Hub />;
      break;
    case 'sort-home':
      screen = <SortHome game={route.game} />;
      break;
    case 'sort-blitz':
      screen = <SortBlitz game={route.game} />;
      break;
    case 'hexa-home':
      screen = <HexaHome />;
      break;
    case 'hexa-play':
      screen = <HexaPlay mode={route.mode} />;
      break;
    default:
      screen = <SortPlay route={route} />;
  }

  return (
    <>
      <main className="app" key={hash}>
        {screen}
      </main>
      <Overlays />
    </>
  );
}
