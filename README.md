# Safari DevTools

A Chrome-style DevTools panel that runs **inside the page**, for Safari on Mac, iPhone and iPad. It's one dependency-free JavaScript file, and it comes with an optional Safari extension that adds it to every website.

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
<script src="https://cdn.jsdelivr.net/gh/YOUR-USERNAME/safari-devtools@main/standalone/safari-devtools.js"></script>
```

### Option 3: Try the demo

Open [`standalone/demo.html`](standalone/demo.html) in Safari.

## Repo layout

```
standalone/   safari-devtools.js (the tool), demo.html, docs
extension/    Safari Web Extension (manifest, content script, icons, Xcode build script)
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
