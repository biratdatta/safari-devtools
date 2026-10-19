#!/bin/bash
# After editing standalone/safari-devtools.js or the shared extension files in extension/,
# copy them everywhere they're used: both extensions and the website (site/).
set -e
cd "$(dirname "$0")"
TOOL=standalone/safari-devtools.js

cp "$TOOL" extension/safari-devtools.js
cp "$TOOL" chrome-extension/safari-devtools.js
cp extension/content.js extension/background.js chrome-extension/
cp "$TOOL" site/safari-devtools.js
cp "$TOOL" site/demo/safari-devtools.js

# Rebuild the downloads offered on the website (folder names inside the zips are what users see).
tmp=$(mktemp -d)
cp -R extension "$tmp/safari-devtools-extension"
cp -R chrome-extension "$tmp/safari-devtools-chrome"
(cd "$tmp" && rm -f ./*/.DS_Store && zip -qr safari-devtools-safari.zip safari-devtools-extension && zip -qr safari-devtools-chrome.zip safari-devtools-chrome)
mkdir -p site/downloads
cp "$tmp/safari-devtools-safari.zip" "$tmp/safari-devtools-chrome.zip" site/downloads/
rm -rf "$tmp"

# Rebuild the Chinese and Japanese pages from site/index.html.
if command -v python3 >/dev/null 2>&1; then python3 site/i18n/build.py; else echo "python3 not found: skipped site/zh and site/ja"; fi

echo "Synced safari-devtools.js -> extension/, chrome-extension/, site/ and site/demo/; rebuilt site/downloads/*.zip"
