#!/usr/bin/env python3
"""
Builds the translated pages of the website from the English one:

    site/index.html  ->  site/zh/index.html   (Simplified Chinese)
                     ->  site/ja/index.html   (Japanese)

Run it after changing site/index.html:   python3 site/i18n/build.py
(./sync.sh runs it for you.)

Each entry below is an exact piece of the English page and its translations. If a piece is no longer found
on the English page, the build stops and says which one, so translations never silently go stale.
To add a language, add a column to STRINGS and an entry to LANGS.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)

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
    ('content="A free, open-source, Chrome-style DevTools panel that runs inside the page, in Safari, Chrome and on iPhone. Explain errors with Claude, file Jira bugs in one click, check accessibility, mock APIs."',
     'content="免费开源、Chrome 风格的开发者工具面板，直接运行在网页中，支持 Safari、Chrome 和 iPhone。用 Claude 解释报错，一键提交 Jira 缺陷，检查无障碍，模拟 API。"',
     'content="無料・オープンソースの Chrome 風 DevTools パネル。ページの中で動き、Safari、Chrome、iPhone に対応。Claude でエラーを解説、Jira へのバグ登録はワンクリック、アクセシビリティのチェックや API のモックも。"'),
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
    ('<h1>DevTools, inside the page.</h1>', '<h1>把开发者工具，放进网页里。</h1>', '<h1>DevTools を、ページの中に。</h1>'),
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

    # ---- footer
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


def build():
    src_path = os.path.join(SITE, 'index.html')
    src = open(src_path, encoding='utf-8').read()
    missing = [en for en, _, _ in STRINGS if en not in src]
    if missing:
        print('These English pieces are no longer on site/index.html. Update site/i18n/build.py:\n')
        for m in missing:
            print('  - ' + (m if len(m) < 110 else m[:107] + '...'))
        sys.exit(1)
    for col, (code, meta) in enumerate(LANGS.items(), start=1):
        out = src
        for row in STRINGS:
            out = out.replace(row[0], row[col])
        # The language menu: mark this language as the current page.
        out = out.replace('data-lang="en" aria-current="page"', 'data-lang="en"')
        out = out.replace('data-lang="%s">' % code, 'data-lang="%s" aria-current="page">' % code)
        target = os.path.join(SITE, meta['dir'], 'index.html')
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as f:
            f.write(out)
        left = [w for w in ('Get it free', 'Install', 'Features', 'Questions') if ('>' + w + '<') in out]
        print('Built %-22s %s' % (os.path.relpath(target, os.path.dirname(SITE)), ('(still English: ' + ', '.join(left) + ')') if left else ''))


if __name__ == '__main__':
    build()
