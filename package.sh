#!/usr/bin/env bash
# Builds the Chrome Web Store upload zip from extension/.
# Ships only what the extension loads at runtime — no tests, no docs, no icon source.
set -euo pipefail

VERSION=$(node -p "require('./extension/manifest.json').version")
OUT="explain-this-${VERSION}.zip"

rm -rf .package "$OUT"
rsync -a --exclude='README.md' --exclude='*.test.mjs' --exclude='icon.svg' --exclude='promo-*' extension/ .package/
(cd .package && zip -qr "../$OUT" . -x '.*')
rm -rf .package

echo "$OUT"
