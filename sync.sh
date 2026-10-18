#!/bin/bash
# After editing standalone/safari-devtools.js or the shared extension files in extension/,
# copy them into both extensions (Safari: extension/, Chrome: chrome-extension/).
set -e
cd "$(dirname "$0")"
cp standalone/safari-devtools.js extension/safari-devtools.js
cp standalone/safari-devtools.js extension/content.js extension/background.js chrome-extension/
echo "Synced safari-devtools.js -> extension/ and chrome-extension/; content.js + background.js -> chrome-extension/"
