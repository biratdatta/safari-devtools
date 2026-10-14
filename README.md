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
| **Console** | Logs, errors and unhandled rejections. Objects open as expandable trees, and repeated messages collapse into a counter. Includes a REPL with `$0`, `$()`, `$$()`, `copy()` and `clear()`. |
| **Elements** | Live DOM tree including shadow roots, a box-model hover highlight, an element picker (Ctrl+Shift+C), and attribute and text editing. |
| **Styles** | Matched, `:host`, user-agent and inherited rules, with overridden properties struck through. Values are editable inline, with auto-suggestions for properties, keywords and your `var(--tokens)`. Also has a Computed tab and a box model. |
| **Sources** | Original files from source maps, with clickable `file.ts:line` links in the Console and error stacks. |
| **Network** | `fetch`/XHR with headers, payload, JSON preview, timing and Copy as cURL. |
| **Storage** | Local storage, session storage and cookies, with add, edit, delete and a JSON preview. |

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
standalone/   safari-devtools.js (the tool), demo.html, docs
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
