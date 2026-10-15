# Safari DevTools

<p align="center">
  <a href="docs/safari-devtools-demo.mp4"><img src="docs/demo.gif" width="320" alt="Safari DevTools demo: console errors mapped to TypeScript, then live CSS editing with token suggestions"></a>
  <br>
  <b><a href="docs/safari-devtools-demo.mp4">▶ Watch the 40-second demo (with sound)</a></b>
</p>

A Chrome-style DevTools panel that runs **inside the page**, for Safari on Mac, iPhone and iPad. It's one dependency-free JavaScript file, and it comes with an optional Safari extension that adds it to every website.

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/console.png" width="240" alt="Console"><br><b>Console</b><br>Errors link to the original file</td>
    <td align="center"><img src="docs/screenshots/sources.png" width="240" alt="Sources"><br><b>Sources</b><br>Source maps open the exact line</td>
    <td align="center"><img src="docs/screenshots/autocomplete.png" width="240" alt="Styles autocomplete"><br><b>Styles</b><br>Suggestions for <code>var(--tokens)</code></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/live-css.png" width="240" alt="Live CSS"><br><b>Live CSS</b><br>Edits apply instantly</td>
    <td align="center"><img src="docs/screenshots/network.png" width="240" alt="Network"><br><b>Network</b><br>Requests with a waterfall</td>
    <td align="center"><img src="docs/screenshots/storage.png" width="240" alt="Storage"><br><b>Storage</b><br>Edit local storage and cookies</td>
  </tr>
</table>

## Features

| Panel | Highlights |
|---|---|
| **Console** | Logs, errors and rejections. Source-mapped stack traces show original names, like `UserService.loadUser (user.service.ts:42)`. The REPL has autocomplete, history, `$0`, `$()`, `$$()` and `copy()`. |
| **Elements** | DOM tree including shadow roots, a picker, and find by text, selector or XPath. Copy a node's selector, JS path, XPath or HTML. DOM breakpoints log the call stack. |
| **Styles · Listeners · Component** | Live CSS with token autocomplete, plus inherited, `:host` and user-agent rules. See every event listener and where it was added. For web components: properties, slots, `::part()` and the CSS variables they read, with Lit and Angular details. |
| **Sources** | Original files from source maps, with search across all files. |
| **Network** | fetch, XHR, WebSocket and SSE. **Mock, block or delay** requests, throttle to 3G or offline, copy as fetch or cURL, replay requests, and export a HAR file. |
| **Storage** | Local storage, session storage and cookies, with editing. |
| **Performance** | Web Vitals where Safari supports them, live FPS and DOM-size graphs, long tasks and a memory-leak check. |
| **Tokens** | Every `--css-variable` on the page, grouped, with live overrides you can copy as CSS. |
| **Audit** | Safari and iPhone pitfalls, plus accessibility checks that reach into shadow DOM. |
| **Device** | Safe-area and viewport overlay, `100vh`/`dvh`/`svh` values, a touch visualiser and outline-all-elements. |
| **Remote mode** | Debug an iPhone from your Mac over Wi-Fi: `node standalone/remote/relay.js`. |
| **Automation** | `SafariDevTools.automation` JSON API, a Playwright fixture (WebKit desktop and iPhone), WebDriver for real Safari, and an HTTP API plus an **MCP server** for AI agents. See [standalone/README.md](standalone/README.md#automation-playwright-real-safari-and-ai-agents). |

Extras: light and dark themes, docking to the bottom or right, a debug-report export, and settings remembered per site.

Shortcuts: **Ctrl+Shift+D** shows or hides the panel, and **Ctrl+Shift+C** picks an element.

## Use it

### Option 1: Safari extension (works on every site)

1. Download this repo: green **Code** button → **Download ZIP**, then unzip it.
2. Safari → Settings → Advanced → tick **Show features for web developers**.
3. Safari → Settings → **Developer** → **Add Temporary Extension…** → select the **`extension`** folder.
4. Settings → **Extensions** → tick **Safari DevTools**, then **Edit Websites…** → **Allow**.
5. Reload any page and press **Ctrl+Shift+D**, or click the `</>` toolbar icon.

Temporary extensions are removed when Safari quits. To install it permanently, build it with Xcode; see [`extension/README.md`](extension/README.md).

### Option 2: Script tag (your own app)

Add this as the first thing in `<head>`, in development builds only:

```html
<script src="https://cdn.jsdelivr.net/gh/biratdatta/safari-devtools@main/standalone/safari-devtools.js"></script>
```

### Option 3: Try the demo

Open [`standalone/demo.html`](standalone/demo.html) in Safari.

## Repo layout

```
standalone/   safari-devtools.js (the tool), demo.html, docs, remote/ (relay + viewer for iPhone debugging)
extension/    Safari Web Extension (manifest, content script, icons, Xcode build script)
docs/         demo video, GIF and screenshots used in this README
sync.sh       copies standalone/safari-devtools.js into extension/
```

`safari-devtools.js` is the same file in both folders. Edit the one in `standalone/`, then run `./sync.sh`.

## Limits

These come from running inside the page instead of inside the browser:

- HttpOnly cookies, browser-added request headers and cross-origin stylesheets aren't visible.
- There's no JavaScript debugger or breakpoints.
- Sites with a strict Content-Security-Policy may block the injected script.

## License

MIT. See [LICENSE](LICENSE).
