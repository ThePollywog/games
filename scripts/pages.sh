#!/usr/bin/env bash
# Static build for GitHub Pages, written to dist-pages/:
#   /                    Pollywog Arcade (all four games)
#   /<game>/             each game on its own, like its App Store app
#   /support/            support page, the App Store listing's Support URL
#   /privacy/            privacy policy, the App Store listing's Privacy Policy URL
# There is no leaderboard server on static hosting; progress stays in the browser.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=dist-pages
GAMES=(shipshape buoy-oh-buoy knots-and-bolts hex-marks-the-spot)

rm -rf "$OUT"
npx tsc --noEmit
BASE=./ VITE_STATIC=1 npx vite build --outDir "$OUT"
for g in "${GAMES[@]}"; do
  BASE=./ VITE_STATIC=1 VITE_GAME="$g" npx vite build --outDir "$OUT/$g"
done
cp -R store/site "$OUT/support"
cp -R store/privacy "$OUT/privacy"
touch "$OUT/.nojekyll"
echo "Built $OUT/"
