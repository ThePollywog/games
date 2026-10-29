#!/bin/bash
# The four App Store apps (one per game) built from this codebase.
#   npm run ios -- add   <game...>   generate and configure ios/<game> (once per game)
#   npm run ios -- build [game...]   build the web app for each game and sync it into Xcode (default: all)
#   npm run ios -- open  <game>      open the Xcode project
#   npm run ios -- run   <game>      build, sync and run on a simulator or device
set -euo pipefail
cd "$(dirname "$0")/.."
ALL=(shipshape buoy-oh-buoy knots-and-bolts hex-marks-the-spot)
CMD=${1:-}; shift || true
GAMES=("$@"); [ ${#GAMES[@]} -eq 0 ] && GAMES=("${ALL[@]}")

for g in "${GAMES[@]}"; do
  [[ " ${ALL[*]} " == *" $g "* ]] || { echo "unknown game: $g (expected ${ALL[*]})" >&2; exit 1; }
done

web() { VITE_GAME=$1 npx vite build --outDir "dist-apps/$1" --emptyOutDir --logLevel warn; }

ruby_xcodeproj() {
  if ruby -e 'require "xcodeproj"' 2>/dev/null; then ruby "$@"
  elif command -v brew >/dev/null && [ -d "$(brew --prefix cocoapods 2>/dev/null)/libexec" ]; then
    GEM_HOME="$(brew --prefix cocoapods)/libexec" "$(brew --prefix ruby)/bin/ruby" "$@"
  else echo "needs the xcodeproj gem: gem install xcodeproj" >&2; exit 1; fi
}

case $CMD in
  add)
    for g in "${GAMES[@]}"; do
      [ -d "ios/$g" ] && { echo "ios/$g already exists; delete it to regenerate" >&2; exit 1; }
      web "$g"
      GAME=$g npx cap add ios
      scripts/ios-assets.sh "$g" >/dev/null
      ruby_xcodeproj scripts/ios-setup.rb "$g"
      GAME=$g npx cap sync ios
    done ;;
  build)
    npx tsc --noEmit
    for g in "${GAMES[@]}"; do
      web "$g"
      GAME=$g npx cap sync ios
      # Re-apply name, icon and splash so changes to them don't need a regenerated project.
      scripts/ios-assets.sh "$g" >/dev/null
      ruby_xcodeproj scripts/ios-setup.rb "$g" >/dev/null
    done ;;
  open) GAME=${GAMES[0]} npx cap open ios ;;
  run)
    web "${GAMES[0]}"
    GAME=${GAMES[0]} npx cap run ios ;;
  *) sed -n '2,6p' "$0"; exit 1 ;;
esac
