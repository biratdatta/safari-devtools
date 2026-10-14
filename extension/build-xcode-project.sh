#!/bin/bash
# Turns this folder into an Xcode project for a Safari Web Extension.
# Requires Xcode (free from the Mac App Store).
#
# Usage:  ./build-xcode-project.sh            # Mac only
#         ./build-xcode-project.sh --ios      # Mac + iPhone/iPad
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/../SafariDevTools-Xcode"
PLATFORM="--macos-only"
[ "$1" == "--ios" ] && PLATFORM=""

xcrun safari-web-extension-converter "$DIR" \
  --project-location "$OUT" \
  --app-name "Safari DevTools" \
  --bundle-identifier "com.$(whoami | tr -cd '[:alnum:]').SafariDevTools" \
  --swift \
  $PLATFORM

echo ""
echo "Xcode project created in: $OUT"
echo "Next: in Xcode pick your Apple ID under Signing & Capabilities, then press Run (⌘R)."
