# Safari DevTools: Chrome extension

The same in-page DevTools panel as the Safari extension, for **Chrome, Edge, Brave, Arc, Opera** and other Chromium browsers (Chrome 111+).

## Install (1 minute)

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Pin the extension from the puzzle-piece menu, reload any page, and press **Alt+Shift+D** or click the icon.

## If the panel doesn't appear

- Click the icon again: in Chrome it loads the tool on demand, even in tabs that were open before you installed or reloaded the extension.
- A red **!** on the icon means Chrome refused; hover it for the reason. Chrome never lets extensions run on `chrome://` pages, the New Tab page or the Chrome Web Store.
- For local `file://` pages: `chrome://extensions` → Safari DevTools → **Details** → turn on **Allow access to file URLs**.
- Make sure you loaded **this** folder. The Safari folder (`safari-devtools-extension`) shows a manifest error in Chrome.

Pages whose real content is in a full-window frame (claude.ai artifacts, CodePen, StackBlitz, Storybook) get the panel inside that frame, so you see the app's own console, network and elements. It loads when you click, so messages from before the click aren't captured there.

Permissions: `scripting` plus access to all sites are used only to load the panel into the page, or into its main frame, when you click the icon.

## Shortcuts

- **Alt+Shift+D** (⌥⇧D on Mac): show or hide the panel. Change it at `chrome://extensions/shortcuts`.
- **Alt+Shift+C**: pick an element. (Ctrl+Shift+C is Chrome's own inspector on Windows/Linux.)
- **Ctrl+Shift+P**: command palette.

## How it differs from the Safari build

| | Chrome | Safari |
|---|---|---|
| How the tool loads | `"world": "MAIN"` content script, before the page's code | `content.js` injects it into the page |
| Pages with a strict Content-Security-Policy | Works | May be blocked |
| Background | `service_worker` | `background.scripts` |
| Screenshot in bug reports | Offers the current tab first | System window picker |

`content.js`, `background.js` and `safari-devtools.js` are the same files as in the Safari extension. In the repo, run `./sync.sh` after editing them.

## What's inside

```
manifest.json        Manifest V3 for Chromium
sdt-config.js        sets window.__SDT_CONFIG__ (launcher off, source = extension)
safari-devtools.js   the tool, loaded in the page's MAIN world
content.js           toolbar/shortcut messages -> the page (shared with Safari)
background.js        toolbar button / Alt+Shift+D (shared with Safari)
images/              icons
```

To publish it on the Chrome Web Store, zip this folder and upload it from the Chrome Web Store developer dashboard (one-time $5 registration).
