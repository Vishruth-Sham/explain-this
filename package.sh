#!/usr/bin/env bash
# Assembles everything the Chrome Web Store upload needs into store/.
#
#   store/explain-this-<version>.zip   the extension itself
#   store/icon-128.png                 listing icon
#   store/promo-440x280.png            small promo tile
#
# store/ is gitignored — it is all generated from tracked sources.
# Put listing screenshots in store/screenshots/ and they will be left alone.
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(node -p "require('./extension/manifest.json').version")
OUT="store/explain-this-${VERSION}.zip"

mkdir -p store
rm -rf .package store/explain-this-*.zip

# Ship only what the extension loads at runtime — no tests, no docs, no source art.
rsync -a \
  --exclude='README.md' \
  --exclude='*.test.mjs' \
  --exclude='icon.svg' \
  --exclude='promo-*' \
  extension/ .package/
(cd .package && zip -qr "../$OUT" . -x '.*')
rm -rf .package

cp extension/assets/icon-128.png store/icon-128.png
sips -s format png extension/assets/promo-440x280.svg --out store/promo-440x280.png >/dev/null

echo "store/"
ls -1 store
