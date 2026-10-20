#!/usr/bin/env python3
"""
Builds the translated pages of the website from the English one:

    site/index.html  ->  site/zh/index.html   (Simplified Chinese)
                     ->  site/ja/index.html   (Japanese)

Run it after changing site/index.html:   python3 site/i18n/build.py
(./sync.sh runs it for you.)

It also keeps the SEO pieces in step: structured data (JSON-LD, built from each page's own text), canonical URLs,
sitemap.xml, robots.txt, and llms.txt / llms-full.txt for AI assistants. When you move to a custom domain, run it once with the new address:
    python3 site/i18n/build.py --site-url https://devtools.example.com

Each entry below is an exact piece of the English page and its translations. If a piece is no longer found
on the English page, the build stops and says which one, so translations never silently go stale.
To add a language, add a column to STRINGS and an entry to LANGS.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SITE, 'content'))
import pages  # noqa: E402  articles, guides and the shared footer

LANGS = {
    'zh': {'html': 'zh-Hans', 'label': '简体中文', 'dir': 'zh'},
    'ja': {'html': 'ja', 'label': '日本語', 'dir': 'ja'},
}

# (english, chinese, japanese). Longer, more specific pieces first; HTML around a word keeps matches exact.
STRINGS = [
    # ---- head
    ('<html lang="en">', '<html lang="zh-Hans">', '<html lang="ja">'),
    ('<title>Safari DevTools · Chrome-style DevTools inside any page</title>',
     '<title>Safari DevTools · 在任意网页中运行的 Chrome 风格开发者工具</title>',
     '<title>Safari DevTools · どんなページでも動く Chrome 風 DevTools</title>'),
    ('content="Free, open-source Chrome-style DevTools that run inside any page in Safari, Chrome and on iPhone. Console, network mocking, accessibility checks, AI error help."',
     'content="免费开源的 Chrome 风格开发者工具，可在 Safari、Chrome 和 iPhone 的任意网页中运行。控制台、网络模拟、无障碍检查，以及 AI 报错解释。"',
     'content="Safari、Chrome、iPhone のどんなページでも動く、無料・オープンソースの Chrome 風 DevTools。コンソール、ネットワークのモック、アクセシビリティチェック、AI によるエラー解説。"'),
    ('<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="zh_CN">\n<meta property="og:locale:alternate" content="ja_JP">',
     '<meta property="og:locale" content="zh_CN">\n<meta property="og:locale:alternate" content="en_US">\n<meta property="og:locale:alternate" content="ja_JP">',
     '<meta property="og:locale" content="ja_JP">\n<meta property="og:locale:alternate" content="en_US">\n<meta property="og:locale:alternate" content="zh_CN">'),
    ('content="Safari DevTools: Chrome-style DevTools inside any page"',
     'content="Safari DevTools：在任意网页中运行的 Chrome 风格开发者工具"',
     'content="Safari DevTools：どんなページでも動く Chrome 風 DevTools"'),
    ('content="Safari DevTools: DevTools, inside the page"',
     'content="Safari DevTools：把开发者工具放进网页"',
     'content="Safari DevTools：ページの中に DevTools を"'),
    ('content="Chrome-style DevTools for Safari, Chrome and iPhone. Free and open source."',
     'content="适用于 Safari、Chrome 和 iPhone 的 Chrome 风格开发者工具。免费开源。"',
     'content="Safari、Chrome、iPhone で使える Chrome 風 DevTools。無料のオープンソース。"'),

    # ---- navigation and language menu
    ('<nav aria-label="Sections">', '<nav aria-label="栏目">', '<nav aria-label="セクション">'),
    ('<a href="#features">Features</a>', '<a href="#features">功能</a>', '<a href="#features">機能</a>'),
    ('<a href="#agents">Tests &amp; AI</a>', '<a href="#agents">测试与 AI</a>', '<a href="#agents">テストと AI</a>'),
    ('<a href="#compare">Compare</a>', '<a href="#compare">对比</a>', '<a href="#compare">比較</a>'),
    ('<a href="#install">Install</a>', '<a href="#install">安装</a>', '<a href="#install">インストール</a>'),
    ('href="#install">Get it free</a>', 'href="#install">免费获取</a>', 'href="#install">無料で入手</a>'),
    ('aria-label="Language"', 'aria-label="语言"', 'aria-label="言語"'),
    ('<span class="lang-cur">English</span>', '<span class="lang-cur">简体中文</span>', '<span class="lang-cur">日本語</span>'),
    ('<button type="button" aria-label="Close">×</button>', '<button type="button" aria-label="关闭">×</button>', '<button type="button" aria-label="閉じる">×</button>'),

    # ---- hero
    ('Free · Open source · Version 1.5', '免费 · 开源 · 版本 1.5', '無料 · オープンソース · バージョン 1.5'),
    ('</span>DevTools, inside the page.</h1>', '</span>把开发者工具，放进网页里。</h1>', '</span>DevTools を、ページの中に。</h1>'),
    ('A Chrome-style DevTools panel that runs right inside any web page, in Safari, Chrome and on your iPhone. No cable, no Xcode, no setup.',
     '一个 Chrome 风格的开发者工具面板，直接在任意网页中运行，支持 Safari、Chrome 和你的 iPhone。无需数据线、无需 Xcode、无需任何配置。',
     'Chrome 風の DevTools パネルが、どんな Web ページの中でもそのまま動きます。Safari でも Chrome でも、iPhone でも。ケーブルも Xcode も設定も不要です。'),
    ('data-tab="chrome">Add to Chrome</a>', 'data-tab="chrome">添加到 Chrome</a>', 'data-tab="chrome">Chrome に追加</a>'),
    ('data-tab="safari">Add to Safari</a>', 'data-tab="safari">添加到 Safari</a>', 'data-tab="safari">Safari に追加</a>'),
    ('id="tryIt">Try it on this page</button>', 'id="tryIt">在本页试用</button>', 'id="tryIt">このページで試す</button>'),
    ('Works in Safari, Chrome and Edge · Mac, iPhone, iPad and in-app WebViews · One file, no dependencies',
     '支持 Safari、Chrome 和 Edge · Mac、iPhone、iPad 及应用内 WebView · 单个文件，零依赖',
     'Safari、Chrome、Edge に対応 · Mac、iPhone、iPad、アプリ内 WebView · 1 ファイル、依存なし'),

    # ---- live showcase
    ('This is the real panel. Click around.', '这就是真实的面板，随便点点看。', '本物のパネルです。自由に触ってみてください。'),
    ('aria-label="Show a feature"', 'aria-label="查看功能"', 'aria-label="機能を表示"'),
    ('aria-pressed="true">Console</button>', 'aria-pressed="true">控制台</button>', 'aria-pressed="true">コンソール</button>'),
    ('aria-pressed="false">Explain with Claude</button>', 'aria-pressed="false">用 Claude 解释</button>', 'aria-pressed="false">Claude で解説</button>'),
    ('aria-pressed="false">Elements</button>', 'aria-pressed="false">元素</button>', 'aria-pressed="false">要素</button>'),
    ('aria-pressed="false">Network</button>', 'aria-pressed="false">网络</button>', 'aria-pressed="false">ネットワーク</button>'),
    ('aria-pressed="false">Accessibility</button>', 'aria-pressed="false">无障碍</button>', 'aria-pressed="false">アクセシビリティ</button>'),
    ('aria-pressed="false">Contrast</button>', 'aria-pressed="false">对比度</button>', 'aria-pressed="false">コントラスト</button>'),
    ('aria-pressed="false">Jira bug report</button>', 'aria-pressed="false">Jira 缺陷报告</button>', 'aria-pressed="false">Jira バグ報告</button>'),
    ('aria-pressed="false">Responsive</button>', 'aria-pressed="false">响应式</button>', 'aria-pressed="false">レスポンシブ</button>'),
    ('acme.shop/checkout · demo', 'acme.shop/checkout · 演示', 'acme.shop/checkout · デモ'),
    ('Loading the live demo…', '正在加载实时演示…', 'ライブデモを読み込み中…'),
    ('title="Live Safari DevTools demo in a sample shop"', 'title="示例商店中的 Safari DevTools 实时演示"', 'title="サンプルショップで動く Safari DevTools のライブデモ"'),
    ('The live demo needs a wider screen.', '实时演示需要更宽的屏幕。', 'ライブデモは広い画面向けです。'),
    ('>Open it full screen</a>', '>全屏打开</a>', '>全画面で開く</a>'),
    ('A sample shop with a deliberate bug. The Claude answer and Jira ticket are simulated here; everything else is the real tool.',
     '这是一个故意留有 bug 的示例商店。此处的 Claude 回答和 Jira 工单是模拟的，其余全部是真实工具。面板界面为英文。',
     'わざとバグを入れたサンプルショップです。Claude の回答と Jira チケットはここではシミュレーションで、それ以外はすべて本物のツールです。パネルの表示は英語です。'),

    # ---- features
    ('<div class="eyebrow">Features</div>', '<div class="eyebrow">功能</div>', '<div class="eyebrow">機能</div>'),
    ('Everything you reach for in Chrome. And more.', 'Chrome 里常用的，这里都有，而且更多。', 'Chrome でいつも使う機能を、すべて。さらにその先も。'),
    ("Sixteen panels in a single file. It looks and works like Chrome DevTools, so there's nothing new to learn.",
     '单个文件里有 16 个面板。外观和用法都和 Chrome 开发者工具一样，无需重新学习。',
     '1 つのファイルに 16 のパネル。見た目も操作も Chrome DevTools と同じなので、新しく覚えることはありません。'),
    ('<span class="tag">New in 1.4</span>', '<span class="tag">1.4 新增</span>', '<span class="tag">1.4 の新機能</span>'),
    ('<h3>Console</h3>', '<h3>控制台</h3>', '<h3>コンソール</h3>'),
    ('Logs, errors and rejections with source-mapped stack traces that point to your TypeScript. Autocomplete, <code>$0</code>, <code>copy()</code>, live expressions and real <code>console.table</code>.',
     '日志、错误和未处理的 Promise 拒绝，堆栈经过 Source Map 映射，直接指向你的 TypeScript 源码。支持自动补全、<code>$0</code>、<code>copy()</code>、实时表达式和真正的 <code>console.table</code>。',
     'ログ、エラー、未処理の reject を表示。ソースマップでスタックトレースを TypeScript の元コードに対応付けます。補完、<code>$0</code>、<code>copy()</code>、ライブ式、本物の <code>console.table</code> にも対応。'),
    ('<h3>Explain with Claude</h3>', '<h3>用 Claude 解释报错</h3>', '<h3>Claude でエラーを解説</h3>'),
    ("One click sends the error, your original source and the recent requests to Claude, and you get back the cause and a fix. You see the prompt before it's sent.",
     '一键把报错、原始源码和最近的请求发给 Claude，得到原因分析和修复代码。发送前可以先查看提示词。',
     'ワンクリックで、エラーと元のソースコード、直近のリクエストを Claude に送り、原因と修正方法を受け取れます。送信前にプロンプトを確認できます。'),
    ('<h3>Elements &amp; CSS</h3>', '<h3>元素与 CSS</h3>', '<h3>要素と CSS</h3>'),
    ('DOM tree through shadow roots, live CSS with suggestions for your <code>var(--tokens)</code>, grid and flex overlays, a measure tool, and a Changes tab that copies your edits as CSS.',
     '可深入 Shadow DOM 的 DOM 树，实时编辑 CSS 并提示你的 <code>var(--tokens)</code>，Grid 与 Flex 叠加层、测距工具，以及可把修改复制为 CSS 的 Changes 面板。',
     'Shadow DOM の中まで見える DOM ツリー、<code>var(--tokens)</code> を補完するライブ CSS 編集、Grid / Flex オーバーレイ、計測ツール、編集内容を CSS としてコピーできる Changes タブ。'),
    ('<h3>Network</h3>', '<h3>网络</h3>', '<h3>ネットワーク</h3>'),
    ('fetch, XHR, WebSocket and SSE with a waterfall. Mock, block or delay any request, throttle to 3G or offline, and export a HAR file.',
     'fetch、XHR、WebSocket 和 SSE，附带瀑布图。可模拟、拦截或延迟任意请求，限速到 3G 或离线，并导出 HAR 文件。',
     'fetch、XHR、WebSocket、SSE をウォーターフォールで表示。任意のリクエストをモック・ブロック・遅延でき、3G やオフラインへのスロットリング、HAR の書き出しも可能。'),
    ('<h3>Accessibility</h3>', '<h3>无障碍</h3>', '<h3>アクセシビリティ</h3>'),
    ('The accessibility tree as screen readers get it, a numbered tab order on the page, a focus tracker, and a contrast fixer that suggests the nearest passing colour from your tokens.',
     '以读屏软件的视角查看无障碍树，在页面上标出 Tab 键顺序，追踪焦点变化，还能从你的设计变量中推荐最接近且达标的对比度颜色。',
     'スクリーンリーダーが受け取るアクセシビリティツリー、ページ上に番号で示すタブ順、フォーカストラッカー、そしてデザイントークンから基準を満たす最も近い色を提案するコントラスト修正。'),
    ('<h3>One-click Jira bugs</h3>', '<h3>一键提交 Jira 缺陷</h3>', '<h3>ワンクリックで Jira にバグ登録</h3>'),
    ('Steps to reproduce are captured for you, with console errors, a HAR file, device info and a screenshot. Sign-in codes and tokens are blanked automatically.',
     '自动记录复现步骤，并附上控制台错误、HAR 文件、设备信息和截图。登录验证码和令牌会被自动隐藏。',
     '再現手順を自動で記録し、コンソールエラー、HAR ファイル、デバイス情報、スクリーンショットを添付。ログイン用のコードやトークンは自動で伏せられます。'),
    ('<h3>Responsive &amp; emulation</h3>', '<h3>响应式与模拟</h3>', '<h3>レスポンシブとエミュレーション</h3>'),
    ('iPhone and iPad sizes side by side with synced scrolling. Emulate dark mode, reduced motion, RTL, larger text and pseudo-localisation.',
     '并排预览 iPhone 和 iPad 尺寸，滚动同步。可模拟深色模式、减少动态效果、从右到左排版、放大文字和伪本地化。',
     'iPhone と iPad のサイズを並べて表示し、スクロールも同期。ダークモード、視差効果を減らす、RTL、大きな文字、疑似ローカライズをエミュレート。'),
    ('<h3>Snapshots &amp; coverage</h3>', '<h3>快照与覆盖率</h3>', '<h3>スナップショットとカバレッジ</h3>'),
    ('Save a component as a baseline and see every style, size and text change after an edit. Find CSS rules and design tokens that nothing uses.',
     '把组件保存为基准，修改后可看到每一处样式、尺寸和文字变化。还能找出没有被使用的 CSS 规则和设计变量。',
     'コンポーネントを基準として保存し、編集後のスタイル・サイズ・テキストの変化をすべて確認。どこからも使われていない CSS ルールやデザイントークンも見つけます。'),
    ('<h3>Components &amp; state</h3>', '<h3>组件与状态</h3>', '<h3>コンポーネントと状態</h3>'),
    ('Angular signals, Lit and React trees with editable state, plus a Redux, NgRx and Zustand action log with time travel, which Safari never had.',
     'Angular Signals、Lit 和 React 组件树，状态可直接编辑；还有支持时间旅行的 Redux、NgRx、Zustand 操作日志，这是 Safari 从未有过的。',
     'Angular の Signals、Lit、React のツリーと編集可能な状態。さらに、Safari にはなかったタイムトラベル付きの Redux / NgRx / Zustand アクションログも。'),

    # ---- iPhone
    ('Debug your iPhone from your Mac, over Wi-Fi.', '通过 Wi-Fi，在 Mac 上调试你的 iPhone。', 'Wi-Fi 経由で、Mac から iPhone をデバッグ。'),
    ("Run a tiny relay on your Mac and the phone's console and network stream straight to your desktop browser. Type JavaScript on the Mac, it runs on the phone.",
     '在 Mac 上运行一个小小的中继，手机上的控制台和网络请求就会实时出现在桌面浏览器里。在 Mac 上输入 JavaScript，就会在手机上执行。',
     'Mac で小さなリレーを動かすだけで、iPhone のコンソールとネットワークがデスクトップのブラウザに流れてきます。Mac で入力した JavaScript は iPhone 上で実行されます。'),
    ('<li>No cable, no Xcode, no pairing</li>', '<li>无需数据线、Xcode 或配对</li>', '<li>ケーブルも Xcode もペアリングも不要</li>'),
    ("<li>Works in in-app WebViews that Web Inspector can't open</li>", '<li>支持 Web 检查器打不开的应用内 WebView</li>', '<li>Web インスペクタで開けないアプリ内 WebView でも動作</li>'),
    ('<li>On the phone itself, the full panel opens with one tap</li>', '<li>在手机上也能一键打开完整面板</li>', '<li>iPhone 上でもワンタップでパネルを開けます</li>'),
    ('# on your Mac, in the cloned repo (Node 18+, nothing to install)', '# 在 Mac 上已克隆的仓库中运行（Node 18+，无需安装依赖）', '# Mac 上のクローンしたリポジトリで（Node 18 以上、インストール不要）'),
    ('# then open on the iPhone', '# 然后在 iPhone 上打开', '# 次に iPhone で開く'),
    ('# and watch on the Mac', '# 在 Mac 上查看', '# Mac で確認'),
    ('&lt;your-mac-ip&gt;', '&lt;你的 Mac IP&gt;', '&lt;Mac の IP&gt;'),
    ('type="button">Copy</button>', 'type="button">复制</button>', 'type="button">コピー</button>'),

    # ---- tests and AI agents
    ('Tests &amp; AI agents', '测试与 AI 智能体', 'テストと AI エージェント'),
    ('Built for Playwright and AI agents, too.', '也为 Playwright 和 AI 智能体而生。', 'Playwright や AI エージェントにも。'),
    ('Everything in the panel is also a JSON API. Use it from Playwright in WebKit, WebDriver for real Safari, a small HTTP API, or an MCP server, so Claude, Cursor and other agents can read and drive the page.',
     '面板里的一切也都提供 JSON API。可以在 WebKit 中通过 Playwright 使用，用 WebDriver 驱动真实的 Safari，也可以通过轻量的 HTTP API 或 MCP 服务器，让 Claude、Cursor 等智能体读取并操作页面。',
     'パネルのすべての機能は JSON API としても使えます。WebKit 上の Playwright、本物の Safari を動かす WebDriver、小さな HTTP API、そして MCP サーバー経由で、Claude や Cursor などのエージェントがページを読み取り、操作できます。'),
    ('<li>Playwright fixture with failure attachments (HAR + debug report)</li>', '<li>失败时自动附加 HAR 和调试报告的 Playwright fixture</li>', '<li>失敗時に HAR とデバッグレポートを添付する Playwright フィクスチャ</li>'),
    ('<li>MCP tools: console, network, audit, accessibility tree, snapshots, bug reports</li>', '<li>MCP 工具：控制台、网络、审查、无障碍树、快照、缺陷报告</li>', '<li>MCP ツール：コンソール、ネットワーク、監査、アクセシビリティツリー、スナップショット、バグ報告</li>'),
    ('<li>Mock, block and throttle from your tests</li>', '<li>在测试中模拟、拦截和限速请求</li>', '<li>テストからモック・ブロック・スロットリング</li>'),

    # ---- comparison
    ('<div class="eyebrow">How it compares</div>', '<div class="eyebrow">对比</div>', '<div class="eyebrow">比較</div>'),
    ("What you get that you didn't have.", '那些你以前没有的能力。', 'これまでになかったもの。'),
    ('<th scope="col">Safari Web Inspector</th>', '<th scope="col">Safari Web 检查器</th>', '<th scope="col">Safari Web インスペクタ</th>'),
    ('<td>Runs on iPhone with no Mac or cable</td>', '<td>无需 Mac 或数据线即可在 iPhone 上运行</td>', '<td>Mac もケーブルもなしで iPhone で動く</td>'),
    ('<td>Same panel in Safari and Chrome</td>', '<td>Safari 和 Chrome 中使用同一个面板</td>', '<td>Safari と Chrome で同じパネル</td>'),
    ('<td class="p">Safari only</td>', '<td class="p">仅 Safari</td>', '<td class="p">Safari のみ</td>'),
    ('<td>Source-mapped stack traces</td>', '<td>经 Source Map 映射的堆栈</td>', '<td>ソースマップ対応のスタックトレース</td>'),
    ('<td>Explain errors with Claude</td>', '<td>用 Claude 解释报错</td>', '<td>Claude でエラーを解説</td>'),
    ('<td>One-click Jira bug reports</td>', '<td>一键 Jira 缺陷报告</td>', '<td>ワンクリックで Jira バグ報告</td>'),
    ('<td>Accessibility tree, tab order, contrast fixer</td>', '<td>无障碍树、Tab 顺序、对比度修复</td>', '<td>アクセシビリティツリー、タブ順、コントラスト修正</td>'),
    ('<td class="p">Partial</td>', '<td class="p">部分</td>', '<td class="p">一部</td>'),
    ('<td>Mock, block or delay requests</td>', '<td>模拟、拦截或延迟请求</td>', '<td>リクエストのモック・ブロック・遅延</td>'),
    ('<td>Redux / NgRx time travel</td>', '<td>Redux / NgRx 时间旅行</td>', '<td>Redux / NgRx のタイムトラベル</td>'),
    ('<td>Design-token editor and coverage</td>', '<td>设计变量编辑器与覆盖率</td>', '<td>デザイントークンの編集とカバレッジ</td>'),
    ('<td>Playwright fixture and MCP server</td>', '<td>Playwright fixture 与 MCP 服务器</td>', '<td>Playwright フィクスチャと MCP サーバー</td>'),
    ('<td>Step-through JavaScript debugger</td>', '<td>逐步调试 JavaScript 的调试器</td>', '<td>JavaScript のステップ実行デバッガ</td>'),
    ("It runs inside the page, so it can't see HttpOnly cookies or pause JavaScript. For those, it hands off to the browser's own tools.",
     '它运行在页面内部，所以看不到 HttpOnly Cookie，也无法暂停 JavaScript。这些场景请使用浏览器自带的工具。',
     'ページの中で動くため、HttpOnly Cookie の参照や JavaScript の一時停止はできません。その場合はブラウザ標準のツールを使ってください。'),

    # ---- install
    ('<div class="eyebrow">Install</div>', '<div class="eyebrow">安装</div>', '<div class="eyebrow">インストール</div>'),
    ('Get it in a minute.', '一分钟即可上手。', '1 分で導入。'),
    ('aria-label="Install options"', 'aria-label="安装方式"', 'aria-label="インストール方法"'),
    ('aria-selected="false">Bookmarklet</button>', 'aria-selected="false">书签小工具</button>', 'aria-selected="false">ブックマークレット</button>'),
    ('aria-selected="false">Your own app</button>', 'aria-selected="false">你自己的应用</button>', 'aria-selected="false">自分のアプリ</button>'),
    ('<li>Download the extension and unzip it.</li>', '<li>下载扩展并解压。</li>', '<li>拡張機能をダウンロードして解凍します。</li>'),
    ('<li>Open <b>chrome://extensions</b> (or edge://extensions) and turn on <b>Developer mode</b>.</li>',
     '<li>打开 <b>chrome://extensions</b>（或 edge://extensions），开启<b>开发者模式</b>。</li>',
     '<li><b>chrome://extensions</b>（または edge://extensions）を開き、<b>デベロッパー モード</b>をオンにします。</li>'),
    ('<li>Click <b>Load unpacked</b> and choose the <b>safari-devtools-chrome</b> folder.</li>',
     '<li>点击<b>加载已解压的扩展程序</b>，选择 <b>safari-devtools-chrome</b> 文件夹。</li>',
     '<li><b>パッケージ化されていない拡張機能を読み込む</b>をクリックし、<b>safari-devtools-chrome</b> フォルダを選びます。</li>'),
    ('<li>Open any site and press ', '<li>打开任意网站，按 ', '<li>どのサイトでも '),
    ('<span class="kbd">D</span> or click the icon.</li>', '<span class="kbd">D</span>，或点击扩展图标。</li>', '<span class="kbd">D</span> を押すか、アイコンをクリックします。</li>'),
    ('>Download for Chrome</a>', '>下载 Chrome 版</a>', '>Chrome 版をダウンロード</a>'),
    ('>View source</a>', '>查看源码</a>', '>ソースを見る</a>'),
    ('<li>In Safari, open <b>Settings → Advanced</b> and turn on <b>Show features for web developers</b>.</li>',
     '<li>在 Safari 中打开<b>设置 → 高级</b>，开启<b>显示网页开发者功能</b>。</li>',
     '<li>Safari で<b>設定 → 詳細</b>を開き、<b>Web デベロッパ用の機能を表示</b>をオンにします。</li>'),
    ('<li>Open <b>Settings → Developer</b>, click <b>Add Temporary Extension…</b> and choose the <b>safari-devtools-extension</b> folder.</li>',
     '<li>打开<b>设置 → 开发者</b>，点击<b>添加临时扩展…</b>，选择 <b>safari-devtools-extension</b> 文件夹。</li>',
     '<li><b>設定 → デベロッパ</b>を開き、<b>一時的な拡張機能を追加…</b>をクリックして <b>safari-devtools-extension</b> フォルダを選びます。</li>'),
    ('<li>Allow it on websites, then press ', '<li>允许它在网站上运行，然后在任意页面按 ', '<li>Web サイトでの実行を許可し、どのページでも '),
    ('<span class="kbd">D</span> on any page.</li>', '<span class="kbd">D</span>。</li>', '<span class="kbd">D</span> を押します。</li>'),
    ('Temporary extensions are removed when Safari quits. To keep it installed, build it once with Xcode using the script in the folder.',
     '临时扩展会在退出 Safari 时被移除。如需长期安装，请使用文件夹中的脚本用 Xcode 构建一次。',
     '一時的な拡張機能は Safari を終了すると削除されます。インストールしたままにするには、フォルダ内のスクリプトで一度 Xcode でビルドしてください。'),
    ('>Download for Safari</a>', '>下载 Safari 版</a>', '>Safari 版をダウンロード</a>'),
    ("No install, and it works where extensions aren't allowed. Drag this to your bookmarks bar, then click it on any page.",
     '无需安装，在不允许使用扩展的环境中也能用。把它拖到书签栏，然后在任意页面点击即可。',
     'インストール不要で、拡張機能が使えない環境でも動きます。ブックマークバーにドラッグして、どのページでもクリックするだけ。'),
    ('title="Drag me to your bookmarks bar"', 'title="把我拖到书签栏"', 'title="ブックマークバーにドラッグ"'),
    ('On iPhone: bookmark any page, then edit the bookmark and paste the code below as its address.',
     '在 iPhone 上：先把任意页面加入书签，再编辑该书签，把下面的代码粘贴为网址。',
     'iPhone の場合：任意のページをブックマークし、そのブックマークを編集してアドレスに下のコードを貼り付けます。'),
    ('Add one line as the first thing in <code>&lt;head&gt;</code> of your development build. It captures every log and request from the first line.',
     '在开发版本的 <code>&lt;head&gt;</code> 最前面加入一行，从第一行代码起就能捕获所有日志和请求。',
     '開発ビルドの <code>&lt;head&gt;</code> の先頭に 1 行追加するだけ。最初の 1 行目からすべてのログとリクエストを記録します。'),

    # ---- video
    ('<div class="eyebrow">Demo</div>', '<div class="eyebrow">演示</div>', '<div class="eyebrow">デモ</div>'),
    ('See it in one minute.', '一分钟看懂。', '1 分でわかる。'),
    ("Your browser can't play this video.", '你的浏览器无法播放此视频。', 'お使いのブラウザではこの動画を再生できません。'),
    ('>Download it</a>', '>下载视频</a>', '>ダウンロード</a>'),

    # ---- who it's for
    ("<div class=\"eyebrow\">Who it's for</div>", '<div class="eyebrow">适合谁</div>', '<div class="eyebrow">こんな人に</div>'),
    ('One tool, a lot of jobs.', '一个工具，多种用途。', 'ひとつのツールで、いろいろな仕事を。'),
    ('<b>Front-end developers</b>', '<b>前端开发者</b>', '<b>フロントエンド開発者</b>'),
    ('Safari-only bugs, iPhone layouts, web components and shadow DOM.', '只在 Safari 出现的 bug、iPhone 布局、Web Components 和 Shadow DOM。', 'Safari だけのバグ、iPhone のレイアウト、Web Components と Shadow DOM。'),
    ('Bug reports with steps, errors, HAR and device info, filed in Jira.', '带有步骤、错误、HAR 和设备信息的缺陷报告，直接提交到 Jira。', '手順・エラー・HAR・デバイス情報付きのバグ報告を Jira に登録。'),
    ('<b>Designers</b>', '<b>设计师</b>', '<b>デザイナー</b>'),
    ('Live token edits, grid overlays, a measure tool and design overlays.', '实时修改设计变量、Grid 叠加层、测距工具和设计稿叠加对比。', 'トークンのライブ編集、グリッドのオーバーレイ、計測ツール、デザインの重ね合わせ。'),
    ('<b>Accessibility</b>', '<b>无障碍</b>', '<b>アクセシビリティ</b>'),
    ('Screen-reader tree, tab order, focus traps and contrast fixes.', '读屏树、Tab 顺序、焦点陷阱和对比度修复。', 'スクリーンリーダー用ツリー、タブ順、フォーカストラップ、コントラスト修正。'),
    ('<b>Test automation</b>', '<b>自动化测试</b>', '<b>テスト自動化</b>'),
    ('Playwright in WebKit, WebDriver for real Safari, network mocks.', 'WebKit 中的 Playwright、驱动真实 Safari 的 WebDriver、网络模拟。', 'WebKit での Playwright、本物の Safari を動かす WebDriver、ネットワークのモック。'),
    ('<b>AI agents</b>', '<b>AI 智能体</b>', '<b>AI エージェント</b>'),
    ('An MCP server so Claude, Cursor and others can inspect live pages.', '提供 MCP 服务器，让 Claude、Cursor 等检查实时页面。', 'MCP サーバーで、Claude や Cursor などが実際のページを調べられます。'),

    # ---- FAQ
    ('<h2 id="faq-title" class="center">Questions</h2>', '<h2 id="faq-title" class="center">常见问题</h2>', '<h2 id="faq-title" class="center">よくある質問</h2>'),
    ('<summary>How do I see console logs on an iPhone without a Mac?</summary>', '<summary>没有 Mac，怎么查看 iPhone 上的控制台日志？</summary>', '<summary>Mac なしで iPhone のコンソールログを見るには？</summary>'),
    ("Load Safari DevTools on the page with the bookmarklet or a script tag, and the full console opens right on the phone. Or start remote mode and watch the phone's console and network from any computer on the same Wi-Fi.",
     '用书签小工具或 script 标签在页面上加载 Safari DevTools，完整的控制台就会直接在手机上打开。也可以启动远程模式，在同一 Wi-Fi 下的任意电脑上查看手机的控制台和网络请求。',
     'ブックマークレットか script タグでページに Safari DevTools を読み込めば、iPhone 上でそのままコンソールが開きます。リモートモードを使えば、同じ Wi-Fi のどのパソコンからでも iPhone のコンソールとネットワークを確認できます。'),
    ('<summary>Is it an alternative to Eruda or vConsole?</summary>', '<summary>它能替代 Eruda 或 vConsole 吗？</summary>', '<summary>Eruda や vConsole の代わりになりますか？</summary>'),
    ('Yes. Like them it runs inside the page, but it also maps errors to your original source, mocks and throttles requests, checks accessibility, time-travels Redux and NgRx state, and looks like Chrome DevTools.',
     '可以。它和它们一样运行在页面内部，但还能把报错映射到原始源码、模拟和限速请求、检查无障碍、对 Redux 和 NgRx 状态进行时间旅行，而且外观和 Chrome 开发者工具一样。',
     'はい。同じくページの中で動きますが、エラーを元のソースに対応付け、リクエストのモックやスロットリング、アクセシビリティのチェック、Redux / NgRx の状態のタイムトラベルもでき、見た目は Chrome DevTools と同じです。'),
    ('<summary>Is it really free?</summary>', '<summary>真的免费吗？</summary>', '<summary>本当に無料ですか？</summary>'),
    ("Yes. It's open source under the MIT licence. Use it at work, change it, ship it.",
     '是的。它基于 MIT 许可证开源，可以在工作中使用、修改和发布。',
     'はい。MIT ライセンスのオープンソースです。仕事で使うのも、改変して配布するのも自由です。'),
    ('<summary>Does it send my data anywhere?</summary>', '<summary>它会把我的数据发送到别处吗？</summary>', '<summary>データはどこかに送信されますか？</summary>'),
    ('No. Everything stays in the page. "Explain with Claude" and Jira reports only run through a relay you start on your own machine, with your own keys, and you see the prompt before anything is sent. Sign-in codes and tokens are blanked first.',
     '不会。所有内容都留在页面中。“用 Claude 解释”和 Jira 报告只会通过你在自己电脑上启动的中继、使用你自己的密钥运行，发送前你能看到提示词。登录验证码和令牌会先被隐藏。',
     'いいえ。すべてページ内にとどまります。「Claude で解説」と Jira 報告は、あなたが自分のマシンで起動したリレーと自分のキーを通してのみ動作し、送信前にプロンプトを確認できます。ログイン用コードやトークンは事前に伏せられます。'),
    ('<summary>Does it work on iPhone and iPad?</summary>', '<summary>支持 iPhone 和 iPad 吗？</summary>', '<summary>iPhone や iPad でも使えますか？</summary>'),
    ('Yes, in Safari and in in-app WebViews. Load it with the script tag or the bookmarklet, or stream it to your Mac with remote mode.',
     '支持，Safari 和应用内 WebView 都可以。通过 script 标签或书签小工具加载，或用远程模式把它显示在 Mac 上。',
     'はい。Safari でもアプリ内 WebView でも使えます。script タグかブックマークレットで読み込むか、リモートモードで Mac に表示できます。'),
    ("<summary>Why not just use Safari's Web Inspector?</summary>", '<summary>为什么不直接用 Safari 的 Web 检查器？</summary>', '<summary>Safari の Web インスペクタではだめなのですか？</summary>'),
    ("Web Inspector needs a Mac, a cable or pairing, and doesn't open most in-app WebViews. Safari DevTools runs in the page itself, looks like Chrome DevTools and adds things Safari doesn't have, like Redux time travel, an accessibility toolkit and AI explanations.",
     'Web 检查器需要 Mac、数据线或配对，而且打不开大多数应用内 WebView。Safari DevTools 直接运行在页面里，外观和 Chrome 开发者工具一样，还提供了 Safari 没有的功能，比如 Redux 时间旅行、无障碍工具和 AI 解释。',
     'Web インスペクタには Mac とケーブルまたはペアリングが必要で、多くのアプリ内 WebView は開けません。Safari DevTools はページの中で動き、見た目は Chrome DevTools と同じ。さらに Redux のタイムトラベル、アクセシビリティツール、AI による解説など、Safari にない機能があります。'),
    ("<summary>What can't it do?</summary>", '<summary>它做不到什么？</summary>', '<summary>できないことは？</summary>'),
    ("It runs inside the page, so it can't pause JavaScript at breakpoints, see HttpOnly cookies or browser-added headers, or read cross-origin stylesheets. Use the browser's own tools for those.",
     '它运行在页面内部，所以无法在断点处暂停 JavaScript，看不到 HttpOnly Cookie 或浏览器自动添加的请求头，也读不了跨域样式表。这些请使用浏览器自带的工具。',
     'ページの中で動くため、ブレークポイントでの JavaScript の一時停止、HttpOnly Cookie やブラウザが付けるヘッダーの参照、クロスオリジンのスタイルシートの読み取りはできません。これらはブラウザ標準のツールを使ってください。'),
    ('<summary>My company blocks extensions. Can I still use it?</summary>', '<summary>公司禁止安装扩展，还能用吗？</summary>', '<summary>会社で拡張機能が禁止されています。それでも使えますか？</summary>'),
    ("Usually, yes. The bookmarklet and the script tag aren't extensions, so extension policies don't apply to them.",
     '通常可以。书签小工具和 script 标签都不是扩展，扩展相关的策略对它们不适用。',
     'たいていは使えます。ブックマークレットと script タグは拡張機能ではないため、拡張機能のポリシーは適用されません。'),


    # ---- site footer (links go to the English articles)
    ('<nav class="fcol" aria-label="Product"><h2>Product</h2>', '<nav class="fcol" aria-label="产品"><h2>产品</h2>', '<nav class="fcol" aria-label="製品"><h2>製品</h2>'),
    ('<nav class="fcol" aria-label="Compare"><h2>Compare</h2>', '<nav class="fcol" aria-label="对比"><h2>对比</h2>', '<nav class="fcol" aria-label="比較"><h2>比較</h2>'),
    ('<nav class="fcol" aria-label="Learn"><h2>Learn</h2>', '<nav class="fcol" aria-label="学习"><h2>学习</h2>', '<nav class="fcol" aria-label="学ぶ"><h2>学ぶ</h2>'),
    ('<nav class="fcol" aria-label="Support"><h2>Support</h2>', '<nav class="fcol" aria-label="支持"><h2>支持</h2>', '<nav class="fcol" aria-label="サポート"><h2>サポート</h2>'),
    ('<a href="/#demo">Live demo</a>', '<a href="/#demo">实时演示</a>', '<a href="/#demo">ライブデモ</a>'),
    ('<a href="/#features">Features</a>', '<a href="/#features">功能</a>', '<a href="/#features">機能</a>'),
    ('<a href="/#install">Install</a>', '<a href="/#install">安装</a>', '<a href="/#install">インストール</a>'),
    ('<a href="/#faq">FAQ</a>', '<a href="/#faq">常见问题</a>', '<a href="/#faq">よくある質問</a>'),
    ('#whats-new">Changelog</a>', '#whats-new">更新日志</a>', '#whats-new">変更履歴</a>'),
    ('>vs Safari Web Inspector</a>', '>对比 Safari Web 检查器</a>', '>Safari Web インスペクタとの比較</a>'),
    ('>vs Eruda</a>', '>对比 Eruda</a>', '>Eruda との比較</a>'),
    ('>vs vConsole</a>', '>对比 vConsole</a>', '>vConsole との比較</a>'),
    ('>vs Chrome DevTools</a>', '>对比 Chrome 开发者工具</a>', '>Chrome DevTools との比較</a>'),
    ('>Eruda alternatives</a>', '>Eruda 替代方案</a>', '>Eruda の代替ツール</a>'),
    ('>iPhone console without a Mac</a>', '>无需 Mac 查看 iPhone 控制台</a>', '>Mac なしで iPhone のコンソール</a>'),
    ('>Debug Safari on iPhone</a>', '>在 iPhone 上调试 Safari</a>', '>iPhone の Safari をデバッグ</a>'),
    ('>Debug iOS WebViews</a>', '>调试 iOS WebView</a>', '>iOS の WebView をデバッグ</a>'),
    ('>Mock APIs in the browser</a>', '>在浏览器中模拟 API</a>', '>ブラウザで API をモック</a>'),
    ('>Accessibility testing in Safari</a>', '>在 Safari 中测试无障碍</a>', '>Safari でアクセシビリティテスト</a>'),
    ('>Redux DevTools in Safari</a>', '>Safari 中的 Redux DevTools</a>', '>Safari で Redux DevTools</a>'),
    ('>Safari-only CSS bugs</a>', '>Safari 特有的 CSS 问题</a>', '>Safari 特有の CSS バグ</a>'),
    ('>Shadow DOM in Safari</a>', '>Safari 中的 Shadow DOM</a>', '>Safari で Shadow DOM</a>'),
    ('>Install on Chrome</a>', '>在 Chrome 中安装</a>', '>Chrome にインストール</a>'),
    ('>Install on Safari</a>', '>在 Safari 中安装</a>', '>Safari にインストール</a>'),
    ('>iPhone remote mode</a>', '>iPhone 远程模式</a>', '>iPhone のリモートモード</a>'),
    ('>Claude &amp; Jira setup</a>', '>Claude 与 Jira 设置</a>', '>Claude と Jira の設定</a>'),
    ('>Privacy</a>', '>隐私</a>', '>プライバシー</a>'),
    ('<p>Chrome-style DevTools inside any page, for Safari, Chrome and iPhone. Free and open source.</p>', '<p>在任意网页中运行的 Chrome 风格开发者工具，适用于 Safari、Chrome 和 iPhone。免费开源。</p>', '<p>Safari、Chrome、iPhone のどんなページでも動く Chrome 風 DevTools。無料のオープンソース。</p>'),
    ('</svg>Star on GitHub</a>', '</svg>在 GitHub 上加星</a>', '</svg>GitHub でスター</a>'),
    # ---- footer bottom line
    ('Safari DevTools · MIT licence · Made by Birat Datta', 'Safari DevTools · MIT 许可证 · 由 Birat Datta 制作', 'Safari DevTools · MIT ライセンス · 制作：Birat Datta'),
    ('>Report an issue</a>', '>反馈问题</a>', '>問題を報告</a>'),

    # ---- messages shown by the page's script
    ("say('Opened at the bottom of the page')", "say('已在页面底部打开')", "say('ページの下部に開きました')"),
    ("say('Could not load the tool')", "say('无法加载工具')", "say('ツールを読み込めませんでした')"),
    ("say('Drag this to your bookmarks bar')", "say('把它拖到书签栏')", "say('ブックマークバーにドラッグしてください')"),
    ("say('Copied')", "say('已复制')", "say('コピーしました')"),
    ("say('Press ⌘C to copy')", "say('按 ⌘C 复制')", "say('⌘C でコピー')"),
    ("alert('This site blocks outside scripts, so Safari DevTools could not load here.')",
     "alert('此网站禁止加载外部脚本，因此无法在这里加载 Safari DevTools。')",
     "alert('このサイトは外部スクリプトをブロックしているため、Safari DevTools を読み込めませんでした。')"),
    ("console.log('Hi! This is Safari DevTools running on this page. Try the Elements tab, or type 1 + 1 below.')",
     "console.log('你好！这是运行在本页上的 Safari DevTools。试试 Elements 标签页，或在下方输入 1 + 1。')",
     "console.log('こんにちは！このページで動いている Safari DevTools です。Elements タブを開くか、下に 1 + 1 と入力してみてください。')"),
]


import json
import re
import datetime

VERSION = '1.5.2'
REPO = 'https://github.com/biratdatta/safari-devtools'
OG_LOCALE = {'en': 'en_US', 'zh': 'zh_CN', 'ja': 'ja_JP'}
IN_LANGUAGE = {'en': 'en', 'zh': 'zh-Hans', 'ja': 'ja'}


def site_url(src):
    m = re.search(r'<link rel="canonical" href="(https?://[^"]+?)/?">', src)
    if not m:
        sys.exit('site/index.html needs <link rel="canonical" href="https://your-site/">')
    return m.group(1).rstrip('/')


def structured_data(page, lang, base):
    """JSON-LD from the page itself, so it always matches what visitors see in that language."""
    def meta(name):
        m = re.search(r'<meta name="%s" content="([^"]*)">' % name, page)
        return m.group(1) if m else ''
    def text(html):
        t = re.sub(r'<[^>]+>', '', html)
        return t.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').strip()
    url = base + ('/' if lang == 'en' else '/%s/' % lang)
    faq = [{'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': text(a)}}
           for q, a in re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', page)]
    graph = [
        {'@type': 'WebSite', '@id': base + '/#website', 'url': base + '/', 'name': 'Safari DevTools',
         'inLanguage': ['en', 'zh-Hans', 'ja']},
        {'@type': 'SoftwareApplication', '@id': base + '/#app', 'name': 'Safari DevTools', 'url': url,
         'description': meta('description'), 'applicationCategory': 'DeveloperApplication',
         'operatingSystem': 'macOS, iOS, iPadOS, Windows, Linux, Android', 'softwareVersion': VERSION,
         'isAccessibleForFree': True, 'license': REPO + '/blob/main/LICENSE',
         'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
         'downloadUrl': base + '/#install', 'image': base + '/og.jpg', 'screenshot': base + '/og.jpg',
         'author': {'@type': 'Person', 'name': 'Birat Datta', 'url': 'https://github.com/biratdatta'},
         'sameAs': [REPO], 'inLanguage': IN_LANGUAGE[lang]},
    ]
    if faq:
        graph.append({'@type': 'FAQPage', '@id': url + '#faq', 'inLanguage': IN_LANGUAGE[lang], 'mainEntity': faq})
    data = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, indent=1)
    return '<!--ld:start--><script type="application/ld+json">\n' + data.replace('</', '<\\/') + '\n</script><!--ld:end-->'


def with_ld(page, lang, base):
    return re.sub(r'<!--ld:start-->[\s\S]*?<!--ld:end-->', lambda m: structured_data(page, lang, base), page)


def build():
    src_path = os.path.join(SITE, 'index.html')
    src = open(src_path, encoding='utf-8').read()

    # --site-url https://example.com : switch every absolute URL (and the sitemap) to a new domain.
    if '--site-url' in sys.argv:
        new = sys.argv[sys.argv.index('--site-url') + 1].rstrip('/')
        src = src.replace(site_url(src), new)
    base = site_url(src)
    src = re.sub(r'<!--footer:start-->[\s\S]*?<!--footer:end-->', lambda m: '<!--footer:start-->' + pages.FOOTER + '<!--footer:end-->', src)

    missing = [en for en, _, _ in STRINGS if en not in src]
    if missing:
        print('These English pieces are no longer on site/index.html. Update site/i18n/build.py:\n')
        for m in missing:
            print('  - ' + (m if len(m) < 110 else m[:107] + '...'))
        sys.exit(1)

    # English page: refresh its structured data in place.
    src = with_ld(src, 'en', base)
    with open(src_path, 'w', encoding='utf-8') as f:
        f.write(src)
    print('Updated site/index.html  (canonical %s/)' % base)

    for col, (code, meta) in enumerate(LANGS.items(), start=1):
        out = src
        for row in STRINGS:
            out = out.replace(row[0], row[col])
        # This page's own address.
        out = out.replace('<link rel="canonical" href="%s/">' % base, '<link rel="canonical" href="%s/%s/">' % (base, meta['dir']))
        out = out.replace('<meta property="og:url" content="%s/">' % base, '<meta property="og:url" content="%s/%s/">' % (base, meta['dir']))
        # The language menu: mark this language as the current page.
        out = out.replace('data-lang="en" aria-current="page"', 'data-lang="en"')
        out = out.replace('data-lang="%s">' % code, 'data-lang="%s" aria-current="page">' % code)
        out = with_ld(out, code, base)
        target = os.path.join(SITE, meta['dir'], 'index.html')
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as f:
            f.write(out)
        left = [w for w in ('Get it free', 'Install', 'Features', 'Questions') if ('>' + w + '<') in out]
        print('Built %-22s %s' % (os.path.relpath(target, os.path.dirname(SITE)), ('(still English: ' + ', '.join(left) + ')') if left else ''))

    # Articles, comparisons and guides (English).
    articles = pages.write_all(SITE, base)
    print('Wrote %d article and hub pages' % len(articles))

    # Sitemap with language alternates, and robots.txt pointing to it.
    today = datetime.date.today().isoformat()
    langs = [('en', base + '/'), ('zh-Hans', base + '/zh/'), ('ja', base + '/ja/')]
    alts = ''.join('    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>\n' % (h, u) for h, u in langs) + \
        '    <xhtml:link rel="alternate" hreflang="x-default" href="%s/"/>\n' % base
    urls = ''.join('  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n%s  </url>\n' % (u, today, alts) for _, u in langs)
    urls += ''.join('  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n  </url>\n' % (a[0], pages.UPDATED) for a in articles)
    with open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + urls + '</urlset>\n')
    with open(os.path.join(SITE, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write('User-agent: *\nAllow: /\nDisallow: /demo/\n\nSitemap: %s/sitemap.xml\n' % base)
    print('Wrote site/sitemap.xml and site/robots.txt')
    write_llms(base, articles)


LLMS = """# Safari DevTools

> Free, open-source (MIT) Chrome-style DevTools panel that runs inside any web page, in Safari, Chrome, Edge and on iPhone/iPad (including in-app WebViews). One dependency-free JavaScript file, plus browser extensions for Safari and Chrome. Current version: {version}.

Safari DevTools gives Safari and iOS the debugging tools developers expect from Chrome DevTools, without a Mac, cable or Xcode. It is loaded into a page by a browser extension, a bookmarklet or a `<script>` tag, and shows a docked panel with: Console (source-mapped stack traces, autocomplete, live expressions, console.table), Elements (DOM through shadow roots, live CSS with design-token suggestions, grid/flex overlays, measure tool, Changes tab), Sources, Network (fetch/XHR/WebSocket/SSE, mock/block/delay rules, 3G/offline throttling, HAR export), Storage, Components (Angular signals, Lit, React; Redux/NgRx/Zustand time travel), Issues, Performance, Tokens, Assets, Audit, Accessibility (accessibility tree, tab-order overlay, focus tracker, contrast fixer using design tokens), Coverage (unused CSS and tokens), Snapshots (visual regression for components) and Device (emulation of dark mode, reduced motion, RTL, text size, pseudo-localisation; side-by-side iPhone/iPad preview).

It also has "Explain with Claude" for errors and one-click Jira bug reports (both run through a local relay with the user's own keys; sign-in codes and tokens are redacted), remote mode to stream an iPhone's console and network to a Mac over Wi-Fi, and an automation API exposed to Playwright, WebDriver, an HTTP API and an MCP server for AI agents.

Key facts:
- Install: Chrome/Edge extension (load unpacked), Safari extension (Add Temporary Extension, or build with Xcode), bookmarklet, or `<script src="https://cdn.jsdelivr.net/gh/biratdatta/safari-devtools@v{version}/standalone/safari-devtools.js"></script>`.
- Shortcuts: Ctrl+Shift+D or Alt+Shift+D toggles the panel; Ctrl+Shift+C or Alt+Shift+C picks an element; Ctrl+Shift+P opens the command palette.
- JavaScript API: `window.SafariDevTools` (show, hide, toggle, inspect) and `window.SafariDevTools.automation` (JSON methods such as logs, errors, network, har, mock, block, throttle, audit, a11yTree, tabOrder, contrast, coverage, emulate, snapshot, compareSnapshot, bugReport; call `help()` for the full list).
- Limits: it runs inside the page, so it cannot pause JavaScript at breakpoints, see HttpOnly cookies or browser-added headers, or read cross-origin stylesheets.
- Privacy: nothing leaves the page unless the user starts the optional relay for Claude or Jira.
- Languages of the website: English, Simplified Chinese ({base}/zh/), Japanese ({base}/ja/).

## Docs

- [Website]({base}/): overview, live demo, install steps, comparison and FAQ
- [Full documentation for LLMs]({base}/llms-full.txt): all READMEs in one Markdown file
- [Project README]({repo}/blob/main/README.md): features, comparison with Safari Web Inspector and Eruda/vConsole, changelog
- [Tool guide]({repo}/blob/main/standalone/README.md): every panel, remote mode, Claude and Jira setup, automation, shortcuts, limits
- [Bookmarklet]({repo}/blob/main/standalone/bookmarklet.md): use it where extensions are not allowed
- [Chrome extension]({repo}/blob/main/chrome-extension/README.md): install and troubleshooting for Chrome and Edge
- [Safari extension]({repo}/blob/main/extension/README.md): install with Safari or Xcode

## Automation and AI agents

- [Playwright fixture]({repo}/blob/main/standalone/playwright/safari-devtools.fixture.ts): typed `devtools` fixture for WebKit and Chromium tests
- [MCP server]({repo}/blob/main/standalone/remote/mcp.js): tools such as get_console, get_network, run_js, audit_page, inspect_element, mock_request, accessibility_tree, check_contrast, css_coverage, emulate, compare_snapshot, bug_report, explain_error_context
- [Relay and HTTP API]({repo}/blob/main/standalone/remote/relay.js): /api/devices, /api/logs, /api/network, /api/eval, /api/call; optional /ai/explain and /jira/create

## Optional

- [Source code]({repo}): GitHub repository
- [The tool itself]({base}/safari-devtools.js): the single JavaScript file
- [Licence]({repo}/blob/main/LICENSE): MIT
"""

FULL_SOURCES = [
    ('README.md', 'Project overview'),
    ('standalone/README.md', 'Tool guide'),
    ('standalone/bookmarklet.md', 'Bookmarklet'),
    ('chrome-extension/README.md', 'Chrome extension'),
    ('extension/README.md', 'Safari extension'),
]


def write_llms(base, articles=()):
    """llms.txt (a map for AI assistants) and llms-full.txt (all docs in one file), see llmstxt.org."""
    repo_root = os.path.dirname(SITE)
    llms = LLMS.format(base=base, repo=REPO, version=VERSION)
    names = {'compare': 'Comparisons', 'learn': 'Guides and how-tos', 'guides': 'Setup'}
    for key, title in names.items():
        rows = [a for a in articles if a[3] == key]
        if rows:
            llms = llms.replace('\n## Optional\n', '\n## %s\n\n%s\n\n## Optional\n' % (title, '\n'.join('- [%s](%s): %s' % (t, u, d) for u, t, d, _ in rows)), 1)
    with open(os.path.join(SITE, 'llms.txt'), 'w', encoding='utf-8') as f:
        f.write(llms)
    parts = [llms.split('\n## Docs')[0].rstrip() + '\n']
    for path, title in FULL_SOURCES:
        full = os.path.join(repo_root, path)
        if not os.path.exists(full):
            continue
        md = open(full, encoding='utf-8').read()
        md = re.sub(r'<p align="center">[\s\S]*?</p>\s*', '', md)          # badges and hero images
        md = re.sub(r'<table>[\s\S]*?</table>\s*', '', md)                  # screenshot grids
        md = re.sub(r'!\[[^\]]*\]\([^)]*\)\s*', '', md)                     # inline images
        md = re.sub(r'\]\((?!https?://|#|mailto:)([^)]+)\)', lambda m: '](%s/blob/main/%s)' % (REPO, os.path.normpath(os.path.join(os.path.dirname(path), m.group(1))).replace(os.sep, '/')), md)
        md = re.sub(r'^(#{1,5}) ', lambda m: '#' + m.group(1) + ' ', md, flags=re.M)  # nest under the file heading
        parts.append('\n---\n\n# %s\n\nSource: %s/blob/main/%s\n\n%s' % (title, REPO, path, md.strip() + '\n'))
    with open(os.path.join(SITE, 'llms-full.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(parts))
    print('Wrote site/llms.txt and site/llms-full.txt')


if __name__ == '__main__':
    build()
