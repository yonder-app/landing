#!/bin/bash
set -euo pipefail

if [ "$(uname -s)" != Darwin ]; then
  printf 'Yonder requires macOS 26.1 or later.\n' >&2
  exit 1
fi

DEST=/Applications
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
APP="$DEST/Yonder.app"
if [ -d "$APP" ]; then
  open "$APP"
  exit 0
fi

TMP=$(mktemp -d)
MOUNT="$TMP/mount"
cleanup() {
  if mount | grep -Fq " on $MOUNT "; then
    hdiutil detach "$MOUNT" -quiet || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

printf 'Downloading Yonder…\n'
curl -fL --progress-bar -o "$TMP/Yonder.dmg" \
  https://github.com/yonder-app/releases/releases/download/v1.0.0/Yonder-1.0.0.dmg
printf '%s  %s\n' \
  8583bbfd9f7d07120a8c6a28582cb7c8c25db3ff1099df641435274304ec09a0 \
  "$TMP/Yonder.dmg" | shasum -a 256 -c -

mkdir -p "$MOUNT"
hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT" "$TMP/Yonder.dmg"
[ -d "$MOUNT/Yonder.app" ] || { printf 'Yonder.app was not found in the image.\n' >&2; exit 1; }
printf 'Installing Yonder…\n'
ditto "$MOUNT/Yonder.app" "$TMP/Yonder.app"
mv "$TMP/Yonder.app" "$APP"
open "$APP"
printf 'Yonder is ready.\n'
