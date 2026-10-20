"""
Articles, comparisons and guides for the website, plus the shared footer.

Each page is a dict in PAGES. build.py (site/i18n/build.py) renders them to site/<path>/index.html, adds them to
sitemap.xml and llms.txt, and injects FOOTER into the home pages. Edit the text here, then run ./sync.sh.
"""
import html
import json

UPDATED = '2026-10-20'
REPO = 'https://github.com/biratdatta/safari-devtools'

SECTIONS = {
    'compare': {'name': 'Compare', 'title': 'Compare', 'lead': 'How Safari DevTools compares with the other ways to debug Safari, iPhone and mobile web pages, including where the others are the better choice.'},
    'learn': {'name': 'Learn', 'title': 'Learn', 'lead': 'Practical guides for debugging Safari and iPhone: consoles without a Mac, WebViews, mocking APIs, accessibility, Redux and Safari-only CSS bugs.'},
    'guides': {'name': 'Guides', 'title': 'Setup guides', 'lead': 'Step-by-step setup for the Chrome and Safari extensions, remote debugging on iPhone, and the Claude and Jira integrations.'},
}

CTA = '''<div class="cta"><div><b>Try Safari DevTools</b><span>Free and open source. Works in Safari, Chrome and on iPhone.</span></div>
<div class="btns"><a class="btn primary" href="/#install">Install</a><a class="btn ghost" href="/#demo">Live demo</a></div></div>'''


def table(head, rows):
    th = ''.join('<th scope="col">%s</th>' % h for h in head)
    tr = ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % c for c in r) for r in rows)
    return '<div class="tw"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (th, tr)


Y, N = '✓ Yes', '✕ No'

PAGES = [
    # ------------------------------------------------------------------ compare
    {
        'path': 'compare/safari-web-inspector', 'section': 'compare', 'nav': 'vs Safari Web Inspector',
        'title': 'Safari DevTools vs Safari Web Inspector',
        'description': "Safari's Web Inspector needs a Mac and a cable or pairing. Safari DevTools runs inside the page. When to use each, and what each can't do.",
        'related': ['learn/debug-safari-on-iphone', 'learn/iphone-console-without-mac', 'learn/debug-ios-webviews'],
        'body': '''
<p class="lead">Web Inspector is Safari's built-in debugger. Safari DevTools is a panel that runs inside the page. They come at the same problem from opposite ends, and many developers use both.</p>
<h2>The short version</h2>
''' + table(['', 'Safari Web Inspector', 'Safari DevTools'], [
            ['Needs a Mac', Y, N],
            ['Needs a cable or network pairing for iPhone', Y, N],
            ['Works in in-app WebViews', 'Only if the app makes them inspectable', 'Yes, if you can load one script'],
            ['Breakpoints and step-through debugging', Y, N],
            ['Performance timelines and memory profiling', Y, 'Basic: FPS, long tasks, DOM size, leak check'],
            ['Source-mapped console stack traces', Y, Y],
            ['Mock, block or delay requests', 'Yes, with local overrides', 'Yes, with rules or one right-click'],
            ['Accessibility tree, tab-order overlay, contrast fixer', 'Accessibility details per element', Y],
            ['Redux / NgRx time travel', N, Y],
            ['Explain errors with Claude, Jira bug reports', N, Y],
            ['Same panel in Chrome and Edge', N, Y],
            ['Price', 'Free', 'Free (MIT)'],
        ]) + '''
<h2>When Web Inspector is the right tool</h2>
<ul>
<li>You need to <b>pause JavaScript</b>: breakpoints, stepping, watching variables.</li>
<li>You're profiling: <b>timelines, rendering, memory</b>.</li>
<li>You need things a page can't see: <b>HttpOnly cookies</b>, browser-added request headers, exact network timing.</li>
</ul>
<h2>When Safari DevTools is the right tool</h2>
<ul>
<li><b>You don't have a Mac</b>, or the person testing doesn't (QA, designers, Windows and Linux developers).</li>
<li>The bug is inside an <b>in-app WebView</b> that the app doesn't mark as inspectable.</li>
<li>You want a quick look <b>on the phone itself</b>, without cables or pairing.</li>
<li>You want the extras: request mocking from a right-click, an accessibility toolkit, Redux time travel, design-token editing, AI error explanations and one-click Jira reports.</li>
</ul>
<h2>Using both together</h2>
<p>Load Safari DevTools for the everyday work, and open Web Inspector when you need to step through code. DOM breakpoints in Safari DevTools log the call stack, and can also trigger a <code>debugger</code> pause that Web Inspector picks up when it's open.</p>
<h2>Turning on Web Inspector, for reference</h2>
<ol>
<li>On the iPhone: <b>Settings → Apps → Safari → Advanced → Web Inspector</b> (on older iOS: Settings → Safari → Advanced).</li>
<li>On the Mac: <b>Safari → Settings → Advanced → Show features for web developers</b>.</li>
<li>Connect the iPhone, then choose it from Safari's <b>Develop</b> menu and pick the page.</li>
</ol>
'''},
    {
        'path': 'compare/eruda', 'section': 'compare', 'nav': 'vs Eruda',
        'title': 'Safari DevTools vs Eruda',
        'description': 'Eruda and Safari DevTools both put a console inside the page. How they differ on source maps, request mocking, accessibility, Redux and setup.',
        'related': ['compare/vconsole', 'compare/eruda-alternatives', 'learn/iphone-console-without-mac'],
        'body': '''
<p class="lead">Eruda is a popular open-source console for mobile browsers. Safari DevTools works the same way, by running inside the page, but aims to feel like Chrome DevTools and goes further on debugging and testing.</p>
<h2>At a glance</h2>
''' + table(['', 'Eruda', 'Safari DevTools'], [
            ['Runs inside the page (no Mac or cable)', Y, Y],
            ['Licence', 'MIT', 'MIT'],
            ['Console, elements, network, storage', Y, Y],
            ['Interface', 'Its own mobile-first design', 'Looks and works like Chrome DevTools'],
            ['Source-mapped stack traces', N, Y],
            ['Mock, block, delay and throttle requests', N, Y],
            ['Live CSS editing with design-token suggestions', 'Basic style view', Y],
            ['Accessibility tree, tab order, contrast fixer', N, Y],
            ['Redux / NgRx / Zustand time travel', N, Y],
            ['Browser extensions for Safari and Chrome', N, Y],
            ['Playwright fixture, MCP server for AI agents', N, Y],
            ['Plugin ecosystem', 'Yes, mature', 'No plugins; features are built in'],
        ]) + '''
<h2>Where Eruda shines</h2>
<p>Eruda is small, battle-tested and has a plugin system, with plugins for things like timing, fps and DOM features. If you only need a quick console on a phone and like its mobile layout, it does the job well.</p>
<h2>Where Safari DevTools goes further</h2>
<ul>
<li><b>Errors point to your real code.</b> Stack traces are mapped through source maps to your TypeScript, with original function names.</li>
<li><b>Test the unhappy paths.</b> Mock, block or delay any request, or throttle to 3G or offline, without a proxy.</li>
<li><b>Check accessibility</b> with a screen-reader tree, a numbered tab order on the page and contrast fixes from your tokens.</li>
<li><b>Familiar if you know Chrome.</b> The same tabs, shortcuts and look as Chrome DevTools.</li>
<li><b>Fits your workflow:</b> extensions for Safari and Chrome, remote mode to watch an iPhone from your Mac, and an API for Playwright and AI agents.</li>
</ul>
<h2>Switching from Eruda</h2>
<p>Replace the Eruda script and its <code>eruda.init()</code> call with one line, placed first in <code>&lt;head&gt;</code>:</p>
<pre><code>&lt;script src="https://cdn.jsdelivr.net/gh/biratdatta/safari-devtools@v1.5.2/standalone/safari-devtools.js"&gt;&lt;/script&gt;</code></pre>
<p>No init call is needed. A round button appears in the corner; tap it, or press <span class="kbd">Ctrl</span> <span class="kbd">⇧</span> <span class="kbd">D</span> on a keyboard.</p>
'''},
    {
        'path': 'compare/vconsole', 'section': 'compare', 'nav': 'vs vConsole',
        'title': 'Safari DevTools vs vConsole',
        'description': "vConsole is Tencent's lightweight in-page console, popular in WeChat. How it compares with Safari DevTools for debugging iPhone and mobile web pages.",
        'related': ['compare/eruda', 'compare/eruda-alternatives', 'learn/debug-ios-webviews'],
        'body': '''
<p class="lead">vConsole, from Tencent, is a lightweight console that runs inside the page. It's especially common in WeChat mini-sites and in-app pages. Safari DevTools also runs in the page, with a Chrome-style interface and more debugging tools.</p>
<h2>At a glance</h2>
''' + table(['', 'vConsole', 'Safari DevTools'], [
            ['Runs inside the page', Y, Y],
            ['Licence', 'MIT', 'MIT'],
            ['Logs, network list, elements, storage', Y, Y],
            ['Source-mapped stack traces', N, Y],
            ['Edit CSS live', N, Y],
            ['Mock, block, delay and throttle requests', N, Y],
            ['Accessibility tools', N, Y],
            ['Redux / NgRx time travel', N, Y],
            ['Plugin API', Y, 'No'],
            ['Size and simplicity', 'Very small and simple', 'Larger, more complete'],
        ]) + '''
<h2>Choose vConsole when</h2>
<p>You want the smallest possible console inside a WeChat or in-app page, and logs plus a basic network list are enough.</p>
<h2>Choose Safari DevTools when</h2>
<ul>
<li>You want to <b>fix</b> things in place: edit CSS live, inspect elements through shadow DOM, mock failing APIs.</li>
<li>You need errors mapped to your <b>original source</b>.</li>
<li>You care about <b>accessibility</b>, <b>Redux state</b> or sharing a <b>bug report</b> with your team.</li>
</ul>
<div class="note"><p>Both work in in-app WebViews as long as you can load a script into the page. See <a href="/learn/debug-ios-webviews/">debugging iOS WebViews</a>.</p></div>
'''},
    {
        'path': 'compare/chrome-devtools', 'section': 'compare', 'nav': 'vs Chrome DevTools',
        'title': 'Safari DevTools vs Chrome DevTools',
        'description': "Chrome DevTools is the gold standard on desktop and Android but can't attach to iPhone. Where Safari DevTools fits, and what Chrome still does better.",
        'related': ['compare/safari-web-inspector', 'learn/debug-safari-on-iphone', 'guides/install-chrome'],
        'body': '''
<p class="lead">Safari DevTools was built to bring the Chrome DevTools experience to places Chrome DevTools can't reach. It isn't a replacement for Chrome DevTools on desktop Chrome.</p>
<h2>Where each one works</h2>
''' + table(['', 'Chrome DevTools', 'Safari DevTools'], [
            ['Desktop Chrome and Edge', 'Built in', 'Extension or script'],
            ['Android Chrome', 'Yes, via chrome://inspect over USB', 'Yes, in the page'],
            ['Safari on Mac', N, Y],
            ['Safari and Chrome on iPhone and iPad', N, Y],
            ['In-app WebViews', 'Android, if debugging is enabled', 'Anywhere you can load a script'],
        ]) + '''
<p>On iPhone and iPad, every browser, including Chrome, uses Apple's WebKit engine, so Chrome DevTools can't attach. Apple's own tool for those pages is Safari's Web Inspector, which needs a Mac.</p>
<h2>What Chrome DevTools still does better</h2>
<ul>
<li>A real <b>debugger</b> with breakpoints and stepping.</li>
<li>The <b>Performance</b> panel, memory heap snapshots, Lighthouse and the Recorder.</li>
<li>Full network detail, including HttpOnly cookies and browser-added headers.</li>
</ul>
<h2>What Safari DevTools adds</h2>
<ul>
<li>The <b>same Chrome-style panel in every browser</b>, including Safari and iPhone.</li>
<li>Extras that aren't in Chrome DevTools: <b>Explain with Claude</b>, one-click <b>Jira bug reports</b>, a <b>contrast fixer</b> that suggests colours from your design tokens, <b>component snapshots</b>, <b>Redux time travel</b> without an extra extension, and <b>pseudo-localisation</b>.</li>
</ul>
<p>A good split: Chrome DevTools on desktop Chrome, Safari DevTools for Safari, iPhone, WebViews and anywhere you need the extras.</p>
'''},
    {
        'path': 'compare/eruda-alternatives', 'section': 'compare', 'nav': 'Eruda alternatives',
        'title': 'Eruda alternatives for mobile debugging',
        'description': 'The main alternatives to Eruda for debugging pages on iPhone and Android: Safari DevTools, vConsole, Safari Web Inspector and Chrome remote debugging.',
        'related': ['compare/eruda', 'compare/vconsole', 'learn/debug-safari-on-iphone'],
        'body': '''
<p class="lead">Eruda is a solid in-page console, but it isn't the only way to debug a page on a phone. Here are the main options and what each is best at.</p>
<h2>1. Safari DevTools</h2>
<p>An in-page panel that looks and works like Chrome DevTools, for Safari, Chrome and iPhone. Source-mapped errors, live CSS, request mocking and throttling, accessibility tools, Redux time travel, AI error explanations and Jira reports. Extensions for Safari and Chrome, plus a bookmarklet. Free, MIT.</p>
<p><b>Best for:</b> doing real debugging on the phone, and teams that want one tool across browsers.</p>
<h2>2. vConsole</h2>
<p>Tencent's lightweight in-page console with logs, a network list, elements and storage, plus a plugin API. MIT.</p>
<p><b>Best for:</b> the smallest possible console in WeChat and in-app pages.</p>
<h2>3. Safari Web Inspector</h2>
<p>Apple's built-in debugger, connected from a Mac to the iPhone by cable or network pairing. Full breakpoints, timelines and network detail.</p>
<p><b>Best for:</b> deep debugging when you have a Mac. See <a href="/compare/safari-web-inspector/">Safari DevTools vs Web Inspector</a>.</p>
<h2>4. Chrome remote debugging (Android)</h2>
<p>Connect an Android phone by USB and open <code>chrome://inspect</code> on your computer to use the full Chrome DevTools on the phone's tabs and debuggable WebViews.</p>
<p><b>Best for:</b> Android. It doesn't work for iPhone.</p>
<h2>Quick comparison</h2>
''' + table(['', 'No Mac or cable', 'iPhone', 'Source maps', 'Mock requests', 'Breakpoints'], [
            ['Safari DevTools', Y, Y, Y, Y, N],
            ['Eruda', Y, Y, N, N, N],
            ['vConsole', Y, Y, N, N, N],
            ['Safari Web Inspector', N, Y, Y, Y, Y],
            ['Chrome remote debugging', N, N, Y, Y, Y],
        ]) + '''
'''},
    # -------------------------------------------------------------------- learn
    {
        'path': 'learn/iphone-console-without-mac', 'section': 'learn', 'nav': 'iPhone console without a Mac',
        'title': 'How to see console logs on iPhone without a Mac',
        'description': "Three ways to read console logs and errors from Safari on iPhone without a Mac or cable: a bookmarklet, a script tag, or remote mode over Wi-Fi.",
        'related': ['guides/remote-iphone', 'learn/debug-safari-on-iphone', 'compare/safari-web-inspector'],
        'faq': [
            ('Can I see iPhone Safari console logs on Windows?', 'Yes. Load Safari DevTools on the page to see the console on the phone, or run its relay with Node on your Windows PC and watch the phone\'s console in your browser.'),
            ('Do I need to jailbreak or install an app?', 'No. Safari DevTools runs inside the web page, so it works in the normal Safari app.'),
        ],
        'body': '''
<p class="lead">Apple's Web Inspector needs a Mac. If you don't have one, or don't have it with you, you can still read the console straight from the page.</p>
<h2>Option 1: a bookmarklet (any website, no install)</h2>
<ol>
<li>On the <a href="/#install">install section</a>, open the <b>Bookmarklet</b> tab and copy the code.</li>
<li>In Safari on the iPhone, bookmark any page, then edit that bookmark and paste the code as its <b>address</b>.</li>
<li>Open the page you want to debug and tap the bookmark. The panel opens at the bottom of the screen.</li>
</ol>
<p>It loads after the page, so messages logged before you tap aren't captured. Tap it, then reload the page if you need everything from the start.</p>
<h2>Option 2: a script tag (your own site)</h2>
<p>Add this as the first thing in <code>&lt;head&gt;</code> of your development build. It captures every log and request from the first line:</p>
<pre><code>&lt;script src="https://cdn.jsdelivr.net/gh/biratdatta/safari-devtools@v1.5.2/standalone/safari-devtools.js"&gt;&lt;/script&gt;</code></pre>
<p>A round button appears in the corner of the page. Tap it to open the console.</p>
<h2>Option 3: remote mode (watch from any computer)</h2>
<p>Reading logs on a phone screen is fiddly. Remote mode streams the phone's console and network to your computer over Wi-Fi, and lets you type JavaScript that runs on the phone. It works from macOS, Windows or Linux.</p>
<pre><code>git clone https://github.com/biratdatta/safari-devtools
cd safari-devtools
node standalone/remote/relay.js</code></pre>
<p>Then open <code>http://&lt;your-computer-ip&gt;:9230/demo</code> on the iPhone, and <code>http://localhost:9230</code> on the computer. The <a href="/guides/remote-iphone/">remote mode guide</a> covers using it with your own pages.</p>
<div class="note"><p><b>HTTPS pages:</b> Safari won't let an <code>https://</code> page talk to an <code>http://</code> relay. Use remote mode with your local <code>http://</code> dev server, or serve the relay over HTTPS.</p></div>
<h2>If you do have a Mac</h2>
<p>Safari's Web Inspector gives you breakpoints and profiling too. See <a href="/compare/safari-web-inspector/">Safari DevTools vs Web Inspector</a> for when each is the better choice.</p>
'''},
    {
        'path': 'learn/debug-safari-on-iphone', 'section': 'learn', 'nav': 'Debug Safari on iPhone',
        'title': 'How to debug Safari on iPhone: every method compared',
        'description': 'All the ways to debug a web page in Safari on iPhone and iPad: Web Inspector, an in-page panel, remote mode and automated tests, with what each needs.',
        'related': ['learn/iphone-console-without-mac', 'compare/safari-web-inspector', 'learn/safari-css-bugs'],
        'body': '''
<p class="lead">There's no DevTools button in iPhone Safari. You have four ways to debug a page, depending on what equipment you have and what you need to see.</p>
''' + table(['Method', 'You need', 'Best for'], [
            ['Safari Web Inspector', 'A Mac, plus a cable or network pairing', 'Breakpoints, profiling, exact network detail'],
            ['Safari DevTools on the phone', 'Nothing, or a bookmark', 'Console, elements, CSS, network, accessibility, right on the device'],
            ['Safari DevTools remote mode', 'Any computer with Node on the same Wi-Fi', 'Reading logs and running code comfortably from your desk'],
            ['Automated tests (Playwright WebKit)', 'A test setup', 'Catching Safari bugs in CI before users do'],
        ]) + '''
<h2>1. Web Inspector (Mac)</h2>
<p>Turn on <b>Web Inspector</b> in the iPhone's Safari settings (Settings → Apps → Safari → Advanced), enable <b>Show features for web developers</b> in Safari on the Mac, connect the phone and pick the page from the <b>Develop</b> menu.</p>
<h2>2. An in-page panel</h2>
<p>Load Safari DevTools with a <a href="/#install">bookmarklet or script tag</a> and the full panel opens on the phone: console, elements with live CSS, network with mocking, storage, accessibility and more. No Mac required.</p>
<h2>3. Remote mode</h2>
<p>Run the small relay on your computer and watch the phone's console and network in your desktop browser. See the <a href="/guides/remote-iphone/">remote mode guide</a>.</p>
<h2>4. Catch it in tests</h2>
<p>Playwright's WebKit engine is the same engine Safari uses. The Safari DevTools Playwright fixture adds console, network, accessibility and snapshot checks to those tests:</p>
<pre><code>test('checkout has no errors', async ({ page, devtools }) =&gt; {
  await page.goto('/checkout');
  expect(await devtools.errors()).toEqual([]);
});</code></pre>
<h2>Common Safari-only bugs to check first</h2>
<p>Inputs zooming the page, <code>100vh</code> hidden behind the toolbar, missing safe-area padding and broken sticky headers cause many iPhone-only reports. See <a href="/learn/safari-css-bugs/">Safari-only CSS bugs and fixes</a>.</p>
'''},
    {
        'path': 'learn/debug-ios-webviews', 'section': 'learn', 'nav': 'Debug iOS WebViews',
        'title': 'How to debug WKWebView and in-app browsers on iOS',
        'description': "Debug web content inside iOS apps: make WKWebView inspectable, or inject an in-page DevTools panel. Tips for React Native, Capacitor and Android too.",
        'related': ['compare/safari-web-inspector', 'learn/iphone-console-without-mac', 'compare/vconsole'],
        'body': '''
<p class="lead">Pages inside apps (WKWebView, in-app browsers, hybrid apps) are hard to debug: Safari's Web Inspector only sees them if the app allows it. Here are your options.</p>
<h2>If you build the app: make it inspectable</h2>
<p>Since iOS 16.4, a <code>WKWebView</code> only appears in Safari's Develop menu when the app opts in:</p>
<pre><code>if #available(iOS 16.4, *) {
    webView.isInspectable = true   // debug builds only
}</code></pre>
<h2>Inject Safari DevTools into the WebView</h2>
<p>This works without a Mac and in builds where inspection is off. Bundle <code>safari-devtools.js</code> and add it as a user script that runs before the page's own code:</p>
<pre><code>let url = Bundle.main.url(forResource: "safari-devtools", withExtension: "js")!
let source = try String(contentsOf: url, encoding: .utf8)
let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
configuration.userContentController.addUserScript(script)</code></pre>
<p>A round button appears in the page; tap it to open the panel. Include it only in debug or internal builds.</p>
<h2>React Native, Capacitor and Cordova</h2>
<ul>
<li><b>react-native-webview:</b> pass the file's contents to the <code>injectedJavaScriptBeforeContentLoaded</code> prop.</li>
<li><b>Capacitor and Cordova:</b> add the script tag first in your app's <code>index.html</code> for development builds.</li>
</ul>
<h2>Pages you don't control</h2>
<p>If the page is someone else's (for example, a link opened in an in-app browser), you usually can't inject anything. Open the same URL in Safari and use the <a href="/learn/iphone-console-without-mac/">bookmarklet</a> instead.</p>
<h2>Android WebViews</h2>
<p>Call <code>WebView.setWebContentsDebuggingEnabled(true)</code> in debug builds, then open <code>chrome://inspect</code> on your computer with the phone connected by USB. Or inject Safari DevTools the same way as on iOS.</p>
'''},
    {
        'path': 'learn/mock-api-in-browser', 'section': 'learn', 'nav': 'Mock APIs in the browser',
        'title': 'How to mock, block and slow down API calls in the browser',
        'description': 'Test error states, empty states and slow networks without a proxy: mock responses, block requests and throttle to 3G from an in-page DevTools panel.',
        'related': ['learn/debug-safari-on-iphone', 'compare/chrome-devtools', 'guides/install-chrome'],
        'body': '''
<p class="lead">Most bugs hide in the paths you rarely see: the API returns a 500, the response is empty, or the network is slow. Safari DevTools lets you force those cases right in the page, in Safari, Chrome or on iPhone.</p>
<h2>Mock a response in two clicks</h2>
<ol>
<li>Open the <b>Network</b> tab and find the request.</li>
<li>Right-click it and choose <b>Mock</b>. Edit the status, headers and body, then reload or repeat the action.</li>
</ol>
<p>Mocked requests are tagged <b>mock</b> in the list, so you always know what's real.</p>
<h2>Rules: mock, block or delay by URL</h2>
<p>Under <b>Rules</b>, match requests by text, a <code>*</code> wildcard or a <code>/regex/</code>, optionally by method, and choose an action:</p>
<ul>
<li><b>Mock:</b> return your own status, headers and body.</li>
<li><b>Block:</b> make the request fail, to test error handling.</li>
<li><b>Delay:</b> add latency to one endpoint, to test spinners and race conditions.</li>
</ul>
<p>Rules are saved per site, so they survive reloads.</p>
<h2>Throttle the whole page</h2>
<p>Pick <b>Fast 4G</b>, <b>Fast 3G</b>, <b>Slow 3G</b> or <b>Offline</b> from the throttling menu to see how the page behaves on a poor connection.</p>
<h2>From the console or your tests</h2>
<pre><code>// in the console, or from any script
SafariDevTools.automation.mock('/api/cart', { status: 500, body: { error: 'down' } });
SafariDevTools.automation.throttle('slow3g');

// in Playwright, before the page loads
await devtools.mockBeforeLoad('/api/coupon', { status: 410, body: { error: 'Coupon expired' } });</code></pre>
<div class="note"><p>Mocking covers <code>fetch</code> and <code>XMLHttpRequest</code>. It runs in the page, so it can't change requests made by the browser itself, such as images or form posts that navigate away.</p></div>
'''},
    {
        'path': 'learn/safari-accessibility-testing', 'section': 'learn', 'nav': 'Accessibility testing in Safari',
        'title': 'Accessibility testing in Safari: tree, tab order and contrast',
        'description': 'Check what VoiceOver gets, walk the tab order, catch focus escaping dialogs and fix low-contrast text with colours from your design tokens, in Safari.',
        'related': ['learn/debug-shadow-dom-safari', 'learn/safari-css-bugs', 'compare/safari-web-inspector'],
        'body': '''
<p class="lead">The Accessibility tab in Safari DevTools gives you four quick checks that catch most problems before a full screen-reader pass.</p>
<h2>1. The accessibility tree</h2>
<p>See each element's <b>role</b>, <b>accessible name</b> (and where the name comes from) and <b>states</b> such as expanded, pressed or disabled, the way VoiceOver receives them. It goes through shadow DOM and slots, so web components are covered. Buttons, links and images with no name are flagged.</p>
<h2>2. Tab order</h2>
<p>Turn on the overlay and every focusable element gets a numbered badge on the page, joined by a dashed path, in the order the keyboard visits them. Positive <code>tabindex</code> values, a common cause of confusing order, are flagged.</p>
<h2>3. Focus tracker</h2>
<p>Start tracking, then use the page with the keyboard. Every focus change is logged, and two common bugs are flagged automatically: focus <b>escaping an open dialog</b>, and focus <b>getting lost</b> to the page body.</p>
<h2>4. Contrast fixer</h2>
<p>Pick any text on the page to see its contrast ratio against the real background, with the AA and AAA thresholds (4.5:1 for normal text, 3:1 for large text at AA). If it fails, you get:</p>
<ul>
<li>the <b>closest passing colours from your own design tokens</b>, and</li>
<li>the nearest passing shade of the same colour.</li>
</ul>
<p>Click <b>Apply</b> to try it on the page; the change shows up in the <b>Changes</b> tab, ready to copy as CSS.</p>
<h2>Also useful</h2>
<ul>
<li>The <b>Audit</b> tab lists missing alt text, labels, duplicate ids, heading order and more, including inside shadow DOM.</li>
<li>The <b>Device</b> tab can emulate reduced motion and larger text.</li>
</ul>
<div class="note"><p>These checks catch the common, mechanical problems. Still test with VoiceOver on a real device before shipping.</p></div>
'''},
    {
        'path': 'learn/redux-devtools-safari', 'section': 'learn', 'nav': 'Redux DevTools in Safari',
        'title': 'Redux DevTools in Safari (and NgRx, Zustand)',
        'description': "Safari has no Redux DevTools extension. Safari DevTools provides the same API, so Redux Toolkit, NgRx and Zustand connect, with an action log and time travel.",
        'related': ['learn/debug-shadow-dom-safari', 'compare/chrome-devtools', 'guides/install-safari'],
        'body': '''
<p class="lead">The Redux DevTools extension exists for Chrome and Firefox, but not for Safari or iPhone. Safari DevTools fills that gap.</p>
<h2>How it works</h2>
<p>Safari DevTools provides <code>window.__REDUX_DEVTOOLS_EXTENSION__</code> and <code>window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__</code>, the same hooks the official extension uses. Libraries that look for the extension connect to Safari DevTools instead, with no code changes.</p>
''' + table(['Library', 'What to do'], [
            ['Redux Toolkit', 'Nothing. <code>configureStore</code> enables DevTools by default in development.'],
            ['Plain Redux', 'Use <code>window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__</code> to compose your enhancers, as the Redux docs describe.'],
            ['NgRx', 'Add <code>provideStoreDevtools()</code> (or <code>StoreDevtoolsModule.instrument()</code>).'],
            ['Zustand', 'Wrap your store with the <code>devtools</code> middleware.'],
        ]) + '''
<h2>What you get</h2>
<p>Open <b>Components → Store</b> to see every action with its payload, which keys changed, and the full state after it. <b>Jump</b> to any earlier action to time-travel the UI, or <b>Dispatch</b> a new action by hand.</p>
<h2>One requirement: load it first</h2>
<p>Stores look for the extension when they're created, so Safari DevTools must load before your app. The browser extensions do this automatically. With a script tag, put it first in <code>&lt;head&gt;</code>. The bookmarklet loads too late for store connection; use it for everything else.</p>
'''},
    {
        'path': 'learn/safari-css-bugs', 'section': 'learn', 'nav': 'Safari-only CSS bugs',
        'title': 'Safari-only CSS bugs on iPhone, and how to fix them',
        'description': 'The iPhone Safari layout bugs behind most bug reports: input zoom, 100vh, safe areas, sticky inside overflow, fixed inside transforms, autoplay and tap targets.',
        'related': ['learn/debug-safari-on-iphone', 'learn/safari-accessibility-testing', 'learn/iphone-console-without-mac'],
        'body': '''
<p class="lead">A handful of issues cause most "only broken on iPhone" reports. The Safari DevTools <b>Audit</b> tab checks for all of these, and the <b>Device</b> tab shows the real viewport numbers.</p>
<h2>Inputs zoom the page when tapped</h2>
<p>iOS Safari zooms in when you focus a field whose font size is under 16px. Fix: give inputs, selects and textareas <code>font-size: 16px</code> or more.</p>
<h2><code>100vh</code> is taller than the screen</h2>
<p>On iPhone, <code>100vh</code> is the height with the toolbars hidden, so content sits behind them. Use the newer units: <code>100svh</code> (small viewport), <code>100lvh</code> (large) or <code>100dvh</code> (changes as the toolbar moves). The Device tab shows the measured value of each.</p>
<h2>Content under the notch or home indicator</h2>
<p>To use the full screen, add <code>viewport-fit=cover</code> to the viewport meta tag, then pad edges with <code>env(safe-area-inset-top)</code>, <code>-bottom</code>, <code>-left</code> and <code>-right</code>. The Device tab's safe-area overlay shows where those insets fall.</p>
<pre><code>&lt;meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"&gt;
.toolbar { padding-bottom: env(safe-area-inset-bottom); }</code></pre>
<h2>Sticky headers that don't stick</h2>
<p><code>position: sticky</code> stops working when an ancestor has <code>overflow: hidden</code>, <code>auto</code> or <code>scroll</code>. Move the overflow to a different element, or use <code>overflow: clip</code>.</p>
<h2>Fixed elements that scroll away</h2>
<p>A <code>position: fixed</code> element inside an ancestor with a <code>transform</code>, <code>filter</code> or <code>will-change: transform</code> becomes fixed to that ancestor instead of the screen. Move it outside the transformed element.</p>
<h2>Videos that won't autoplay</h2>
<p>iOS only autoplays inline video that is <code>muted</code> and has <code>playsinline</code>.</p>
<h2>Sideways scrolling</h2>
<p>One element wider than the screen makes the whole page scroll sideways. The Audit tab lists the culprits; <b>Outline all elements</b> in the Device tab makes them easy to spot.</p>
<h2>Tap targets too small</h2>
<p>Aim for at least 44 × 44 points for anything tappable, as Apple's guidelines suggest. The Audit tab flags smaller ones.</p>
'''},
    {
        'path': 'learn/debug-shadow-dom-safari', 'section': 'learn', 'nav': 'Shadow DOM in Safari',
        'title': 'Debugging web components and shadow DOM in Safari',
        'description': 'Inspect shadow roots, slots, ::part() hooks and the CSS variables a web component reads, edit properties live, and search across shadow boundaries.',
        'related': ['learn/safari-accessibility-testing', 'learn/redux-devtools-safari', 'compare/eruda'],
        'body': '''
<p class="lead">Web components hide their insides in shadow DOM, which makes them harder to debug. Safari DevTools is built with them in mind.</p>
<h2>See inside shadow roots</h2>
<p>The <b>Elements</b> tree shows <code>#shadow-root (open)</code> under each component and what each <code>&lt;slot&gt;</code> renders. The picker selects elements inside shadow DOM directly, and the Styles pane shows <code>:host</code> rules alongside the element's own.</p>
<h2>The Component pane</h2>
<p>Select a custom element and open <b>Component</b> to see:</p>
<ul>
<li>its <b>properties</b>, which you can edit live, and observed attributes;</li>
<li>its <b>slots</b> and what's assigned to each;</li>
<li>the <b><code>::part()</code></b> hooks it exposes for styling;</li>
<li>the <b>CSS custom properties</b> it reads, with their current values;</li>
<li>extra details for <b>Lit</b> and <b>Angular</b> components.</li>
</ul>
<h2>Find elements across shadow boundaries</h2>
<p>Search the Elements tree with normal CSS selectors; the search goes into open shadow roots. In the automation API and Playwright fixture, use <code>&gt;&gt;&gt;</code> to pierce shadow roots:</p>
<pre><code>SafariDevTools.automation.element('user-card &gt;&gt;&gt; .label');</code></pre>
<h2>Accessibility inside components</h2>
<p>The Accessibility tab's tree and the Audit tab both go through shadow DOM, so you can check names and roles of controls inside your components.</p>
<div class="note"><p>Closed shadow roots (<code>mode: 'closed'</code>) are hidden from page scripts by design, so no in-page tool can see inside them.</p></div>
'''},
    # ------------------------------------------------------------------- guides
    {
        'path': 'guides/install-chrome', 'section': 'guides', 'nav': 'Install on Chrome',
        'title': 'Install Safari DevTools in Chrome and Edge',
        'description': 'Install the Safari DevTools extension in Chrome, Edge, Brave or Arc in about a minute, open it with Alt+Shift+D, and fix common problems.',
        'related': ['guides/install-safari', 'compare/chrome-devtools', 'learn/mock-api-in-browser'],
        'body': '''
<p class="lead">The Chrome extension works in Chrome 111 and later, and in other Chromium browsers such as Edge, Brave and Arc.</p>
<h2>Install</h2>
<ol>
<li><a href="/downloads/safari-devtools-chrome.zip">Download the Chrome extension</a> and unzip it.</li>
<li>Open <code>chrome://extensions</code> (Edge: <code>edge://extensions</code>) and turn on <b>Developer mode</b>.</li>
<li>Click <b>Load unpacked</b> and choose the <b>safari-devtools-chrome</b> folder.</li>
<li>Pin it from the puzzle-piece menu.</li>
</ol>
<h2>Use it</h2>
<p>Open any website and press <span class="kbd">Alt</span> <span class="kbd">⇧</span> <span class="kbd">D</span> (<span class="kbd">⌥</span> <span class="kbd">⇧</span> <span class="kbd">D</span> on Mac), or click the icon. On pages whose content sits in a full-window frame, such as CodePen, Storybook or claude.ai artifacts, the panel opens inside that frame.</p>
<h2>Troubleshooting</h2>
''' + table(['What you see', 'Why, and the fix'], [
            ['A red <b>!</b> on the icon and a help tab', 'Chrome refused on that page; the help tab says why. Chrome never allows extensions on its own pages (New Tab, <code>chrome://</code>, the Web Store).'],
            ['Nothing on a local <code>file://</code> page', 'On <code>chrome://extensions</code>, open the extension’s <b>Details</b> and turn on <b>Allow access to file URLs</b>.'],
            ['Works on some sites, not others', 'In <b>Details → Site access</b>, choose <b>On all sites</b>. Company-managed Chrome may block extensions on some domains; use the <a href="/#install">bookmarklet</a> there.'],
            ['Old behaviour after an update', 'Click the reload ↻ arrow on the extension card, then reload the page.'],
        ]) + '''
<p>To change the shortcut, open <code>chrome://extensions/shortcuts</code>.</p>
'''},
    {
        'path': 'guides/install-safari', 'section': 'guides', 'nav': 'Install on Safari',
        'title': 'Install Safari DevTools in Safari on Mac',
        'description': 'Add the Safari DevTools extension to Safari as a temporary extension in a minute, or build it once with Xcode to keep it installed. Includes troubleshooting.',
        'related': ['guides/install-chrome', 'guides/remote-iphone', 'compare/safari-web-inspector'],
        'body': '''
<p class="lead">There are two ways to add the extension to Safari: a quick temporary install, or a one-time Xcode build that stays installed.</p>
<h2>Quick: temporary extension</h2>
<ol>
<li><a href="/downloads/safari-devtools-safari.zip">Download the Safari extension</a> and unzip it.</li>
<li>In Safari, open <b>Settings → Advanced</b> and turn on <b>Show features for web developers</b>.</li>
<li>Open <b>Settings → Developer</b>, click <b>Add Temporary Extension…</b> and choose the <b>safari-devtools-extension</b> folder.</li>
<li>In <b>Settings → Extensions</b>, turn on Safari DevTools and allow it on websites.</li>
</ol>
<p>Temporary extensions are removed when Safari quits; add it again next time.</p>
<h2>Permanent: build with Xcode</h2>
<ol>
<li>Install Xcode from the Mac App Store and open it once.</li>
<li>In Terminal, inside the extension folder, run <code>./build-xcode-project.sh</code> (add <code>--ios</code> to build for iPhone and iPad too).</li>
<li>In Xcode, pick your <b>Team</b> under Signing &amp; Capabilities for each target (a free Personal Team works), then press <span class="kbd">⌘</span> <span class="kbd">R</span>.</li>
<li>Turn the extension on in <b>Safari → Settings → Extensions</b> and allow it on every website.</li>
</ol>
<h2>Use it</h2>
<p>Press <span class="kbd">Ctrl</span> <span class="kbd">⇧</span> <span class="kbd">D</span> on any page, or click the toolbar button.</p>
<h2>Troubleshooting</h2>
<ul>
<li><b>Not listed in Settings:</b> run the app from Xcode again and restart Safari.</li>
<li><b>Disappears after quitting Safari:</b> it was added as a temporary or unsigned extension. Pick a Team in Xcode so it stays.</li>
<li><b>Does nothing on a page:</b> allow it for that site from the toolbar icon. Safari's own pages never allow extensions.</li>
</ul>
'''},
    {
        'path': 'guides/remote-iphone', 'section': 'guides', 'nav': 'iPhone remote mode',
        'title': 'Remote mode: debug an iPhone from your computer over Wi-Fi',
        'description': "Stream an iPhone page's console and network to your computer and run JavaScript on the phone with a small Node relay. No cable or Xcode; works on Windows.",
        'related': ['learn/iphone-console-without-mac', 'guides/claude-and-jira', 'learn/debug-ios-webviews'],
        'body': '''
<p class="lead">Remote mode connects a page on your phone to a viewer on your computer. You see the phone's console and network live, and anything you type runs on the phone.</p>
<h2>1. Start the relay</h2>
<p>You need Node 18 or later on the computer. There's nothing else to install.</p>
<pre><code>git clone https://github.com/biratdatta/safari-devtools
cd safari-devtools
node standalone/remote/relay.js</code></pre>
<p>It prints your computer's address on the network, for example <code>http://192.168.1.20:9230</code>.</p>
<h2>2. Connect the phone</h2>
<p>The phone must be on the same Wi-Fi. To try it, open <code>http://&lt;computer-ip&gt;:9230/demo</code> on the phone. For your own page, either load the tool from the relay:</p>
<pre><code>&lt;script src="http://&lt;computer-ip&gt;:9230/safari-devtools.js" data-remote="http://&lt;computer-ip&gt;:9230"&gt;&lt;/script&gt;</code></pre>
<p>or, if the page already loads Safari DevTools, add <code>?sdt-remote=http://&lt;computer-ip&gt;:9230</code> to its address.</p>
<h2>3. Watch on the computer</h2>
<p>Open <code>http://localhost:9230</code>. Pick the device, then read logs and requests as they happen and type JavaScript to run on the phone.</p>
<h2>Security</h2>
<ul>
<li>The viewer and the control API only answer requests from the computer itself, unless you start the relay with a token: <code>SDT_TOKEN=some-secret node standalone/remote/relay.js</code>.</li>
<li>Only run the relay on networks you trust.</li>
</ul>
<h2>HTTPS pages</h2>
<p>Safari blocks an <code>https://</code> page from talking to an <code>http://</code> relay (mixed content). Use remote mode with your local <code>http://</code> development server, or put the relay behind HTTPS.</p>
<h2>For automation and AI agents</h2>
<p>The relay also exposes an HTTP API (<code>/api/devices</code>, <code>/api/logs</code>, <code>/api/network</code>, <code>/api/eval</code>, <code>/api/call</code>) and an MCP server, so tests and agents like Claude or Cursor can read and drive the page on the phone.</p>
'''},
    {
        'path': 'guides/claude-and-jira', 'section': 'guides', 'nav': 'Claude & Jira setup',
        'title': 'Set up "Explain with Claude" and Jira bug reports',
        'description': 'Turn on AI error explanations with Claude and one-click Jira bug reports, using a local relay that keeps your API key and Jira token on your machine.',
        'related': ['guides/remote-iphone', 'learn/mock-api-in-browser', 'privacy'],
        'body': '''
<p class="lead">Both features run through the same small relay you use for remote mode. Your keys stay in the relay on your computer; the page and the phone never see them.</p>
<h2>Start the relay with your keys</h2>
<pre><code>ANTHROPIC_API_KEY=sk-ant-... \\
JIRA_URL=https://your-team.atlassian.net \\
JIRA_EMAIL=you@company.com \\
JIRA_TOKEN=... \\
JIRA_PROJECT=WEB \\
node standalone/remote/relay.js</code></pre>
<ul>
<li>Set only the Claude variables, or only the Jira ones, if you want just one feature.</li>
<li><code>SDT_MODEL</code> chooses the Claude model; <code>JIRA_ISSUE_TYPE</code> defaults to <b>Bug</b>.</li>
<li>Create a Jira API token in your Atlassian account settings under <b>Security → API tokens</b>.</li>
</ul>
<h2>Use them</h2>
<ul>
<li><b>Explain with Claude:</b> click <b>✨ Explain</b> on any console error. You see the full prompt (the error, the original source around it, recent requests and logs) and can edit it before clicking <b>Ask Claude</b>.</li>
<li><b>Report a bug:</b> click the bug icon in the panel's toolbar. Steps to reproduce, console errors and device info are filled in; tick the HAR, debug report or screenshot to attach, then click <b>Create Jira issue</b>.</li>
</ul>
<h2>Without a relay</h2>
<p>You can still use <b>Open in Claude.ai</b> or <b>Copy prompt</b>, and <b>Copy as Jira text</b> or <b>Download attachments</b>.</p>
<h2>Security</h2>
<ul>
<li>Without a token, the relay only accepts these requests from your own computer and from local pages (<code>localhost</code>, <code>*.local</code>, <code>*.test</code>). Add other development sites with <code>SDT_ORIGINS=https://staging.example.com</code>.</li>
<li>For a phone or another machine, start the relay with <code>SDT_TOKEN=...</code> and enter the token in the dialog's relay field.</li>
<li>Sign-in codes, tokens, cookies and authorization headers are blanked from prompts, reports and attachments before anything is sent.</li>
</ul>
'''},
    {
        'path': 'privacy', 'section': None, 'nav': 'Privacy',
        'title': 'Privacy',
        'description': 'What Safari DevTools and this website collect: nothing by default. How the optional Claude and Jira features handle data.',
        'related': ['guides/claude-and-jira', 'guides/install-chrome', 'guides/install-safari'],
        'body': '''
<p class="lead">Safari DevTools is built to keep your data on your machine. This page explains exactly what happens to it.</p>
<h2>The tool and the extensions</h2>
<ul>
<li>Safari DevTools runs inside the page you're looking at. It doesn't send page content, logs or network data anywhere.</li>
<li>Your settings for each site (theme, panel position, mock rules, snippets) are stored in that site's local storage in your browser.</li>
<li>The browser extensions ask for permission to run on websites so they can add the panel to pages. They don't collect or transmit browsing data.</li>
</ul>
<h2>Optional features that send data</h2>
<p><b>Explain with Claude</b> and <b>Jira bug reports</b> only work if you start the relay on your own computer with your own Anthropic and Jira credentials. When you use them, the prompt or report you see and confirm is sent from your relay to Anthropic or to your Jira site, under your accounts and their terms. Sign-in codes, tokens, cookies and authorization headers are removed first.</p>
<p><b>Remote mode</b> sends the phone's console and network data to the relay running on your computer, over your local network.</p>
<h2>This website</h2>
<ul>
<li>No cookies, no analytics and no tracking scripts.</li>
<li>The site is served by Cloudflare, which processes standard request data such as IP addresses to deliver and protect it.</li>
<li>The live demo runs entirely in your browser.</li>
</ul>
<h2>Contact</h2>
<p>Questions or concerns: <a href="https://github.com/biratdatta/safari-devtools/issues">open an issue on GitHub</a>.</p>
'''},
]

PAGE_BY_PATH = {p['path']: p for p in PAGES}

FOOTER_COLUMNS = [
    ('Product', [('Live demo', '/#demo'), ('Features', '/#features'), ('Install', '/#install'), ('FAQ', '/#faq'), ('Changelog', REPO + '#whats-new')]),
    ('Compare', [(p['nav'], '/' + p['path'] + '/') for p in PAGES if p['section'] == 'compare']),
    ('Learn', [(p['nav'], '/' + p['path'] + '/') for p in PAGES if p['section'] == 'learn']),
    ('Support', [(p['nav'], '/' + p['path'] + '/') for p in PAGES if p['section'] == 'guides'] +
     [('Report an issue', REPO + '/issues'), ('Privacy', '/privacy/')]),
]

FOOTER = '''<footer class="site-footer">
  <div class="wrap">
    <div class="fgrid">
      <div class="fbrand">
        <a class="brand" href="/"><img src="/logo.png" alt="" width="30" height="30">Safari DevTools</a>
        <p>Chrome-style DevTools inside any page, for Safari, Chrome and iPhone. Free and open source.</p>
        <a class="fstar" href="%(repo)s"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2 4.3 4.7.6-3.4 3.2.9 4.6L8 11.6l-4.2 2.3.9-4.6L1.3 6.1 6 5.5z"/></svg>Star on GitHub</a>
      </div>
%(cols)s
    </div>
    <div class="fbottom"><span>Safari DevTools · MIT licence · Made by Birat Datta</span><span><a href="/">English</a> · <a href="/zh/">简体中文</a> · <a href="/ja/">日本語</a></span></div>
  </div>
</footer>''' % {
    'repo': REPO,
    'cols': '\n'.join('      <nav class="fcol" aria-label="%s"><h2>%s</h2><ul>%s</ul></nav>' % (
        t, t, ''.join('<li><a href="%s">%s</a></li>' % (u, html.escape(n)) for n, u in links)) for t, links in FOOTER_COLUMNS),
}


def _head(base, url, title, description, ld):
    return '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(doctitle)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="text/markdown" title="LLM-friendly summary" href="/llms.txt">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Safari DevTools">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta property="og:image" content="%(base)s/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(base)s/og.jpg">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/footer.css">
<script type="application/ld+json">
%(ld)s
</script>
</head>
<body>
<header class="nav"><div class="wrap">
  <a class="brand" href="/"><img src="/logo.png" alt="" width="26" height="26">Safari DevTools</a>
  <nav aria-label="Site"><a href="/#features">Features</a><a href="/compare/">Compare</a><a href="/learn/">Learn</a><a href="/guides/">Guides</a><a href="%(repo)s">GitHub</a></nav>
  <a class="btn primary small" href="/#install">Get it free</a>
</div></header>
''' % {'title': html.escape(title), 'doctitle': html.escape(title if len(title) > 44 else title + ' · Safari DevTools'), 'desc': html.escape(description), 'url': url, 'base': base, 'ld': ld.replace('</', '<\\/'), 'repo': REPO}


def _ld(graph):
    return json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, indent=1)


def _crumbs(base, items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': base + u} for i, (n, u) in enumerate(items)]}


def render_page(base, p):
    url = '%s/%s/' % (base, p['path'])
    sec = SECTIONS.get(p['section'])
    trail = [('Home', '/')] + ([(sec['name'], '/%s/' % p['section'])] if sec else []) + [(p['nav'], '/%s/' % p['path'])]
    graph = [
        {'@type': 'TechArticle', 'headline': p['title'], 'description': p['description'], 'url': url,
         'datePublished': UPDATED, 'dateModified': UPDATED, 'inLanguage': 'en', 'image': base + '/og.jpg',
         'author': {'@type': 'Person', 'name': 'Birat Datta', 'url': 'https://github.com/biratdatta'},
         'publisher': {'@type': 'Organization', 'name': 'Safari DevTools', 'logo': {'@type': 'ImageObject', 'url': base + '/logo.png'}},
         'about': {'@type': 'SoftwareApplication', 'name': 'Safari DevTools', 'url': base + '/'}},
        _crumbs(base, trail),
    ]
    faq_html = ''
    if p.get('faq'):
        graph.append({'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in p['faq']]})
        faq_html = '<h2>Questions</h2><div class="faqs">%s</div>' % ''.join(
            '<details><summary>%s</summary><p>%s</p></details>' % (html.escape(q), html.escape(a)) for q, a in p['faq'])
    crumbs = ' <span aria-hidden="true">›</span> '.join('<a href="%s">%s</a>' % (u, html.escape(n)) for n, u in trail[:-1])
    related = ''.join('<li><a href="/%s/">%s<small>%s</small></a></li>' % (r, html.escape(PAGE_BY_PATH[r]['title']), html.escape(PAGE_BY_PATH[r]['description'][:90].rsplit(' ', 1)[0] + '…'))
                      for r in p.get('related', []) if r in PAGE_BY_PATH)
    words = len(p['body'].split())
    return (_head(base, url, p['title'], p['description'], _ld(graph)) +
            '<main class="article">\n<nav class="crumbs" aria-label="Breadcrumb">%s</nav>\n<h1>%s</h1>\n<p class="meta">Updated %s · %d min read</p>\n%s\n%s\n%s\n%s\n</main>\n%s\n</body>\n</html>\n' % (
                crumbs, html.escape(p['title']), UPDATED, max(2, round(words / 220)), p['body'].strip(), faq_html, CTA,
                ('<section class="related"><h2>Related</h2><ul>%s</ul></section>' % related) if related else '', FOOTER))


def render_hub(base, key):
    sec = SECTIONS[key]
    url = '%s/%s/' % (base, key)
    items = [p for p in PAGES if p['section'] == key]
    graph = [{'@type': 'CollectionPage', 'name': sec['title'], 'description': sec['lead'], 'url': url, 'inLanguage': 'en',
              'hasPart': [{'@type': 'TechArticle', 'headline': p['title'], 'url': '%s/%s/' % (base, p['path'])} for p in items]},
             _crumbs(base, [('Home', '/'), (sec['name'], '/%s/' % key)])]
    cards = ''.join('<a href="/%s/"><b>%s</b><span>%s</span></a>' % (p['path'], html.escape(p['title']), html.escape(p['description'])) for p in items)
    return (_head(base, url, sec['title'], sec['lead'], _ld(graph)) +
            '<main class="hub">\n<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a></nav>\n<h1>%s</h1>\n<p class="lead">%s</p>\n<div class="cards">%s</div>\n%s\n</main>\n%s\n</body>\n</html>\n' % (
                html.escape(sec['title']), html.escape(sec['lead']), cards, CTA, FOOTER))


def write_all(site_dir, base):
    """Writes every article and hub page. Returns [(url, title, description)] for the sitemap and llms.txt."""
    import os
    out = []
    for p in PAGES:
        d = os.path.join(site_dir, p['path'])
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(render_page(base, p))
        out.append(('%s/%s/' % (base, p['path']), p['title'], p['description'], p['section']))
    for key in SECTIONS:
        d = os.path.join(site_dir, key)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(render_hub(base, key))
        out.append(('%s/%s/' % (base, key), SECTIONS[key]['title'], SECTIONS[key]['lead'], 'hub'))
    return out
