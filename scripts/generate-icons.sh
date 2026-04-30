#!/usr/bin/env bash
# Generate the Garnish PWA icon set from a Twemoji codepoint.
#
# Master: 1024x1024 background with the emoji rendered at 700px, centered.
# All output sizes are direct downscales. Emoji-to-canvas ratio (700/1024 ≈
# 68%) sits inside the 80% maskable safe zone, so the same composite is
# reused for the maskable variant.
#
# Outputs:
#   frontend/public/favicon.svg              (the bare Twemoji SVG)
#   frontend/public/icons/icon-192.png       (PWA)
#   frontend/public/icons/icon-512.png       (PWA)
#   frontend/public/icons/icon-maskable-512.png  (PWA, maskable purpose)
#   frontend/public/icons/apple-touch-icon-180.png
#
# Tooling: rsvg-convert (SVG -> PNG) + ImageMagick (composite + resize).
#
# Usage:
#   scripts/generate-icons.sh                # default: 🌿 (1f33f) on white
#   scripts/generate-icons.sh 1f4aa          # different emoji
#   BG_COLOR='#f0fdf4' scripts/generate-icons.sh   # tinted background
#
# Pin a specific Twemoji tag so future emoji-art tweaks don't silently
# rewrite our icons. Bump TWEMOJI_VERSION when you want the latest art.

set -euo pipefail

CODEPOINT="${1:-1f33f}"  # 1f33f = 🌿 (herb / parsley sprig)
TWEMOJI_VERSION="v14.0.2"
BG_COLOR="${BG_COLOR:-white}"
EMOJI_PX=700
MASTER_PX=1024

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$REPO_ROOT/frontend/public"
ICONS_DIR="$PUBLIC_DIR/icons"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SVG_URL="https://cdn.jsdelivr.net/gh/twitter/twemoji@${TWEMOJI_VERSION}/assets/svg/${CODEPOINT}.svg"
SVG_PATH="$TMP_DIR/emoji.svg"
EMOJI_PNG="$TMP_DIR/emoji.png"
MASTER_PNG="$TMP_DIR/master.png"

mkdir -p "$ICONS_DIR"

echo "→ downloading $SVG_URL"
curl --silent --show-error --fail -o "$SVG_PATH" "$SVG_URL"

# Use the bare emoji SVG as the browser-tab favicon — matches the
# rasterized PNG icons but stays vector-crisp in browser tabs.
cp "$SVG_PATH" "$PUBLIC_DIR/favicon.svg"
echo "→ $PUBLIC_DIR/favicon.svg"

echo "→ rasterizing emoji to ${EMOJI_PX}x${EMOJI_PX}"
rsvg-convert --width "$EMOJI_PX" --height "$EMOJI_PX" "$SVG_PATH" --output "$EMOJI_PNG"

echo "→ compositing onto ${MASTER_PX}x${MASTER_PX} ${BG_COLOR} background"
magick -size "${MASTER_PX}x${MASTER_PX}" "xc:${BG_COLOR}" \
  "$EMOJI_PNG" -gravity center -composite "$MASTER_PNG"

# PWA icon (192) + PWA icon (512) + maskable variant (same composite, since
# emoji sits inside the 80% safe zone) + Apple touch icon (180).
declare -A TARGETS=(
  ["$ICONS_DIR/icon-192.png"]=192
  ["$ICONS_DIR/icon-512.png"]=512
  ["$ICONS_DIR/icon-maskable-512.png"]=512
  ["$ICONS_DIR/apple-touch-icon-180.png"]=180
)

for out in "${!TARGETS[@]}"; do
  size="${TARGETS[$out]}"
  echo "→ $out (${size}x${size})"
  magick "$MASTER_PNG" -resize "${size}x${size}" "$out"
done

echo "✓ done. icons in $ICONS_DIR; favicon at $PUBLIC_DIR/favicon.svg"
