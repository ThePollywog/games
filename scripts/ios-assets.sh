#!/bin/bash
# Renders the App Store icon and splash for one game in the Pollywog mission-plate style
# (BRANDING/ThePollywogMissionWallpaper.png): resources/<game>/icon.svg (a flat line-art glyph)
# inside an ink patch ring on grid paper, and the Pollywog mission patch
# (resources/brand/pollywog-badge.png) centered on paper as the splash. Also writes the small
# icon the arcade hub shows, public/icons/<game>.png.
# Needs ImageMagick. Its SVG renderer ignores gradients, thick <line> strokes and unfilled
# circles, and -draw ignores stroke alpha, so the paper, grid and rings are drawn here in opaque
# colors and the SVG frame uses rects and polygons only.
#   scripts/ios-assets.sh <game>
set -euo pipefail
cd "$(dirname "$0")/.."
GAME=$1
case $GAME in
  shipshape | buoy-oh-buoy | knots-and-bolts | hex-marks-the-spot) ;;
  *) echo "unknown game $GAME" >&2; exit 1 ;;
esac
PAPER='#e4e3db'
INK='#1c2d31'
ORANGE='#e7730c'
DIR=resources/$GAME
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Patch frame: compass ticks, four small orange squares, a star at the foot (rings are drawn below).
cat > "$TMP/frame.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g fill="$INK">
    <rect x="254" y="4" width="4" height="40"/><rect x="4" y="254" width="40" height="4"/><rect x="468" y="254" width="40" height="4"/>
  </g>
  <g fill="$ORANGE">
    <rect x="89" y="89" width="12" height="12"/><rect x="411" y="89" width="12" height="12"/><rect x="89" y="411" width="12" height="12"/><rect x="411" y="411" width="12" height="12"/>
  </g>
  <polygon points="256,452 262,470 281,470 266,481 271,499 256,488 241,499 246,481 231,470 250,470" fill="$INK"/>
</svg>
SVG

# Grid paper: faint lines every 48px and a slightly heavier line every 192px
# (ink over paper at 6% and 12%, pre-blended).
GRID=()
for i in $(seq 0 48 1024); do
  c='#d8d8d1'; [ $((i % 192)) -eq 0 ] && c='#cccdc7'
  GRID+=(-stroke "$c" -draw "line $i,0 $i,1024" -draw "line 0,$i 1024,$i")
done
magick -size 1024x1024 "xc:$PAPER" -strokewidth 2 "${GRID[@]}" "$TMP/paper.png"

magick -background none -density 192 "$TMP/frame.svg" -resize 1024x1024 \
  -fill none -stroke "$INK" -strokewidth 32 -draw 'circle 512,512 512,52' \
  -strokewidth 6 -draw 'circle 512,512 512,88' "$TMP/frame.png"
magick -background none -density 192 "$DIR/icon.svg" -resize 700x700 "$TMP/fg.png"
# Full-bleed and opaque: iOS applies the rounded mask itself and rejects transparency.
magick "$TMP/paper.png" "$TMP/frame.png" -composite "$TMP/fg.png" -gravity center -geometry +0-6 -composite -alpha off "$DIR/icon-1024.png"
magick "$DIR/icon-1024.png" -resize 192x192 -strip "public/icons/$GAME.png"
# Splash: the mission patch at its native size, centered on paper.
magick -size 2732x2732 "xc:$PAPER" resources/brand/pollywog-badge.png -gravity center -composite -alpha off "$DIR/splash-2732.png"
echo "$DIR/icon-1024.png $DIR/splash-2732.png public/icons/$GAME.png"
