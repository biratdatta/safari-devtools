# Safari DevTools: Safari extension

This puts the same Chrome-style DevTools panel (Console, Elements/CSS, Network, Storage) on every website you open in Safari. You don't need to add any script tags or bookmarklets.

- **Toolbar button**: click it to show or hide the panel.
- **Ctrl+Shift+D**: show or hide the panel. **Ctrl+Shift+C**: pick an element to inspect.
- The panel loads before each page's own code, so logs and requests from page load are captured too.

## Install (about 5 minutes, once)

You need a Mac with **Xcode** installed (free from the Mac App Store). Open it once after installing so it finishes setup.

**1. Create the Xcode project.** Open Terminal in this folder and run:

```bash
chmod +x build-xcode-project.sh
./build-xcode-project.sh          # add --ios to also build for iPhone/iPad
```

Xcode opens with a new project named **Safari DevTools**.

**2. Sign it with your Apple ID.** In Xcode:

1. Click the blue project icon at the top of the left sidebar.
2. For **each target** (the app and the extension), open **Signing & Capabilities** and pick your **Team**. A free "Personal Team" from your Apple ID works. If you haven't added your Apple ID yet, use Xcode → Settings → Accounts.

**3. Build and run.** Press **⌘R**. A small "Safari DevTools" app opens, which installs the extension, and you can then close the app.

**4. Turn it on in Safari**

1. **Safari → Settings → Advanced:** tick **Show features for web developers**.
2. **Safari → Settings → Developer:** tick **Allow unsigned extensions**. On older Safari versions this is **Develop menu → Allow Unsigned Extensions**. You only need this step if Xcode signed the extension without a Team.
3. **Safari → Settings → Extensions:** tick **Safari DevTools**.
4. Click **Edit Websites…** (or the extension's toolbar icon) and set it to **Allow on every website**.

Reload any page, then click the toolbar icon. The panel appears.

## Updating the tool

The Xcode project points at the files in this folder. After you change `safari-devtools.js` (or anything here), press **⌘R** in Xcode again and reload the page in Safari.

## Troubleshooting

| Problem | Fix |
|---|---|
| Extension isn't listed in Safari Settings | Run the app from Xcode again (⌘R) and restart Safari. |
| Extension disappears after quitting Safari | Unsigned extensions reset each launch. Pick a Team in Signing & Capabilities so it stays installed. |
| Toolbar icon does nothing on a page | Give it access to that site (toolbar icon → *Always Allow on This Website*) and reload. Safari's own pages (Settings, Start Page) never allow extensions. |
| Panel doesn't appear on one specific site | That site's Content-Security-Policy may block injected scripts. Use Safari's Web Inspector there. |
| You want the floating round button back | In `content.js`, change `s.dataset.launcher = 'false'` to `'true'`. |

## Sharing it with others

To give other people a signed build, or to publish it on the Mac App Store, you need the **Apple Developer Program** ($99/year). Use Xcode → Product → Archive, then distribute. Without that, others can build it themselves by following the steps above.

## What's inside

```
manifest.json            extension definition (Manifest V3)
content.js               runs on every page; injects safari-devtools.js into the page
background.js            toolbar button → toggles the panel
safari-devtools.js       the DevTools panel itself (same file as the standalone version)
images/                  app and toolbar icons
build-xcode-project.sh   wraps the folder into an Xcode project
```
