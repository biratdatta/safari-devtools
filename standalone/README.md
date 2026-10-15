# Safari DevTools

**The best in-page DevTools for Safari and iPhone.** A Chrome-style panel that runs inside the page, so it works in any Safari (Mac, iPhone, iPad and in-app WebViews) with no cable or Xcode. It's one dependency-free file, `safari-devtools.js`, and its UI is isolated in a Shadow DOM so it never clashes with your page's CSS. See the [main README](../README.md#how-it-compares) for how it compares with Safari's Web Inspector, Eruda and vConsole.

## Panels

| Panel | What you get |
|---|---|
| **Console** | Logs, warnings, errors and unhandled rejections, with `%c` styling, groups, `count` and `time`. Repeated messages collapse into a counter, and objects open as expandable trees. Error stack traces are **source-mapped**, so minified names like `at o` become `UserService.loadUser (user.service.ts:42)`. The REPL has **autocomplete** for globals and object properties (Tab or → to accept), history on ↑/↓, and `$0`, `$()`, `$$()`, `copy()`, `clear()` and `inspect()`. |
| **Elements** | Live DOM tree including shadow roots, a box-model highlight and an element picker (Ctrl+Shift+C). **Find** (⌘F) matches text, CSS selectors (piercing shadow roots) or XPath. Right-click a node to copy its selector, JS path, XPath or outerHTML, edit it as HTML, hide it, delete it or store it as a global. **DOM breakpoints** fire on subtree, attribute or removal changes and log the call stack, optionally pausing in Web Inspector. |
| **Styles · Computed · Listeners · Component** | **Layout** lists every grid and flex container. Click the `grid`/`flex` badge next to a tag in the tree to overlay grid lines with numbers, gaps, flex items and direction on the page. **Styles** shows matched, `:host`, user-agent and inherited rules with overrides struck through, and live editing with suggestions for properties, keywords and your `var(--tokens)`. **Computed** has the box model. **Listeners** lists every event listener on the element and its ancestors, with where it was added, and lets you remove one. **Component** is for web components: properties (editable), observed attributes, slots, `::part()` hooks and the CSS variables it reads, plus Lit and Angular component details. |
| **Console extras** | **Live expressions** (pinned JS values that update continuously), **Preserve log** across reloads and navigations, real `console.table()` tables, and Chrome's console helpers: `monitorEvents(el, 'mouse')`, `unmonitorEvents`, `monitor(fn)` / `unmonitor`, `debug(fn)` / `undebug`, `getEventListeners(el)`, `keys()`, `values()`, `table()` and `dir()`. |
| **Components** | A **component tree** for Angular (dev builds; properties, `@Input`s and **signals**, editable, then `ng.applyChanges()`), Lit and other web components (reactive properties and state, editable) and React 16–19 (props, plus editable state hooks and class state). **Store**: an action log with **time travel** for Redux Toolkit, NgRx (`StoreDevtoolsModule` / `provideStoreDevtools`) and Zustand devtools. Safari DevTools provides the Redux DevTools extension API that Safari lacks, so these connect automatically. Each action shows its payload, the changed keys and the state after it, with Jump and Dispatch. |
| **Issues** | CSP violations, mixed content, deprecated APIs (`document.write`, sync XHR, `unload` listeners, `document.domain`), non-passive scroll listeners, failed resource loads and failed requests, grouped and counted as they happen. |
| **Sources** | Original files from source maps, plus the scripts as served. Has **Snippets**, reusable scripts saved per site (Ctrl/⌘+Enter to run), **search across all files**, and opens at the exact line from any Console link. |
| **Network** | `fetch`, XHR, **WebSocket** and **EventSource** traffic (with a Messages view), with a waterfall, headers, payload, JSON preview and timing. **Rules** let you block a URL, mock a response (status, headers, body) or add a delay, matching by text, `*` wildcards or `/regex/`. **Throttling** offers Fast 4G, Fast 3G, Slow 3G and Offline. Right-click a request to copy it as fetch or cURL, copy the response, mock it, block it or replay it. |
| **Storage** | Local storage, session storage and cookies: add, edit, rename, delete and filter, with a JSON preview. |
| **Changes** | Every CSS edit you make in the panel (rule values, added or disabled properties, inline styles and token overrides), shown as a red/green before-and-after diff. **Copy as CSS** to paste into your `.css`/`.scss` (with `@media` wrappers kept), **copy as diff**, download a `.css` file, or revert one rule or everything. |
| **Assets** | **Fonts:** the font each piece of text actually renders in, flagging when the first font in the CSS stack wasn't available and the browser fell back; also each `@font-face` and whether it loaded. **Images:** displayed size compared with the file's real size at your screen density, highlighting oversized images (with the bytes you'd save), blurry low-res images, images missing width/height, below-the-fold images that aren't lazy-loaded, and heavy PNG/JPEG files. **Animations:** every running CSS animation, transition and `element.animate()`, with pause/play, a scrubber and global slow-motion (0.5×, 0.25×, 0.1×). |
| **Performance** | FCP, LCP, CLS, INP and TTFB where Safari supports them, a live FPS graph, a DOM-size graph, long tasks, the biggest layout shifts, page-load timings, and a **memory leak check** for removed elements still held in memory. |
| **Tokens** | Every CSS custom property on the page (including inside components), grouped by prefix with its current value, where it's defined and how often it's used. Click a value to override it live across the page, then copy your overrides as CSS. |
| **Audit** | Scans the page, including shadow DOM, for **Safari and iPhone issues** (inputs under 16px that cause zoom, `100vh`, sticky inside overflow, fixed inside a transform, missing `viewport-fit`, autoplay rules, horizontal scroll, small tap targets…) and **accessibility issues** (missing alt text, labels and accessible names, low contrast, click handlers that can't be reached by keyboard, duplicate ids, heading order…). |
| **Device** | A **design overlay**: drop, paste (⌘V) or choose a Figma/Sketch export, set its opacity and export scale (1×–4×), nudge it with the arrow keys, and switch on *difference* blend so any mismatch lights up. Also viewport, visual viewport, the measured `100vh`/`svh`/`lvh`/`dvh` and safe-area insets, plus toggles for a **safe-area and viewport overlay**, a **touch visualiser** (taps, swipes, long-press and multi-touch, drawn on screen) and **outline all elements**. |

From the **⋯ menu**, you can switch between light, dark and auto themes, dock the panel to the bottom or right, **export a debug report** (JSON) or a **HAR** file, and start **remote mode**. Settings are remembered per site.

## Use it

**In your own app (best: it captures everything from the first line):**

```html
<script src="/path/to/safari-devtools.js"></script>   <!-- first thing in <head> -->
```

Optional attributes:
- `data-open="true"` opens the panel on load.
- `data-launcher="false"` hides the floating button.
- `data-remote="http://<mac-ip>:9230"` starts remote mode.

**Try it now:** open `demo.html` in Safari. Keep it in the same folder as the script.

## Remote mode: debug an iPhone from your Mac

Remote mode streams the phone's console, errors and network to your Mac, and runs code you type on the Mac on the phone. It needs no cable and works on the same Wi-Fi.

```bash
node remote/relay.js          # on your Mac (Node 16+, no install needed)
```

It prints your Mac's address. Then:

1. **Try it:** open `http://<mac-ip>:9230/demo` on the iPhone.
2. **Use it in your own page:** load the tool from the relay:
   `<script src="http://<mac-ip>:9230/safari-devtools.js" data-remote="http://<mac-ip>:9230"></script>`.
   If your page already loads the tool, add `?sdt-remote=http://<mac-ip>:9230` to its URL instead.
3. **Watch it:** open `http://localhost:9230` on the Mac to see the logs and requests, and to run JavaScript on the phone.

Safari won't let an `https://` page talk to an `http://` relay, because that's mixed content. Use it with local `http://` dev servers, or put the relay behind https.

## Automation: Playwright, real Safari and AI agents

Everything the panel shows is also available as JSON through `window.SafariDevTools.automation`, so tests and agents can use it. Call `.help()` for the list of methods.

```js
const A = SafariDevTools.automation;
A.errors();                                   // console errors (with source-mapped locations)
A.network({ url: '/api', failed: true, bodies: true });
A.mock('/api/user', { status: 500, body: { error: 'down' } });   // also block(), delay(), throttle('slow3g')
A.audit({ severity: 'error' });               // Safari + accessibility issues, with CSS selectors
A.styles('user-card >>> .label');             // ">>>" goes into shadow roots
A.listeners('#buy'); A.component('user-card'); A.tokens(); A.perf(); A.report();
await A.waitForLog('ready'); await A.waitForRequest('/api/user');
```

**Playwright (Safari's WebKit engine, desktop and iPhone).** See `playwright/`. The fixture injects the tool before the page's own scripts. It adds a typed `devtools` object to every test, and attaches a debug report and a HAR file when a test fails.

```ts
import { test, expect } from './safari-devtools.fixture';
test('checkout survives an API outage', async ({ page, devtools }) => {
  await devtools.mockBeforeLoad('/api/cart', { status: 503 });
  await page.goto('/checkout');
  expect(await devtools.errors()).toEqual([]);
});
```

To set it up, run `cd playwright && npm run setup`, then `npm test`. Playwright drives WebKit, the engine Safari uses, not the Safari app itself.

**Real Safari (WebDriver).** `playwright/real-safari.mjs` drives the actual Safari app through `safaridriver`, injects the tool and reads its data. It needs a one-time setup:

1. In Safari → Settings → Developer, tick **Allow remote automation**.
2. Run `safaridriver --enable` in Terminal.

**AI agents and other tools (remote).** The relay (`node remote/relay.js`) has a JSON API for any connected page, including an iPhone:

| Endpoint | What it does |
|---|---|
| `GET /api/devices` | Connected pages (URL, user agent, viewport) |
| `GET /api/logs?level=error&text=…` | Console messages |
| `GET /api/network` | Requests |
| `POST /api/eval` `{ "code": "document.title" }` | Run JavaScript on the device and get the result |
| `POST /api/call` `{ "action": "audit", "args": [] }` | Call any automation method |

By default these endpoints only answer requests from your Mac. To allow other machines, start the relay with `SDT_TOKEN=secret node remote/relay.js` and send `Authorization: Bearer secret`.

**MCP server (Claude, Cursor and other MCP clients).** `remote/mcp.js` exposes the same features as tools. They include `get_console`, `get_network`, `run_js`, `audit_page`, `inspect_element`, `mock_request`, `set_throttling`, `get_design_tokens`, `get_performance` and `debug_report`.

```bash
claude mcp add safari-devtools -- node /path/to/remote/mcp.js        # Claude Code
```

For Claude Desktop, add `"safari-devtools": { "command": "node", "args": ["/path/to/remote/mcp.js"] }` under `mcpServers`. Start the relay first. Set `SDT_RELAY` or `SDT_TOKEN` if you changed the defaults.

## Shortcuts

- **Ctrl+Shift+D**: show or hide the panel
- **Ctrl+Shift+C**: inspect an element (Esc cancels)
- **Ctrl+Shift+P** (or **⌘K** inside the panel): **command palette**. Jump to any panel, action, snippet or source file, or type `#id`, `.class` or `<tag` to find elements
- **⌘F / Ctrl+F** in Elements: find
- **Hold ⌥ (Option) and hover** with the panel open: measure the distance from the selected element to the one under the mouse, as in Figma
- **Ctrl+L** in the Console: clear it
- **Tab / →** in the Console: accept an autocomplete suggestion

## JavaScript API

```js
SafariDevTools.show(); SafariDevTools.hide(); SafariDevTools.toggle();
SafariDevTools.inspect(document.querySelector('header'));
SafariDevTools.clear();
```

## Limits of an in-page tool

Page scripts can't see some things the browser's own DevTools can:

- HttpOnly cookies and browser-added request headers (Cookie, User-Agent) aren't visible.
- Cross-origin stylesheets can't be read.
- Native resource loads (images, scripts, CSS) show timing only, and rules and throttling apply to `fetch`/XHR only.
- There's no step-through JS debugger. DOM breakpoints can trigger `debugger;`, which pauses only when Safari's Web Inspector is open.
- Safari doesn't expose long tasks, layout shifts or JS heap size to pages, so those show as unsupported.
- The leak check relies on garbage-collection timing, so treat it as a hint.
