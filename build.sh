#!/usr/bin/env bash
# Build a .zip package for Chrome Web Store submission
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "0.0.0")
# Strip leading 'v' if present (e.g. v1.0.0 -> 1.0.0)
VERSION="${VERSION#v}"
OUT="bobblevr-${VERSION}.zip"

rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  background.js \
  bootstrap.js \
  content.js \
  mse-hook-loader.js \
  mse-hook.js \
  overlay.js \
  overlay.css \
  face-worker.html \
  face-worker.js \
  icons/ \
  lib/ \
  -x "*.DS_Store"

echo ""
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
