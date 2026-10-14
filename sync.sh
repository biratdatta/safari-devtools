#!/bin/bash
# Copy the tool into the extension after editing standalone/safari-devtools.js
set -e
cd "$(dirname "$0")"
cp standalone/safari-devtools.js extension/safari-devtools.js
echo "Synced standalone/safari-devtools.js -> extension/safari-devtools.js"
