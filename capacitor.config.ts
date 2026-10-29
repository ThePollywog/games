import type { CapacitorConfig } from '@capacitor/cli';

/**
 * One App Store app per game. Pick one with GAME, e.g. `GAME=buoy-oh-buoy npx cap open ios`.
 * appName is the label under the icon (keep it ≤ 13 characters); the App Store name is set in App Store Connect.
 */
const APPS: Record<string, { appId: string; appName: string }> = {
  'shipshape': { appId: 'com.thepollywog.shipshape', appName: 'Shipshape' },
  'buoy-oh-buoy': { appId: 'com.thepollywog.buoyohbuoy', appName: 'Buoy Oh Buoy' },
  'knots-and-bolts': { appId: 'com.thepollywog.knotsandbolts', appName: 'Knots & Bolts' },
  'hex-marks-the-spot': { appId: 'com.thepollywog.hexmarksthespot', appName: 'Hex Marks' },
};

const game = process.env.GAME ?? '';
if (!APPS[game]) throw new Error(`Set GAME to one of: ${Object.keys(APPS).join(', ')}`);

const config: CapacitorConfig = {
  ...APPS[game],
  webDir: `dist-apps/${game}`,
  backgroundColor: '#e4e3db',
  ios: {
    path: `ios/${game}`,
    // The CSS already pads for safe areas with env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#e4e3db',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#e4e3db' },
    // LIGHT means dark status-bar text, for the light paper background.
    StatusBar: { style: 'LIGHT', overlaysWebView: true },
  },
};

export default config;
