# Safari DevTools

A Chrome-style DevTools panel that runs inside the page, so it works in any Safari, including iPhone and iPad. It's one dependency-free file, `safari-devtools.js`, and its UI is isolated in a Shadow DOM so it never clashes with your page's CSS.

## Panels

| Panel | What you get |
|---|---|
| **Console** | Captures `log`/`info`/`warn`/`error`/`debug`, `%c` styling, groups, `count`, `time`, uncaught errors and unhandled rejections. Repeated messages collapse into a counter. Objects open as expandable trees, and DOM nodes link to Elements. Has level filters and text filtering. The REPL keeps history (↑/↓) and provides `$0`, `$()`, `$$()`, `copy()`, `clear()` and `inspect()`. |
| **Elements** | Live DOM tree, including open shadow roots. Hovering a node highlights its box model on the page, and the picker (Ctrl+Shift+C) selects an element by clicking it. Arrow keys move through the tree and Delete removes a node. Double-click to edit attributes or text. Breadcrumbs show the path to the selected node. |
| **Styles / Computed** | Matched, `:host`, user-agent and inherited rules, sorted like Chrome, with overridden properties struck through. Click any name or value to edit it, with auto-suggestions for properties, keywords and `var(--tokens)`. Use the checkbox to toggle a property. Also has color swatches, a filterable computed list and a box model. |
| **Sources** | Original files from source maps. Console and error-stack locations show `file.ts:line` and open the file at that line. |
| **Network** | `fetch` and `XMLHttpRequest`, with method, status, type, size, time and a waterfall. Request details have Headers, Payload, Preview (a JSON tree or image), Response and Timing tabs, plus Copy as cURL. Images, scripts and CSS also appear, with timing only. |
| **Storage** | Local storage, session storage and cookies. Add, edit (double-click), rename, delete, filter and clear entries. JSON values get a tree preview. |

## Use it

**In your own app (best: it captures everything from the first line):**

```html
<script src="/path/to/safari-devtools.js"></script>   <!-- first thing in <head> -->
```

Optional attributes: `data-open="true"` opens the panel on load, and `data-launcher="false"` hides the floating button so you open it with the shortcut only.

**On any site (bookmarklet):** host `safari-devtools.js` somewhere reachable over HTTPS, then save this as a bookmark's URL:

```
javascript:(function(){var s=document.createElement('script');s.src='https://YOUR-HOST/safari-devtools.js?'+Date.now();s.dataset.open='true';document.body.appendChild(s);})()
```

The bookmarklet only sees logs and requests made *after* you click it, and sites with a strict Content-Security-Policy will block it.

**Try it now:** open `demo.html` in Safari. Keep it in the same folder as the script.

## Shortcuts

- **Ctrl+Shift+D**: show or hide the panel
- **Ctrl+Shift+C**: inspect an element (Esc cancels)
- **Ctrl+L** in the console: clear it
- The floating button can be dragged; its position is remembered

## JavaScript API

```js
SafariDevTools.show(); SafariDevTools.hide(); SafariDevTools.toggle();
SafariDevTools.inspect(document.querySelector('header'));
SafariDevTools.clear();
```

## Limits of an in-page tool

Page scripts can't see some things the browser's own DevTools can:

- HttpOnly cookies are hidden.
- Browser-added request headers (Cookie, User-Agent) aren't visible.
- Cross-origin stylesheets can't be read.
- Native resource loads (images, scripts, CSS) show timing only.
- There's no JS debugger or breakpoints.

For those, pair this with Safari's Web Inspector. You can also wrap the script in a Safari Web Extension so it injects into every page automatically.
