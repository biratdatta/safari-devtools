/*!
 * Safari DevTools \u2014 a Chrome-style, in-page DevTools panel.
 * Console \u00b7 Elements/CSS \u00b7 Network \u00b7 Storage
 * Drop-in: add a script tag pointing at this file (load it first in the head
 * to capture every log and request), or inject it with a bookmarklet.
 * Shortcuts: Ctrl+Shift+D toggle panel \u00b7 Ctrl+Shift+C inspect element
 * MIT License.
 */
(function () {
  'use strict';
  if (window.__SDT__) {
    // Already running (e.g. page includes it and the extension injects it too).
    var cs = document.currentScript;
    if (!(cs && cs.dataset && cs.dataset.source === 'extension')) window.__SDT__.show();
    document.dispatchEvent(new CustomEvent('sdt:pong'));
    return;
  }

  var currentScript = document.currentScript;
  var scriptSrc = (currentScript && currentScript.src) || '';
  var cfg = (currentScript && currentScript.dataset) || {};

  var MAX_LOGS = 2000, MAX_NET = 1000, MAX_BODY = 1024 * 1024, MAX_PROPS = 400;
  var UI_KEY = '__sdt_ui';

  var state = {
    open: false, tab: 'console', height: 340,
    logs: [], net: [], errors: 0, warns: 0,
    selected: null, expanded: new WeakSet(),
    netSel: null, netFilter: '', netType: 'All', netDetailTab: 'Headers',
    conFilter: '', conLevels: { verbose: false, info: true, warn: true, error: true },
    storeKind: 'local', storeFilter: '', storeSel: null,
    sideTab: 'Styles', computedFilter: '',
    history: [], histIdx: -1, picking: false
  };
  try {
    var saved = JSON.parse(sessionStorage.getItem(UI_KEY) || 'null');
    if (saved) { state.open = !!saved.open; state.tab = saved.tab || state.tab; state.height = saved.height || state.height; }
  } catch (e) { /* storage unavailable */ }
  if (cfg.open === 'true') state.open = true;

  function saveUI() {
    try { sessionStorage.setItem(UI_KEY, JSON.stringify({ open: state.open, tab: state.tab, height: state.height })); } catch (e) {}
  }

  /* ------------------------------------------------------------------ utils */
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) for (var k in props) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.append(c.nodeType ? c : String(c));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function fmtBytes(n) {
    if (n == null || isNaN(n)) return '\u2014';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' kB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function fmtMs(ms) {
    if (ms == null || isNaN(ms)) return 'Pending';
    return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(2) + ' s';
  }
  function absUrl(u) { try { return new URL(String(u), location.href).href; } catch (e) { return String(u); } }
  function isPrim(v) { return v === null || (typeof v !== 'object' && typeof v !== 'function'); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    } else legacyCopy(text);
  }
  function legacyCopy(text) {
    var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove();
  }
  function safeType(v) { try { return Object.prototype.toString.call(v).slice(8, -1); } catch (e) { return 'Object'; } }
  function ctorName(v) { try { var c = v.constructor; return (c && c.name) || 'Object'; } catch (e) { return 'Object'; } }

  /* ------------------------------------------------- page event isolation */
  // Pages (focus traps in dialogs, grid keyboard navigation, scroll locks,
  // click-outside handlers) listen on window/document and would otherwise react
  // to typing, clicking and scrolling inside the DevTools panel, e.g. stealing
  // focus from a CSS value you're editing. Listeners the page registers are
  // wrapped so they simply don't see events that come from the panel.
  var ET = EventTarget.prototype, origAdd = ET.addEventListener, origRemove = ET.removeEventListener;
  var ISOLATE = { keydown: 1, keyup: 1, keypress: 1, beforeinput: 1, input: 1, change: 1, focus: 1, blur: 1, focusin: 1, focusout: 1,
    compositionstart: 1, compositionupdate: 1, compositionend: 1, paste: 1, copy: 1, cut: 1, select: 1, selectionchange: 0,
    mousedown: 1, mouseup: 1, click: 1, dblclick: 1, contextmenu: 1, pointerdown: 1, pointerup: 1, pointermove: 1,
    touchstart: 1, touchend: 1, touchmove: 1, wheel: 1, mousewheel: 1, dragstart: 1 };
  var wrapped = new WeakMap();
  function fromPanel(e) {
    if (!host) return false;
    try { var path = e.composedPath ? e.composedPath() : []; return path.indexOf(host) !== -1; } catch (err) { return false; }
  }
  function isOurs(target) {
    try { return target === host || target === shadow || (target && target.getRootNode && shadow && target.getRootNode() === shadow); } catch (e) { return false; }
  }
  function captureFlag(o) { return typeof o === 'boolean' ? o : !!(o && o.capture); }
  ET.addEventListener = function (type, listener, options) {
    if (!listener || !ISOLATE[type]) return origAdd.call(this, type, listener, options);
    var map = wrapped.get(listener);
    if (!map) { map = {}; wrapped.set(listener, map); }
    var key = type + '|' + captureFlag(options);
    var w = map[key];
    if (!w) {
      w = map[key] = function (e) {
        if (fromPanel(e) && !isOurs(e.currentTarget)) return;
        return typeof listener === 'function' ? listener.call(this, e) : listener.handleEvent(e);
      };
    }
    return origAdd.call(this, type, w, options);
  };
  ET.removeEventListener = function (type, listener, options) {
    var map = listener && wrapped.get(listener), w = map && map[type + '|' + captureFlag(options)];
    origRemove.call(this, type, w || listener, options);
    if (w) origRemove.call(this, type, listener, options);
  };

  /* ------------------------------------------------------- console capture */
  var C = window.console, orig = {}, groupDepth = 0, counters = {}, timers = {}, logSeq = 0;
  var ui = { ready: false };

  function callSite() {
    var st = ''; try { st = new Error().stack || ''; } catch (e) {}
    var lines = st.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if ((scriptSrc && l.indexOf(scriptSrc) !== -1) || /safari-devtools/.test(l)) continue;
      var m = l.match(/((?:https?|file|blob):\/\/?[^\s()]+?):(\d+):(\d+)/);
      if (m) return { url: m[1], line: +m[2], col: +m[3] };
    }
    return null;
  }

  function addLog(level, args, opts) {
    opts = opts || {};
    var last = state.logs[state.logs.length - 1];
    var sig = (!opts.kind && args.every(isPrim)) ? level + '|' + groupDepth + '|' + args.map(String).join(' ') : null;
    if (sig && last && last.sig === sig) {
      last.count++;
      if (ui.ready) updateLogCount(last);
      return last;
    }
    var entry = {
      id: ++logSeq, level: level, args: args, sig: sig, count: 1, depth: groupDepth,
      kind: opts.kind || 'log', site: opts.site !== undefined ? opts.site : callSite(), code: opts.code
    };
    state.logs.push(entry);
    if (state.logs.length > MAX_LOGS) { var gone = state.logs.shift(); if (gone.row) gone.row.remove(); }
    if (level === 'error') state.errors++;
    if (level === 'warn') state.warns++;
    if (ui.ready) { appendLogRow(entry); updateBadges(); }
    return entry;
  }

  var levelMap = { log: 'info', info: 'info', warn: 'warn', error: 'error', debug: 'verbose', dir: 'info', dirxml: 'info', table: 'info', trace: 'info' };
  Object.keys(levelMap).forEach(function (m) {
    orig[m] = C[m];
    C[m] = function () {
      var args = Array.prototype.slice.call(arguments);
      if (m === 'trace') { var st = ''; try { st = new Error().stack.split('\n').slice(2).join('\n'); } catch (e) {} args = ['console.trace'].concat(args, ['\n' + st]); }
      try { addLog(levelMap[m], args); } catch (e) {}
      if (orig[m]) return orig[m].apply(C, arguments);
    };
  });
  orig.assert = C.assert;
  C.assert = function (cond) {
    if (!cond) addLog('error', ['Assertion failed:'].concat(Array.prototype.slice.call(arguments, 1)));
    if (orig.assert) return orig.assert.apply(C, arguments);
  };
  orig.clear = C.clear;
  C.clear = function () { clearConsole(); addLog('info', ['Console was cleared'], { kind: 'system', site: null }); if (orig.clear) return orig.clear.apply(C, arguments); };
  ['group', 'groupCollapsed'].forEach(function (m) {
    orig[m] = C[m];
    C[m] = function () {
      var args = Array.prototype.slice.call(arguments);
      addLog('info', args.length ? args : ['console.group'], { kind: 'group' });
      groupDepth++;
      if (orig[m]) return orig[m].apply(C, arguments);
    };
  });
  orig.groupEnd = C.groupEnd;
  C.groupEnd = function () { groupDepth = Math.max(0, groupDepth - 1); if (orig.groupEnd) return orig.groupEnd.apply(C, arguments); };
  orig.count = C.count;
  C.count = function (label) { label = label === undefined ? 'default' : String(label); counters[label] = (counters[label] || 0) + 1; addLog('info', [label + ': ' + counters[label]]); if (orig.count) return orig.count.apply(C, arguments); };
  orig.countReset = C.countReset;
  C.countReset = function (label) { counters[label === undefined ? 'default' : String(label)] = 0; if (orig.countReset) return orig.countReset.apply(C, arguments); };
  orig.time = C.time;
  C.time = function (label) { timers[label === undefined ? 'default' : String(label)] = performance.now(); if (orig.time) return orig.time.apply(C, arguments); };
  ['timeEnd', 'timeLog'].forEach(function (m) {
    orig[m] = C[m];
    C[m] = function (label) {
      label = label === undefined ? 'default' : String(label);
      if (timers[label] != null) {
        addLog('info', [label + ': ' + (performance.now() - timers[label]).toFixed(3) + ' ms']);
        if (m === 'timeEnd') delete timers[label];
      } else addLog('warn', ["Timer '" + label + "' does not exist"]);
      if (orig[m]) return orig[m].apply(C, arguments);
    };
  });

  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && e.target.nodeType === 1) {
      var t = e.target, src = t.src || t.href || t.currentSrc || '';
      addLog('error', ['Failed to load resource: ' + (t.tagName || '').toLowerCase() + ' ' + src], { site: null });
      return;
    }
    var site = e.filename ? { url: e.filename, line: e.lineno, col: e.colno } : null;
    addLog('error', [e.error != null ? e.error : (e.message || 'Script error.')], { site: site, kind: 'uncaught' });
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    addLog('error', ['Uncaught (in promise)', e.reason], { site: null, kind: 'uncaught' });
  });

  /* ------------------------------------------------------- network capture */
  var netSeq = 0;
  function newNet(kind) {
    return { id: ++netSeq, kind: kind, method: 'GET', url: '', status: null, statusText: '', start: performance.now(), end: null,
      reqHeaders: {}, resHeaders: {}, reqBody: null, resBody: null, size: null, mime: '', error: null, done: false };
  }
  function pushNet(e) {
    state.net.push(e);
    if (state.net.length > MAX_NET) state.net.shift();
    if (ui.ready) scheduleNetRender();
  }
  function updateNet() { if (ui.ready) scheduleNetRender(); }
  function headersToObj(hd) {
    var o = {};
    try { if (hd && typeof hd.forEach === 'function') hd.forEach(function (v, k) { o[k] = v; }); else if (hd) Object.keys(hd).forEach(function (k) { o[k] = String(hd[k]); }); } catch (e) {}
    return o;
  }
  function parseRawHeaders(raw) {
    var o = {};
    (raw || '').trim().split(/[\r\n]+/).forEach(function (line) { var i = line.indexOf(':'); if (i > 0) o[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); });
    return o;
  }
  function bodyToString(b) {
    if (b == null) return null;
    if (typeof b === 'string') return b;
    try {
      if (b instanceof URLSearchParams) return b.toString();
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        var parts = []; b.forEach(function (v, k) { parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(typeof v === 'string' ? v : '[File ' + (v.name || 'blob') + ']')); });
        return parts.join('&');
      }
      if (typeof Blob !== 'undefined' && b instanceof Blob) return '[Blob ' + b.size + ' bytes]';
      if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) return '[Binary ' + b.byteLength + ' bytes]';
    } catch (e) {}
    return String(b);
  }
  function isBinaryMime(m) { return /^(image|audio|video|font)\/|octet-stream|application\/(pdf|zip|wasm)/.test(m || ''); }

  /* ------------------------------------------------------------ source maps */
  var rawFetch = window.fetch ? window.fetch.bind(window) : null;
  var SM = { text: {}, maps: {}, list: [] };
  var B64 = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function (c, i) { B64[c] = i; });

  function fetchText(url) {
    if (!SM.text[url]) {
      SM.text[url] = (rawFetch ? rawFetch(url, { credentials: 'same-origin' }) : Promise.reject(new Error('fetch unavailable')))
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text().then(function (t) { return { text: t, headers: r.headers }; });
        });
      SM.text[url].catch(function () { delete SM.text[url]; });
    }
    return SM.text[url];
  }
  function decodeB64Utf8(b) {
    var bin = atob(b);
    try { return new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); })); }
    catch (e) { return decodeURIComponent(escape(bin)); }
  }
  function decodeMappings(str) {
    var lines = [], line = [], fields = [], genCol = 0, src = 0, oLine = 0, oCol = 0, name = 0, value = 0, shift = 0;
    for (var i = 0, n = str.length; i <= n; i++) {
      var c = i < n ? str.charAt(i) : ';';
      if (c === ',' || c === ';') {
        if (fields.length) {
          genCol += fields[0];
          var seg = [genCol];
          if (fields.length >= 4) {
            src += fields[1]; oLine += fields[2]; oCol += fields[3]; seg.push(src, oLine, oCol);
            if (fields.length >= 5) { name += fields[4]; seg.push(name); }
          }
          line.push(seg);
        }
        fields = [];
        if (c === ';') { lines.push(line); line = []; genCol = 0; }
        continue;
      }
      var d = B64[c];
      if (d === undefined) continue;
      value += (d & 31) * Math.pow(2, shift);
      if (d & 32) shift += 5;
      else { var neg = value % 2; value = Math.floor(value / 2); fields.push(neg ? -value : value); value = 0; shift = 0; }
    }
    return lines;
  }
  function parseMap(raw, mapUrl, scriptUrl) {
    if (raw.sections) {
      var secs = raw.sections.map(function (sec) { return { line: sec.offset.line, col: sec.offset.column, map: sec.map ? parseMap(sec.map, mapUrl, scriptUrl) : null }; });
      var all = [];
      secs.forEach(function (sc) { if (sc.map) sc.map.files.forEach(function (f) { all.push(f); }); });
      return {
        url: mapUrl, script: scriptUrl, files: all,
        lookup: function (line, col) {
          var best = null;
          secs.forEach(function (sc) { if (sc.line < line - 1 || (sc.line === line - 1 && sc.col <= col - 1)) best = sc; });
          if (!best || !best.map) return null;
          var l = line - best.line, c = l === 1 ? col - best.col : col;
          return best.map.lookup(l, c);
        }
      };
    }
    var root = raw.sourceRoot || '';
    var names = raw.names || [], contents = raw.sourcesContent || [], lines = null;
    var map = { url: mapUrl, script: scriptUrl, files: [] };
    map.files = (raw.sources || []).map(function (src, i) {
      var full = src || '';
      if (root && !/^[a-z][a-z0-9+.-]*:/i.test(full)) full = root.replace(/\/?$/, '/') + full;
      var abs; try { abs = new URL(full, mapUrl).href; } catch (e) { abs = full; }
      return {
        url: abs, map: map, idx: i, display: displayPath(abs),
        content: function () {
          if (contents[i] != null) return Promise.resolve(contents[i]);
          return fetchText(abs).then(function (r) { return r.text; });
        }
      };
    });
    map.lookup = function (line, col) {
      if (!lines) lines = decodeMappings(raw.mappings || '');
      var segs = lines[line - 1];
      if (!segs || !segs.length) return null;
      var lo = 0, hi = segs.length - 1, found = -1, c0 = (col || 1) - 1;
      while (lo <= hi) { var mid = (lo + hi) >> 1; if (segs[mid][0] <= c0) { found = mid; lo = mid + 1; } else hi = mid - 1; }
      if (found < 0) found = 0;
      var sg = segs[found];
      if (sg.length < 4) return null;
      var f = map.files[sg[1]];
      return f ? { file: f, line: sg[2] + 1, col: sg[3] + 1, name: sg.length > 4 ? names[sg[4]] : null } : null;
    };
    return map;
  }
  function loadMap(scriptUrl) {
    if (!scriptUrl || !/^(https?|file|blob):/.test(scriptUrl)) return Promise.resolve(null);
    // never re-request the page document itself (inline scripts report the page URL)
    if (scriptUrl.split('#')[0] === location.href.split('#')[0]) return Promise.resolve(null);
    if (SM.maps[scriptUrl]) return SM.maps[scriptUrl];
    SM.maps[scriptUrl] = fetchText(scriptUrl).then(function (res) {
      var ref = null;
      try { ref = res.headers.get('SourceMap') || res.headers.get('X-SourceMap'); } catch (e) {}
      if (!ref) {
        var re = /\/[\/*][#@]\s*sourceMappingURL=([^\s'"*]+)/g, m;
        while ((m = re.exec(res.text))) ref = m[1];
      }
      if (!ref) return null;
      if (/^data:/i.test(ref)) {
        var comma = ref.indexOf(','), meta = ref.slice(0, comma), body = ref.slice(comma + 1);
        var json = /;base64/i.test(meta) ? decodeB64Utf8(body) : decodeURIComponent(body);
        return parseMap(JSON.parse(json), scriptUrl, scriptUrl);
      }
      var mapUrl = new URL(ref, scriptUrl).href;
      return fetchText(mapUrl).then(function (r2) { return parseMap(JSON.parse(r2.text.replace(/^\)\]\}'[^\n]*\n/, '')), mapUrl, scriptUrl); });
    }).then(function (map) {
      if (map) { SM.list.push(map); if (ui.ready && state.tab === 'sources') renderSourcesNav(); }
      return map;
    }).catch(function () { return null; });
    return SM.maps[scriptUrl];
  }
  // -> Promise<{ file, line, col, name } | null>
  function mapLocation(url, line, col) {
    if (!url || !line) return Promise.resolve(null);
    return loadMap(url).then(function (m) { return m ? m.lookup(line, col || 1) : null; });
  }
  function displayPath(u) {
    return String(u).replace(/^webpack:\/\/\/?(\.\/)?/, '').replace(/^(https?:\/\/[^/]+)\//, '').replace(/^\/+/, '') || u;
  }
  function shortName(u) { var p = String(u).split(/[?#]/)[0].split('/'); return p.pop() || p.pop() || u; }
  function parseStack(stack) {
    var frames = [];
    String(stack || '').split('\n').forEach(function (l) {
      var m = l.match(/^\s*(?:at\s+)?(?:(.*?)(?:\s+\(|@))?(\S+?):(\d+):(\d+)\)?\s*$/);
      if (!m || !/^(https?|file|blob|webpack|safari-web-extension):/.test(m[2])) return;
      if ((scriptSrc && m[2] === scriptSrc) || /safari-devtools\.js/.test(m[2])) return;
      frames.push({ fn: (m[1] || '').replace(/^async\s+/, '') || '(anonymous)', url: m[2], line: +m[3], col: +m[4] });
    });
    return frames;
  }
  // A clickable "file:line" link that upgrades itself to the original source once the map loads.
  function srcLink(loc, cls) {
    var a = h('span', { class: cls || 'srclink', title: loc.url + ':' + loc.line + (loc.col ? ':' + loc.col : '') }, shortName(loc.url) + ':' + loc.line);
    var target = { url: loc.url, line: loc.line, col: loc.col };
    a.addEventListener('click', function (e) { e.stopPropagation(); openSource(target); });
    mapLocation(loc.url, loc.line, loc.col).then(function (r) {
      if (!r) return;
      target = { file: r.file, line: r.line, col: r.col, generated: { url: loc.url, line: loc.line, col: loc.col } };
      a.textContent = shortName(r.file.url) + ':' + r.line;
      a.title = r.file.display + ':' + r.line + ':' + r.col + '\n(mapped from ' + shortName(loc.url) + ':' + loc.line + ':' + (loc.col || 1) + ')';
      a.classList.add('mapped');
    });
    return a;
  }
  function renderStack(err) {
    var wrap = h('span', { class: 'errtxt' });
    var stack = '';
    try { stack = String(err.stack || ''); } catch (e) {}
    wrap.append((err.name || 'Error') + ': ' + (err.message || ''));
    var frames = parseStack(stack);
    frames.slice(0, 40).forEach(function (f) {
      wrap.append('\n    at ' + f.fn + ' (', srcLink(f), ')');
    });
    if (!frames.length && stack && stack.indexOf(err.message) === -1) wrap.append('\n' + stack);
    return wrap;
  }

  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var e = newNet('fetch');
      try {
        var req = (typeof Request !== 'undefined' && input instanceof Request) ? input : null;
        e.method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
        e.url = absUrl(req ? req.url : input);
        e.reqHeaders = headersToObj(new Headers((init && init.headers) || (req && req.headers) || {}));
        e.reqBody = bodyToString(init && init.body);
      } catch (err) {}
      pushNet(e);
      return origFetch.apply(this, arguments).then(function (res) {
        e.status = res.status; e.statusText = res.statusText;
        e.resHeaders = headersToObj(res.headers);
        e.mime = res.headers.get('content-type') || '';
        var len = +res.headers.get('content-length');
        e.end = performance.now();
        updateNet(e);
        if (/event-stream/.test(e.mime)) { e.resBody = '(event stream)'; e.done = true; return res; }
        try {
          var clone = res.clone();
          var p = isBinaryMime(e.mime)
            ? clone.blob().then(function (b) { e.size = len || b.size; e.resBody = '(binary ' + (e.mime || 'data') + ', ' + fmtBytes(b.size) + ')'; })
            : clone.text().then(function (t) { e.size = len || t.length; e.resBody = t.length > MAX_BODY ? t.slice(0, MAX_BODY) + '\n\u2026 (truncated)' : t; });
          p.catch(function () {}).then(function () { e.end = performance.now(); e.done = true; updateNet(e); });
        } catch (err) { e.done = true; }
        return res;
      }, function (err) {
        e.status = 0; e.error = String((err && err.message) || err); e.end = performance.now(); e.done = true; updateNet(e);
        throw err;
      });
    };
  }

  if (window.XMLHttpRequest) {
    var XP = XMLHttpRequest.prototype, oOpen = XP.open, oSend = XP.send, oSet = XP.setRequestHeader;
    XP.open = function (method, url) {
      this.__sdt = { method: String(method || 'GET').toUpperCase(), url: absUrl(url), reqHeaders: {} };
      return oOpen.apply(this, arguments);
    };
    XP.setRequestHeader = function (k, v) { if (this.__sdt) this.__sdt.reqHeaders[k] = v; return oSet.apply(this, arguments); };
    XP.send = function (body) {
      var info = this.__sdt, xhr = this;
      if (info) {
        var e = newNet('xhr');
        e.method = info.method; e.url = info.url; e.reqHeaders = info.reqHeaders; e.reqBody = bodyToString(body);
        pushNet(e);
        xhr.addEventListener('loadend', function () {
          e.end = performance.now(); e.status = xhr.status; e.statusText = xhr.statusText;
          try { e.resHeaders = parseRawHeaders(xhr.getAllResponseHeaders()); e.mime = xhr.getResponseHeader('content-type') || ''; } catch (err) {}
          try {
            var rt = xhr.responseType;
            if (rt === '' || rt === 'text') { e.resBody = xhr.responseText; e.size = xhr.responseText.length; }
            else if (rt === 'json') { e.resBody = JSON.stringify(xhr.response); e.size = e.resBody ? e.resBody.length : 0; }
            else if (rt === 'document') { e.resBody = xhr.response ? xhr.response.documentElement.outerHTML : ''; e.size = e.resBody.length; }
            else { var r = xhr.response; e.size = r ? (r.byteLength || r.size || 0) : 0; e.resBody = '(binary ' + rt + ', ' + fmtBytes(e.size) + ')'; }
          } catch (err) {}
          var cl = +(e.resHeaders['content-length'] || 0); if (cl) e.size = cl;
          if (!xhr.status) e.error = 'Failed';
          e.done = true; updateNet(e);
        });
      }
      return oSend.apply(this, arguments);
    };
  }

  function resourceType(e) {
    if (e.kind === 'fetch' || e.kind === 'xhr') return 'Fetch/XHR';
    if (e.kind === 'navigation') return 'Doc';
    var u = (e.url || '').split(/[?#]/)[0].toLowerCase();
    if (e.kind === 'script' || /\.m?js$/.test(u)) return 'JS';
    if (e.kind === 'css' || /\.css$/.test(u)) return 'CSS';
    if (e.kind === 'img' || e.kind === 'image' || /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp)$/.test(u)) return 'Img';
    if (/\.(woff2?|ttf|otf|eot)$/.test(u)) return 'Font';
    if (e.kind === 'iframe') return 'Doc';
    if (e.kind === 'video' || e.kind === 'audio') return 'Media';
    return 'Other';
  }
  function addPerfEntry(r) {
    if (r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest') return;
    if (scriptSrc && r.name === scriptSrc) return;
    var e = newNet(r.entryType === 'navigation' ? 'navigation' : r.initiatorType);
    e.url = r.name; e.start = r.startTime; e.end = r.responseEnd || (r.startTime + r.duration);
    e.status = r.responseStatus || (r.entryType === 'navigation' ? 200 : null);
    e.size = r.transferSize || r.encodedBodySize || r.decodedBodySize || null;
    e.cached = r.transferSize === 0 && r.decodedBodySize > 0;
    e.timing = r; e.done = true; e.fromPerf = true;
    pushNet(e);
  }
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav) addPerfEntry(nav);
    new PerformanceObserver(function (list) { list.getEntries().forEach(addPerfEntry); }).observe({ type: 'resource', buffered: true });
  } catch (err) {
    try { performance.getEntriesByType('resource').forEach(addPerfEntry); } catch (e2) {}
  }

  /* ================================================================== UI === */
  var CSS = "\n:host{all:initial}\n*{box-sizing:border-box}\n\
.root{--bg:#fff;--bg2:#f1f3f4;--bg3:#e8eaed;--fg:#1f1f1f;--fg2:#5f6368;--line:#cacdd1;--sel:#cfe8fc;--selfg:#1f1f1f;--hover:#eaf1fb;--accent:#1a73e8;\
--tag:#881280;--attr:#994500;--aval:#1a1aa6;--str:#c41a16;--num:#1c00cf;--kw:#aa0d91;--null:#80868b;--prop:#881391;--fn:#0d22aa;\
--warnbg:#fffbe5;--warnfg:#5c3c00;--warnline:#fff5c2;--errbg:#fff0f0;--errfg:#e40000;--errline:#ffd6d6;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;\
font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:var(--fg)}\n\
@media (prefers-color-scheme:dark){.root{--bg:#202124;--bg2:#292a2d;--bg3:#35363a;--fg:#e8eaed;--fg2:#9aa0a6;--line:#494c50;--sel:#073655;--selfg:#e8eaed;--hover:#2c3440;--accent:#8ab4f8;\
--tag:#5db0d7;--attr:#9bbbdc;--aval:#f29766;--str:#f28b54;--num:#9980ff;--kw:#c792ea;--null:#9aa0a6;--prop:#7cacf8;--fn:#9bbbdc;\
--warnbg:#413c26;--warnfg:#fdd663;--warnline:#5c5432;--errbg:#4e3534;--errfg:#f28b81;--errline:#6b3d3a}}\n\
.panel{position:fixed;left:0;right:0;bottom:0;background:var(--bg);border-top:1px solid var(--line);display:flex;flex-direction:column;z-index:2147483646;box-shadow:0 -2px 8px rgba(0,0,0,.12)}\n\
.panel[hidden]{display:none}\n\
.resizer{position:absolute;top:-4px;left:0;right:0;height:8px;cursor:ns-resize;touch-action:none}\n\
.tabs{display:flex;align-items:stretch;background:var(--bg2);border-bottom:1px solid var(--line);height:30px;flex:none;overflow-x:auto;scrollbar-width:none}\n\
.tabs::-webkit-scrollbar{display:none}\n\
.tab{padding:0 12px;display:flex;align-items:center;cursor:pointer;color:var(--fg2);border-bottom:2px solid transparent;white-space:nowrap;user-select:none}\n\
.tab:hover{color:var(--fg);background:var(--bg3)}\n.tab.on{color:var(--fg);border-bottom-color:var(--accent)}\n\
.ibtn{border:0;background:none;color:var(--fg2);cursor:pointer;padding:0 8px;display:flex;align-items:center;font:inherit;min-width:28px;justify-content:center}\n\
.ibtn:hover{color:var(--fg);background:var(--bg3)}\n.ibtn.on{color:var(--accent)}\n.ibtn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}\n\
.sep{width:1px;background:var(--line);margin:6px 2px}\n.grow{flex:1}\n\
.badges{display:flex;align-items:center;gap:8px;padding:0 8px;cursor:pointer;white-space:nowrap}\n.badge-e{color:var(--errfg)}.badge-w{color:var(--warnfg)}\n\
.views{flex:1;min-height:0;position:relative}\n.view{position:absolute;inset:0;display:none;flex-direction:column}\n.view.on{display:flex}\n\
.toolbar{display:flex;align-items:center;gap:4px;padding:0 4px;height:28px;border-bottom:1px solid var(--line);background:var(--bg);flex:none;overflow-x:auto;scrollbar-width:none}\n\
.toolbar::-webkit-scrollbar{display:none}\n\
input.filter{border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:3px;padding:2px 6px;font:inherit;width:180px;min-width:90px;outline:none}\n\
input.filter:focus{border-color:var(--accent)}\n\
.chip{border:0;background:none;color:var(--fg2);font:inherit;padding:2px 8px;border-radius:10px;cursor:pointer;white-space:nowrap}\n\
.chip:hover{background:var(--bg3)}\n.chip.on{background:var(--sel);color:var(--selfg)}\n\
.mono{font-family:var(--mono);font-size:11.5px}\n.muted{color:var(--fg2)}\n\
.scroll{flex:1;overflow:auto;min-height:0}\n\
/* values */\n.v-str{color:var(--str)}.v-num{color:var(--num)}.v-bool{color:var(--kw)}.v-null{color:var(--null)}.v-sym{color:var(--str)}.v-fn{color:var(--fn);font-style:italic}.v-key{color:var(--prop)}.v-key.np{opacity:.65}\n\
.obj{display:inline}\n.obj-head{cursor:pointer}\n.tri{display:inline-block;width:10px;color:var(--fg2);font-size:8px;transform:translateY(-1px)}\n\
.obj-body{display:block;padding-left:14px}\n.prop{white-space:pre}\n.errtxt{white-space:pre-wrap}\n\
.noderef{color:var(--tag);cursor:pointer}.noderef:hover{text-decoration:underline}\n\
/* console */\n.con-list{flex:1;overflow:auto;font-family:var(--mono);font-size:11.5px}\n\
.log{display:flex;gap:6px;padding:3px 8px 3px 6px;border-bottom:1px solid var(--bg3);align-items:flex-start}\n\
.log .ico{width:12px;flex:none;text-align:center;font-size:10px;line-height:16px;color:var(--fg2)}\n\
.log .msg{flex:1;min-width:0;white-space:pre-wrap;word-break:break-word}\n\
.log .site{flex:none;color:var(--fg2);text-decoration:underline;font-size:11px;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl}\n\
.log .cnt{flex:none;background:var(--fg2);color:var(--bg);border-radius:8px;padding:0 5px;font-size:10px;line-height:15px;height:15px}\n\
.log.warn{background:var(--warnbg);color:var(--warnfg);border-bottom-color:var(--warnline)}\n\
.log.error{background:var(--errbg);color:var(--errfg);border-bottom-color:var(--errline)}\n\
.log.warn .ico{color:#e8a600}.log.error .ico{color:var(--errfg)}\n\
.log.verbose{color:var(--fg2)}\n.log.group .msg{font-weight:600}\n.log.input .ico,.log.result .ico{color:var(--accent);font-size:13px}\n.log.system{color:var(--fg2);font-style:italic}\n\
.prompt{display:flex;gap:6px;padding:4px 8px 4px 6px;align-items:flex-start}\n.prompt .ico{width:12px;color:var(--accent);font-size:13px;line-height:16px;text-align:center}\n\
.prompt textarea{flex:1;border:0;outline:0;background:transparent;color:var(--fg);font:inherit;resize:none;padding:0;min-height:16px;line-height:16px;overflow:hidden}\n\
/* elements */\n.split{flex:1;display:flex;min-height:0}\n.split>.left{flex:1;min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--line)}\n\
.split>.right{width:42%;min-width:240px;display:flex;flex-direction:column}\n\
@media (max-width:700px){.split{flex-direction:column}.split>.left{border-right:0;border-bottom:1px solid var(--line);flex:1}.split>.right{width:auto;flex:1;min-width:0}}\n\
.tree{flex:1;overflow:auto;font-family:var(--mono);font-size:11.5px;padding:4px 0;outline:none}\n\
.row{white-space:nowrap;cursor:default;line-height:18px;padding-right:12px}\n.row:hover{background:var(--hover)}\n.row.sel{background:var(--sel)}\n\
.row .tri{cursor:pointer;width:12px}\n.t-tag{color:var(--tag)}.t-attr{color:var(--attr)}.t-aval{color:var(--aval)}.t-text{color:var(--fg)}.t-cmt{color:#236e25}.t-shadow{color:var(--fg2)}\n\
.row .attrs{cursor:text}\n\
.crumbs{flex:none;border-top:1px solid var(--line);height:22px;display:flex;align-items:center;overflow-x:auto;white-space:nowrap;padding:0 4px;font-family:var(--mono);font-size:11px;scrollbar-width:none}\n\
.crumb{padding:0 5px;cursor:pointer;color:var(--tag)}.crumb:hover{background:var(--hover)}.crumb.last{background:var(--sel)}\n\
.ac{position:fixed;z-index:2147483647;display:none;min-width:180px;max-width:420px;max-height:220px;overflow:auto;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.18);font-family:var(--mono);font-size:11.5px;padding:2px 0}\n\
.ac-item{display:flex;align-items:center;gap:6px;padding:2px 8px;white-space:nowrap;cursor:default}\n\
.ac-item.on{background:var(--sel);color:var(--selfg)}\n\
.ac-item b{font-weight:700;color:var(--accent)}\n\
.ac-label{flex:1;overflow:hidden;text-overflow:ellipsis}\n\
.ac-hint{color:var(--fg2);overflow:hidden;text-overflow:ellipsis;max-width:45%}\n\
input.ed{font:inherit;color:var(--fg);background:var(--bg);border:1px solid var(--accent);border-radius:2px;padding:0 2px;margin:0;outline:none;min-width:2ch;max-width:100%;box-sizing:content-box;line-height:inherit;height:auto}\n\
/* styles */\n.side-tabs{display:flex;height:28px;border-bottom:1px solid var(--line);flex:none}\n\
.styles{flex:1;overflow:auto;font-family:var(--mono);font-size:11.5px}\n\
.rule{border-bottom:1px solid var(--line);padding:4px 8px 6px}\n\
.rule-head{display:flex;gap:8px}\n.rule-sel{color:var(--fg);flex:1;word-break:break-all}\n.rule-src{color:var(--fg2);text-decoration:underline;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n\
.decl{padding-left:14px;display:flex;align-items:baseline;gap:0;min-height:17px;position:relative}\n\
.decl input[type=checkbox]{position:absolute;left:-2px;top:1px;margin:0;width:12px;height:12px;visibility:hidden}\n\
.decl:hover input[type=checkbox],.decl.off input[type=checkbox]{visibility:visible}\n\
.d-name{color:var(--prop);cursor:text}.d-val{color:var(--fg);cursor:text;word-break:break-all}\n\
.decl.over .d-name,.decl.over .d-val,.decl.off .d-name,.decl.off .d-val{text-decoration:line-through;opacity:.6}\n\
.decl.bad .d-val::after{content:' \u26a0';color:#e8a600}\n\
.swatch{display:inline-block;width:10px;height:10px;border:1px solid var(--line);margin-right:4px;vertical-align:-1px}\n\
.add-decl{padding-left:14px;color:var(--fg2);cursor:text;min-height:14px}\n.add-decl:hover::before{content:'+ add property';opacity:.7}\n\
.note{padding:6px 8px;color:var(--fg2);font-style:italic}\n\
.srclink,.log .site{cursor:pointer}.srclink{color:var(--fg2);text-decoration:underline}.srclink:hover,.log .site:hover{color:var(--accent)}\n\
.src-left{width:280px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--line);min-height:0}\n\
.src-nav{flex:1;overflow:auto;padding:2px 0;font-size:12px}\n\
.src-opt{display:flex;gap:6px;align-items:center;padding:3px 8px;color:var(--fg2);border-bottom:1px solid var(--line)}\n\
.src-group{padding:4px 8px;color:var(--fg2);font-weight:600;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--bg2)}\n\
.src-file{padding:2px 8px 2px 20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}\n\
.src-file:hover{background:var(--hover)}.src-file.on{background:var(--sel)}\n\
.src-right{flex:1;display:flex;flex-direction:column;min-width:0}\n\
.src-title{flex:none;padding:4px 10px;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n\
.src-code{flex:1;overflow:auto;font-family:var(--mono);font-size:11.5px;line-height:17px}\n\
.src-line{display:flex;white-space:pre}.src-line.hit{background:var(--warnbg)}\n\
.src-ln{flex:none;width:52px;padding-right:10px;text-align:right;color:var(--fg2);user-select:none;-webkit-user-select:none;border-right:1px solid var(--line);margin-right:8px}\n\
.src-tx{flex:none}.c-cmt{color:#236e25}\n\
@media (max-width:700px){.src-left{width:auto;max-height:40%}}\n\
.inh-head{padding:5px 8px;background:var(--bg2);border-bottom:1px solid var(--line);color:var(--fg2);font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-size:11.5px}\n\
.rule.ua .d-name,.rule.ua .d-val{cursor:default}.rule.ua .rule-sel{font-style:italic}\n\
.computed .crow{display:flex;gap:6px;padding:1px 8px;white-space:nowrap}\n.computed .crow:hover{background:var(--hover)}\n\
.boxmodel{margin:10px auto;font-family:var(--mono);font-size:10px;text-align:center;width:max-content;color:#1f1f1f}\n\
.bm{position:relative;padding:4px 20px;border:1px dashed #333;min-width:60px}\n.bm>.lbl{position:absolute;left:4px;top:1px;font-size:9px}\n\
.bm-m{background:#f9cc9d}.bm-b{background:#fddd9b;border-style:solid;border-color:#000}.bm-p{background:#c3d08b}.bm-c{background:#8cb6c0;border-style:solid;border-color:#808080;padding:6px 10px}\n\
/* network */\n.net-wrap{flex:1;display:flex;min-height:0}\n.net-table{flex:1;overflow:auto;min-width:0}\n\
table{border-collapse:collapse;width:100%;table-layout:fixed}\n\
th{position:sticky;top:0;background:var(--bg2);font-weight:normal;text-align:left;padding:3px 6px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:1}\n\
td{padding:2px 6px;border-right:1px solid var(--bg3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:21px}\n\
tbody tr:nth-child(even){background:var(--bg2)}\ntbody tr{cursor:default}\ntbody tr:hover{background:var(--hover)}\ntbody tr.sel{background:var(--sel)}\n\
tr.fail td{color:var(--errfg)}\n.wf{position:relative;height:10px}\n.wf>i{position:absolute;top:2px;height:6px;background:var(--accent);border-radius:1px;min-width:2px;opacity:.8}\n\
.net-wrap.detail .net-table .c-x{display:none}.net-wrap.detail .net-table .c-n{width:auto!important}\n.net-wrap.detail .net-table{flex:0 0 32%;border-right:1px solid var(--line)}\n\
.net-detail{display:none;flex:1;flex-direction:column;min-width:0}\n.net-wrap.detail .net-detail{display:flex}\n\
.dsec{border-bottom:1px solid var(--line);padding:6px 10px}\n.dsec h4{margin:0 0 4px;font-size:12px;font-weight:600}\n\
.kv{display:flex;gap:8px;font-family:var(--mono);font-size:11.5px;line-height:17px}\n.kv .k{color:var(--fg2);min-width:140px;flex:none;word-break:break-all}\n.kv .v{word-break:break-all;flex:1}\n\
pre.body{margin:0;padding:8px 10px;font-family:var(--mono);font-size:11.5px;white-space:pre-wrap;word-break:break-all}\n\
.statusbar{flex:none;border-top:1px solid var(--line);height:22px;display:flex;align-items:center;gap:14px;padding:0 8px;color:var(--fg2);background:var(--bg2);white-space:nowrap;overflow:hidden}\n\
.empty{padding:24px;text-align:center;color:var(--fg2)}\n\
/* storage */\n.store-nav{width:180px;flex:none;border-right:1px solid var(--line);overflow:auto;padding:4px 0}\n\
.store-nav .item{padding:4px 12px;cursor:pointer;white-space:nowrap}\n.store-nav .item:hover{background:var(--hover)}\n.store-nav .item.on{background:var(--sel)}\n\
.store-nav .grp{padding:6px 10px 2px;color:var(--fg2);font-size:11px;text-transform:uppercase;letter-spacing:.04em}\n\
@media (max-width:700px){.store-nav{width:110px}}\n\
.store-main{flex:1;display:flex;flex-direction:column;min-width:0}\n\
td.edit{cursor:text}\n.del{border:0;background:none;color:var(--fg2);cursor:pointer;font:inherit;padding:0 4px}\n.del:hover{color:var(--errfg)}\n\
.addrow{display:flex;gap:4px;padding:4px;border-top:1px solid var(--line);flex:none}\n.addrow input{flex:1;min-width:0}\n\
.btn{border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:3px;padding:2px 10px;font:inherit;cursor:pointer}\n.btn:hover{background:var(--bg3)}\n\
.preview{flex:none;max-height:40%;overflow:auto;border-top:1px solid var(--line);padding:6px 8px;font-family:var(--mono);font-size:11.5px}\n\
/* overlay + launcher */\n.hl{position:fixed;pointer-events:none;z-index:2147483645;display:none}\n.hl div{position:fixed;border-style:solid}\n\
.hl .m{border-color:rgba(246,178,107,.55)}.hl .b{border-color:rgba(255,229,153,.65)}.hl .p{border-color:rgba(147,196,125,.55)}.hl .c{background:rgba(111,168,220,.55);border-width:0}\n\
.hl-tip{position:fixed;background:#fff;color:#1f1f1f;font:11px/1.3 var(--mono);padding:4px 8px;border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap;z-index:2147483647}\n\
.hl-tip .tn{color:#881280;font-weight:600}.hl-tip .dim{color:#5f6368;margin-left:8px}\n\
.fab{position:fixed;right:16px;bottom:16px;width:42px;height:42px;border-radius:50%;background:#1f1f1f;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147483646;box-shadow:0 2px 8px rgba(0,0,0,.3);touch-action:none;user-select:none;-webkit-user-select:none}\n\
.fab svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n\
.fab .dot{position:absolute;top:-2px;right:-2px;min-width:16px;height:16px;border-radius:8px;background:#d93025;color:#fff;font:10px/16px -apple-system,sans-serif;text-align:center;padding:0 4px;display:none}\n\
.fab[hidden]{display:none}\n";

  var ICON = {
    pick: '<svg viewBox="0 0 16 16"><path d="M7 13H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v4"/><path d="M8 8l6 2.5-2.5 1-1 2.5z"/></svg>',
    close: '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    clear: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M4.2 11.8l7.6-7.6"/></svg>',
    refresh: '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5"/></svg>',
    dock: '<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="12" height="11" rx="1"/><path d="M2 9.5h12"/></svg>',
    fab: '<svg viewBox="0 0 24 24"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/></svg>'
  };
  function icon(name) { var s = h('span', { style: { display: 'flex' } }); s.innerHTML = ICON[name]; return s; }

  var host, shadow, root, panel, fab, hl, hlTip, views = {}, tabEls = {};

  function build() {
    host = document.createElement('safari-devtools');
    host.setAttribute('style', 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647');
    shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(h('style', { text: CSS }));
    root = h('div', { class: 'root' });
    shadow.appendChild(root);

    // highlight overlay
    hl = h('div', { class: 'hl' }, h('div', { class: 'm' }), h('div', { class: 'b' }), h('div', { class: 'p' }), h('div', { class: 'c' }));
    hlTip = h('div', { class: 'hl-tip', style: { display: 'none' } });
    root.append(hl, hlTip);

    // launcher
    fab = h('div', { class: 'fab', title: 'Open DevTools (Ctrl+Shift+D)' }, icon('fab'), h('span', { class: 'dot' }));
    if (cfg.launcher === 'false') fab.style.display = 'none';
    setupFab();
    root.append(fab);

    // panel
    panel = h('div', { class: 'panel' });
    panel.style.height = state.height + 'px';
    var resizer = h('div', { class: 'resizer' });
    setupResizer(resizer);

    var pickBtn = h('button', { class: 'ibtn', title: 'Select an element in the page to inspect it (Ctrl+Shift+C)', onclick: function () { setPicking(!state.picking); } }, icon('pick'));
    ui.pickBtn = pickBtn;
    var tabs = h('div', { class: 'tabs' }, pickBtn, h('div', { class: 'sep' }));
    ['Elements', 'Console', 'Sources', 'Network', 'Storage'].forEach(function (name) {
      var id = name.toLowerCase();
      tabEls[id] = h('div', { class: 'tab', onclick: function () { switchTab(id); } }, name);
      tabs.append(tabEls[id]);
    });
    ui.badges = h('div', { class: 'badges', title: 'Open Console', onclick: function () { switchTab('console'); } });
    tabs.append(h('div', { class: 'grow' }), ui.badges,
      h('button', { class: 'ibtn', title: 'Close (Ctrl+Shift+D)', onclick: function () { hide(); } }, icon('close')));

    var viewWrap = h('div', { class: 'views' });
    views.elements = buildElements();
    views.console = buildConsole();
    views.network = buildNetwork();
    views.sources = buildSources();
    views.storage = buildStorage();
    Object.keys(views).forEach(function (k) { viewWrap.append(views[k]); });

    panel.append(resizer, tabs, viewWrap);
    root.append(panel);
    (document.body || document.documentElement).appendChild(host);

    ui.ready = true;
    state.logs.forEach(appendLogRow);
    updateBadges();
    switchTab(state.tab, true);
    if (state.open) show(); else { panel.hidden = true; }
    setupShortcuts();
  }

  function setupFab() {
    var sx, sy, ox, oy, moved = false, dragging = false;
    try { var p = JSON.parse(localStorage.getItem('__sdt_fab') || 'null'); if (p) { fab.style.right = p.r + 'px'; fab.style.bottom = p.b + 'px'; } } catch (e) {}
    fab.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      ox = parseFloat(fab.style.right) || 16; oy = parseFloat(fab.style.bottom) || 16;
      try { fab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    fab.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      if (moved) {
        fab.style.right = Math.max(0, Math.min(window.innerWidth - 42, ox - dx)) + 'px';
        fab.style.bottom = Math.max(0, Math.min(window.innerHeight - 42, oy - dy)) + 'px';
      }
    });
    fab.addEventListener('pointerup', function () {
      if (!dragging) return; dragging = false;
      if (moved) { try { localStorage.setItem('__sdt_fab', JSON.stringify({ r: parseFloat(fab.style.right), b: parseFloat(fab.style.bottom) })); } catch (e) {} }
      else show();
    });
  }

  function setupResizer(el) {
    var startY, startH;
    el.addEventListener('pointerdown', function (e) {
      startY = e.clientY; startH = panel.offsetHeight; e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      function move(ev) { var nh = Math.max(120, Math.min(window.innerHeight - 40, startH + (startY - ev.clientY))); panel.style.height = nh + 'px'; state.height = nh; }
      function up() { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); saveUI(); }
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
  }

  function setupShortcuts() {
    origAdd.call(window, 'keydown', function (e) {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
      var k = (e.key || '').toLowerCase();
      if (k === 'd') { e.preventDefault(); state.open ? hide() : show(); }
      else if (k === 'c') { e.preventDefault(); if (!state.open) show(); switchTab('elements'); setPicking(!state.picking); }
    }, true);
  }

  function show() {
    state.open = true; panel.hidden = false; fab.hidden = true; saveUI(); switchTab(state.tab, true);
  }
  function hide() {
    state.open = false; panel.hidden = true; fab.hidden = false; setPicking(false); hideHighlight(); saveUI();
  }
  function switchTab(id, force) {
    if (!views[id]) id = 'console';
    if (state.tab === id && !force && views[id].classList.contains('on')) return;
    state.tab = id; saveUI();
    Object.keys(views).forEach(function (k) { views[k].classList.toggle('on', k === id); tabEls[k].classList.toggle('on', k === id); });
    if (!state.open) return;
    if (id === 'elements') { if (!state.selected) state.selected = document.body; renderTree(); renderSide(); }
    if (id === 'network') renderNet();
    if (id === 'storage') renderStorage();
    if (id === 'sources') renderSourcesNav();
    if (id === 'console') { scrollConsole(true); setTimeout(function () { ui.input && ui.input.focus({ preventScroll: true }); }, 0); }
    if (id !== 'storage') stopStoragePoll(); else startStoragePoll();
  }
  function updateBadges() {
    clear(ui.badges);
    if (state.errors) ui.badges.append(h('span', { class: 'badge-e' }, '\u2716 ' + state.errors));
    if (state.warns) ui.badges.append(h('span', { class: 'badge-w' }, '\u26a0 ' + state.warns));
    var dot = fab.querySelector('.dot');
    dot.textContent = state.errors > 99 ? '99+' : state.errors;
    dot.style.display = state.errors ? 'block' : 'none';
  }

  /* -------------------------------------------------------- value renderer */
  function renderValue(v, opts) {
    opts = opts || {};
    var t = typeof v;
    if (v === null) return h('span', { class: 'v-null' }, 'null');
    if (v === undefined) return h('span', { class: 'v-null' }, 'undefined');
    if (t === 'string') return opts.top ? h('span', null, v) : h('span', { class: 'v-str' }, JSON.stringify(v));
    if (t === 'number' || t === 'bigint') return h('span', { class: 'v-num' }, t === 'bigint' ? v + 'n' : (Object.is(v, -0) ? '-0' : String(v)));
    if (t === 'boolean') return h('span', { class: 'v-bool' }, String(v));
    if (t === 'symbol') return h('span', { class: 'v-sym' }, v.toString());
    if (v && v.nodeType && typeof v.nodeName === 'string') return nodeRef(v);
    if (v instanceof Error || safeType(v) === 'Error') {
      if (opts.top) return renderStack(v);
      return expandable(v, h('span', null, v.name + ': ' + v.message));
    }
    return expandable(v, preview(v, opts.top));
  }

  function shortPreview(v) {
    if (isPrim(v)) {
      if (typeof v === 'string') return h('span', { class: 'v-str' }, JSON.stringify(v.length > 50 ? v.slice(0, 50) + '\u2026' : v));
      return renderValue(v);
    }
    if (typeof v === 'function') return h('span', { class: 'v-fn' }, '\u0192');
    if (Array.isArray(v)) return 'Array(' + v.length + ')';
    if (v && v.nodeType) return nodeRef(v);
    return ctorName(v) === 'Object' ? '{\u2026}' : ctorName(v);
  }

  function preview(v, top) {
    var type = safeType(v);
    try {
      if (typeof v === 'function') {
        var src = Function.prototype.toString.call(v);
        var sig = /^class\b/.test(src) ? 'class ' + (v.name || '') : '\u0192 ' + (v.name || 'anonymous') + '(' + ((src.match(/^[^(]*\(([^)]*)\)/) || [])[1] || '') + ')';
        return h('span', { class: 'v-fn' }, sig);
      }
      if (type === 'Date') return h('span', null, isNaN(v) ? 'Invalid Date' : v.toString());
      if (type === 'RegExp') return h('span', { class: 'v-str' }, String(v));
      if (Array.isArray(v) || ArrayBuffer.isView(v)) {
        var parts = [], n = Math.min(v.length, 100);
        for (var i = 0; i < n; i++) { if (i) parts.push(', '); parts.push(shortPreview(v[i])); }
        if (v.length > n) parts.push(', \u2026');
        return h('span', null, (top || v.length ? '(' + v.length + ') ' : ''), Array.isArray(v) ? '' : ctorName(v) + ' ', '[', parts, ']');
      }
      if (type === 'Map' || type === 'Set') {
        var items = [], c = 0;
        v.forEach(function (val, key) {
          if (c++ >= 5) return;
          if (items.length) items.push(', ');
          if (type === 'Map') items.push(shortPreview(key), ' => ', shortPreview(val)); else items.push(shortPreview(val));
        });
        if (v.size > 5) items.push(', \u2026');
        return h('span', null, type + '(' + v.size + ') {', items, '}');
      }
      if (type === 'Promise') return h('span', null, 'Promise');
      var keys = Object.keys(v), out = [], name = ctorName(v);
      for (var j = 0; j < Math.min(keys.length, 5); j++) {
        if (j) out.push(', ');
        var val; try { val = v[keys[j]]; } catch (e) { val = '(\u2026)'; }
        out.push(h('span', { class: 'v-key' }, keys[j]), ': ', shortPreview(val));
      }
      if (keys.length > 5) out.push(', \u2026');
      return h('span', null, name !== 'Object' ? name + ' ' : '', '{', out, '}');
    } catch (e) { return h('span', null, type); }
  }

  function expandable(obj, head, startOpen) {
    var wrap = h('span', { class: 'obj' });
    var tri = h('span', { class: 'tri' }, '\u25b6');
    var hd = h('span', { class: 'obj-head' }, tri, head);
    var body = null;
    function toggle(e) {
      if (e) e.stopPropagation();
      if (body) { body.remove(); body = null; tri.textContent = '\u25b6'; return; }
      tri.textContent = '\u25bc';
      body = h('span', { class: 'obj-body' });
      fillProps(body, obj);
      wrap.append(body);
    }
    hd.addEventListener('click', toggle);
    wrap.append(hd);
    if (startOpen) toggle();
    return wrap;
  }

  function fillProps(body, obj) {
    var type = safeType(obj);
    function row(key, val, nonEnum) {
      body.append(h('div', { class: 'prop' }, h('span', { class: 'v-key' + (nonEnum ? ' np' : '') }, key), ': ', renderValue(val)));
    }
    try {
      if (type === 'Map') { var i = 0; obj.forEach(function (val, key) { if (i < MAX_PROPS) { body.append(h('div', { class: 'prop' }, h('span', { class: 'v-key' }, String(i++)), ': {', renderValue(key), ' => ', renderValue(val), '}')); } }); }
      if (type === 'Set') { var j = 0; obj.forEach(function (val) { if (j < MAX_PROPS) row(String(j++), val); }); }
      var keys = Reflect.ownKeys(obj), shown = 0;
      keys.forEach(function (k) {
        if (shown++ > MAX_PROPS) return;
        var d; try { d = Object.getOwnPropertyDescriptor(obj, k); } catch (e) {}
        var label = typeof k === 'symbol' ? k.toString() : k;
        if (d && d.get && !('value' in d)) {
          var g = h('span', { class: 'muted', style: { cursor: 'pointer' }, title: 'Invoke property getter' }, '(\u2026)');
          g.addEventListener('click', function (e) { e.stopPropagation(); var r; try { r = obj[k]; } catch (er) { r = er; } g.replaceWith(renderValue(r)); });
          body.append(h('div', { class: 'prop' }, h('span', { class: 'v-key' }, label), ': ', g));
        } else {
          var val; try { val = obj[k]; } catch (e) { val = e; }
          row(label, val, d && !d.enumerable);
        }
      });
      if (keys.length > MAX_PROPS) body.append(h('div', { class: 'muted' }, '\u2026 ' + (keys.length - MAX_PROPS) + ' more'));
      var proto = Object.getPrototypeOf(obj);
      if (proto) body.append(h('div', { class: 'prop' }, h('span', { class: 'v-key np' }, '[[Prototype]]'), ': ', expandable(proto, h('span', null, ctorName(proto) === 'Object' && proto === Object.prototype ? 'Object' : ctorName(proto)))));
    } catch (e) { body.append(h('div', { class: 'muted' }, String(e))); }
  }

  function nodeLabel(n) {
    if (n.nodeType === 1) {
      var s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      if (typeof n.className === 'string' && n.className.trim()) s += '.' + n.className.trim().split(/\s+/).join('.');
      return s;
    }
    if (n.nodeType === 3) return '"' + n.data.slice(0, 40) + '"';
    if (n.nodeType === 9) return '#document';
    if (n.nodeType === 11) return n.host ? '#shadow-root' : '#document-fragment';
    return n.nodeName;
  }
  function nodeRef(n) {
    var el = h('span', { class: 'noderef', title: 'Click to reveal in Elements' }, nodeLabel(n));
    el.addEventListener('mouseenter', function () { highlight(n.nodeType === 1 ? n : n.parentElement); });
    el.addEventListener('mouseleave', hideHighlight);
    el.addEventListener('click', function (e) { e.stopPropagation(); hideHighlight(); inspect(n.nodeType === 1 || n.nodeType === 3 ? n : n.documentElement || n.host || document.body); });
    return el;
  }

  /* ---------------------------------------------------------------- console */
  function buildConsole() {
    var v = h('div', { class: 'view' });
    var filter = h('input', { class: 'filter', placeholder: 'Filter', type: 'search' });
    filter.addEventListener('input', function () { state.conFilter = filter.value.toLowerCase(); refilterLogs(); });
    var chips = h('span', { style: { display: 'flex', gap: '2px' } });
    [['verbose', 'Verbose'], ['info', 'Info'], ['warn', 'Warnings'], ['error', 'Errors']].forEach(function (p) {
      var c = h('button', { class: 'chip' + (state.conLevels[p[0]] ? ' on' : '') }, p[1]);
      c.addEventListener('click', function () { state.conLevels[p[0]] = !state.conLevels[p[0]]; c.classList.toggle('on', state.conLevels[p[0]]); refilterLogs(); });
      chips.append(c);
    });
    var tb = h('div', { class: 'toolbar' },
      h('button', { class: 'ibtn', title: 'Clear console', onclick: function () { clearConsole(); } }, icon('clear')),
      h('div', { class: 'sep' }), filter, chips);

    ui.conList = h('div', { class: 'con-list' });
    ui.conRows = h('div');
    var input = h('textarea', { rows: 1, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', placeholder: '' });
    ui.input = input;
    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', onPromptKey);
    var prompt = h('div', { class: 'prompt' }, h('span', { class: 'ico' }, '\u203a'), input);
    ui.conList.append(ui.conRows, prompt);
    ui.conList.addEventListener('click', function (e) {
      if (e.target === ui.conList && !String(window.getSelection && window.getSelection())) input.focus();
    });
    v.append(tb, ui.conList);
    return v;
  }
  function autoGrow() { ui.input.style.height = 'auto'; ui.input.style.height = ui.input.scrollHeight + 'px'; }

  function logVisible(e) {
    if (e.kind === 'input' || e.kind === 'result' || e.kind === 'system') return !state.conFilter || (e.text || '').indexOf(state.conFilter) !== -1;
    if (!state.conLevels[e.level]) return false;
    if (state.conFilter) {
      if (e.text == null) e.text = (e.row ? e.row.textContent : '').toLowerCase();
      return e.text.indexOf(state.conFilter) !== -1;
    }
    return true;
  }
  function refilterLogs() { state.logs.forEach(function (e) { if (e.row) e.row.style.display = logVisible(e) ? '' : 'none'; }); }

  function formatArgs(args) {
    var out = [], i = 0;
    if (typeof args[0] === 'string' && /%[sdifoOc%]/.test(args[0])) {
      var fmt = args[0], style = '', last = 0, re = /%([sdifoOc%])/g, m;
      i = 1;
      var pushText = function (t) { if (!t) return; var s = h('span', null, t); if (style) s.setAttribute('style', style); out.push(s); };
      while ((m = re.exec(fmt))) {
        pushText(fmt.slice(last, m.index)); last = re.lastIndex;
        var t = m[1];
        if (t === '%') { pushText('%'); continue; }
        if (i >= args.length) { pushText(m[0]); continue; }
        var a = args[i++];
        if (t === 'c') style = String(a).replace(/url\s*\(|position\s*:|expression/gi, '');
        else if (t === 's') pushText(String(a));
        else if (t === 'd' || t === 'i') pushText(isNaN(+a) ? 'NaN' : String(Math.trunc(+a)));
        else if (t === 'f') pushText(String(+a));
        else out.push(renderValue(a));
      }
      pushText(fmt.slice(last));
    }
    for (; i < args.length; i++) { if (out.length) out.push(' '); out.push(renderValue(args[i], { top: true })); }
    return out;
  }

  function appendLogRow(e) {
    var icoChar = e.kind === 'input' ? '\u203a' : e.kind === 'result' ? '\u2039' : e.kind === 'group' ? '\u25bc' : e.level === 'error' ? '\u2716' : e.level === 'warn' ? '\u26a0' : '';
    var msg = h('div', { class: 'msg' });
    if (e.kind === 'input') msg.append(e.code);
    else if (e.kind === 'result') msg.append(renderValue(e.args[0]));
    else {
      if (e.kind === 'uncaught') msg.append('Uncaught ');
      append(msg, formatArgs(e.args));
    }
    var row = h('div', { class: 'log ' + e.level + ' ' + e.kind }, h('span', { class: 'ico' }, icoChar), msg);
    if (e.depth) row.style.paddingLeft = (6 + e.depth * 16) + 'px';
    e.cntEl = h('span', { class: 'cnt' }, String(e.count));
    if (e.count < 2) e.cntEl.style.display = 'none';
    row.insertBefore(e.cntEl, msg);
    if (e.site) row.append(srcLink(e.site, 'site'));
    e.row = row;
    e.text = e.kind === 'input' ? e.code.toLowerCase() : null;
    if (e.text == null && state.conFilter) e.text = row.textContent.toLowerCase();
    if (!logVisible(e)) row.style.display = 'none';
    var stick = nearBottom();
    ui.conRows.append(row);
    if (stick) scrollConsole();
  }
  function updateLogCount(e) { if (e.cntEl) { e.cntEl.textContent = e.count; e.cntEl.style.display = ''; } if (nearBottom()) scrollConsole(); }
  function nearBottom() { var l = ui.conList; return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 40; }
  function scrollConsole() { if (ui.conList) ui.conList.scrollTop = ui.conList.scrollHeight; }
  function clearConsole() {
    state.logs.length = 0; state.errors = 0; state.warns = 0;
    if (ui.ready) { clear(ui.conRows); updateBadges(); }
  }

  function onPromptKey(e) {
    var ta = ui.input;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var code = ta.value;
      if (!code.trim()) return;
      state.history.push(code); state.histIdx = state.history.length;
      ta.value = ''; autoGrow();
      runCode(code);
    } else if (e.key === 'ArrowUp' && ta.selectionStart === 0 && state.history.length) {
      e.preventDefault(); state.histIdx = Math.max(0, state.histIdx - 1); ta.value = state.history[state.histIdx]; autoGrow();
    } else if (e.key === 'ArrowDown' && ta.selectionEnd === ta.value.length && state.history.length) {
      e.preventDefault(); state.histIdx = Math.min(state.history.length, state.histIdx + 1); ta.value = state.history[state.histIdx] || ''; autoGrow();
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); clearConsole(); }
  }

  function installHelpers() {
    window.$0 = state.selected;
    if (window.$ === undefined) { window.$ = function (s, r) { return (r || document).querySelector(s); }; window.$.__sdt = true; }
    if (window.$$ === undefined) { window.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }; window.$$.__sdt = true; }
    if (window.copy === undefined) { window.copy = function (v) { copyText(typeof v === 'string' ? v : JSON.stringify(v, null, 2)); }; window.copy.__sdt = true; }
    if (window.clear === undefined) { window.clear = function () { clearConsole(); }; window.clear.__sdt = true; }
    if (window.inspect === undefined) { window.inspect = function (n) { inspect(n); }; window.inspect.__sdt = true; }
  }

  function runCode(code) {
    addLog('info', [], { kind: 'input', code: code, site: null });
    installHelpers();
    var src = code.replace(/^(let|const)(\s)/gm, 'var$2');
    if (/^\s*\{[\s\S]*\}\s*$/.test(src)) { try { new Function('return (' + src + ')'); src = '(' + src + ')'; } catch (e) {} }
    var result, threw = false;
    try { result = (0, eval)(src); }
    catch (err) { threw = true; result = err; }
    if (threw) { addLog('error', [result instanceof Error ? result.name + ': ' + result.message : result], { kind: 'uncaught', site: null }); return; }
    var entry = addLog('info', [result], { kind: 'result', site: null });
    if (result && typeof result.then === 'function' && entry && entry.row) {
      var msg = entry.row.querySelector('.msg');
      clear(msg).append('Promise {', h('span', { class: 'v-null' }, '<pending>'), '}');
      result.then(function (val) { clear(msg).append('Promise {', h('span', { class: 'v-null' }, '<fulfilled>'), ': ', renderValue(val), '}'); },
        function (err) { clear(msg).append('Promise {', h('span', { class: 'v-null' }, '<rejected>'), ': ', renderValue(err), '}'); });
    }
  }

  /* --------------------------------------------------------------- elements */
  var rowOrder = [], rowByNode = new Map();
  function buildElements() {
    var v = h('div', { class: 'view' });
    ui.tree = h('div', { class: 'tree', tabindex: '0' });
    ui.tree.addEventListener('keydown', onTreeKey);
    ui.crumbs = h('div', { class: 'crumbs' });
    var left = h('div', { class: 'left' }, ui.tree, ui.crumbs);

    ui.sideTabs = h('div', { class: 'side-tabs' });
    ['Styles', 'Computed'].forEach(function (n) {
      var t = h('div', { class: 'tab' + (state.sideTab === n ? ' on' : '') }, n);
      t.addEventListener('click', function () { state.sideTab = n; Array.prototype.forEach.call(ui.sideTabs.children, function (c) { c.classList.toggle('on', c === t); }); renderSide(); });
      ui.sideTabs.append(t);
    });
    ui.sideTabs.append(h('div', { class: 'grow' }), h('button', { class: 'ibtn', title: 'Refresh', onclick: function () { renderTree(); renderSide(); } }, icon('refresh')));
    ui.side = h('div', { class: 'styles' });
    var right = h('div', { class: 'right' }, ui.sideTabs, ui.side);
    v.append(h('div', { class: 'split' }, left, right));

    var mo = new MutationObserver(function (records) {
      if (!state.open || state.tab !== 'elements') return;
      for (var i = 0; i < records.length; i++) {
        var t = records[i].target;
        if (t === host || (host && host.contains(t))) continue;
        if (records[i].type === 'childList' && t === document.body && Array.prototype.every.call(records[i].addedNodes, function (n) { return n === host; }) && !records[i].removedNodes.length) continue;
        return treeRefresh();
      }
    });
    var treeRefresh = debounce(function () { if (!ui.editing) { renderTree(); if (state.sideTab === 'Computed') renderSide(); } }, 250);
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    return v;
  }

  function nodeChildren(n) {
    var kids = [];
    if (n.nodeType === 1 && n.shadowRoot) kids.push(n.shadowRoot);
    var cn = n.childNodes;
    for (var i = 0; i < cn.length; i++) {
      var c = cn[i];
      if (c === host) continue;
      if (c.nodeType === 3 && !c.data.trim()) continue;
      if (c.nodeType === 1 || c.nodeType === 3 || c.nodeType === 8) kids.push(c);
    }
    return kids;
  }
  function parentOf(n) { var p = n.parentNode; return p; }

  function renderTree() {
    if (!ui.tree) return;
    var st = ui.tree.scrollTop, sl = ui.tree.scrollLeft;
    clear(ui.tree); rowOrder = []; rowByNode = new Map();
    if (state.selected && !state.selected.isConnected) state.selected = document.body;
    var frag = document.createDocumentFragment();
    if (document.doctype) frag.append(h('div', { class: 'row', style: { paddingLeft: '14px' } }, h('span', { class: 't-shadow' }, '<!DOCTYPE ' + document.doctype.name + '>')));
    renderNode(document.documentElement, 0, frag);
    ui.tree.append(frag);
    ui.tree.scrollTop = st; ui.tree.scrollLeft = sl;
    renderCrumbs();
  }

  function renderNode(n, depth, out) {
    var row = h('div', { class: 'row' });
    row.style.paddingLeft = (depth * 14 + 2) + 'px';
    var kids = nodeChildren(n);
    var open = state.expanded.has(n);
    var tri = h('span', { class: 'tri' }, '');
    row.append(tri);
    rowOrder.push(n); rowByNode.set(n, row);
    if (n === state.selected) row.classList.add('sel');

    if (n.nodeType === 1) {
      var tag = n.tagName.toLowerCase();
      var inline = kids.length === 1 && kids[0].nodeType === 3 && kids[0].data.trim().length <= 80 && !n.shadowRoot;
      var canExpand = kids.length && !inline;
      if (canExpand) tri.textContent = open ? '\u25bc' : '\u25b6';
      var attrs = h('span', { class: 'attrs' });
      Array.prototype.forEach.call(n.attributes, function (a) {
        var span = h('span', null, ' ', h('span', { class: 't-attr' }, a.name));
        if (a.value !== '') span.append('="', h('span', { class: 't-aval' }, a.value.length > 200 ? a.value.slice(0, 200) + '\u2026' : a.value), '"');
        span.addEventListener('dblclick', function (e) { e.stopPropagation(); editAttr(n, span, a.name); });
        attrs.append(span);
      });
      var addAttr = h('span', null, '');
      attrs.append(addAttr);
      row.append(h('span', { class: 't-tag' }, '<' + tag), attrs, h('span', { class: 't-tag' }, '>'));
      row.addEventListener('dblclick', function (e) { if (e.target === row || e.target.classList.contains('t-tag')) editAttr(n, addAttr, null); });
      if (inline) {
        var tx = h('span', { class: 't-text' }, kids[0].data.trim());
        tx.addEventListener('dblclick', function (e) { e.stopPropagation(); editText(kids[0], tx); });
        row.append(tx, h('span', { class: 't-tag' }, '</' + tag + '>'));
      } else if (canExpand && !open) row.append(h('span', { class: 'muted' }, '\u2026'), h('span', { class: 't-tag' }, '</' + tag + '>'));
      else if (!canExpand && !/^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/.test(tag)) row.append(h('span', { class: 't-tag' }, '</' + tag + '>'));
      out.append(row);
      if (canExpand && open) {
        kids.forEach(function (k) { renderNode(k, depth + 1, out); });
        var close = h('div', { class: 'row' }, h('span', { class: 'tri' }), h('span', { class: 't-tag' }, '</' + tag + '>'));
        close.style.paddingLeft = (depth * 14 + 2) + 'px';
        out.append(close);
      }
    } else if (n.nodeType === 11) {
      if (kids.length) tri.textContent = open ? '\u25bc' : '\u25b6';
      row.append(h('span', { class: 't-shadow' }, '#shadow-root (' + (n.mode || 'open') + ')'));
      out.append(row);
      if (open) kids.forEach(function (k) { renderNode(k, depth + 1, out); });
    } else if (n.nodeType === 3) {
      var t = h('span', { class: 't-text' }, '"' + (n.data.length > 300 ? n.data.slice(0, 300) + '\u2026' : n.data.trim()) + '"');
      t.addEventListener('dblclick', function (e) { e.stopPropagation(); editText(n, t); });
      row.append(t); out.append(row);
    } else if (n.nodeType === 8) {
      row.append(h('span', { class: 't-cmt' }, '<!--' + n.data + '-->')); out.append(row);
    }

    tri.addEventListener('click', function (e) { e.stopPropagation(); toggleExpand(n); });
    row.addEventListener('click', function () { selectNode(n, false); ui.tree.focus({ preventScroll: true }); });
    row.addEventListener('mouseenter', function () { highlight(n.nodeType === 1 ? n : (n.host || n.parentElement)); });
    row.addEventListener('mouseleave', hideHighlight);
  }

  function toggleExpand(n, force) {
    var open = force !== undefined ? force : !state.expanded.has(n);
    if (open) state.expanded.add(n); else state.expanded.delete(n);
    renderTree();
  }

  function selectNode(n, reveal) {
    if (!n) return;
    state.selected = n; window.$0 = n;
    if (reveal) {
      var p = parentOf(n);
      while (p) { state.expanded.add(p); if (p.nodeType === 11 && p.host) { state.expanded.add(p.host); p = parentOf(p.host); } else p = parentOf(p); }
      renderTree();
      var r = rowByNode.get(n); if (r) r.scrollIntoView({ block: 'center' });
    } else {
      rowByNode.forEach(function (row, node) { row.classList.toggle('sel', node === n); });
      renderCrumbs();
    }
    renderSide();
  }

  function inspect(n) {
    if (!n) return;
    if (!state.open) show();
    switchTab('elements');
    selectNode(n, true);
  }

  function onTreeKey(e) {
    var n = state.selected; if (!n) return;
    if (ui.editing) return;
    var i = rowOrder.indexOf(n);
    if (e.key === 'ArrowDown' && i < rowOrder.length - 1) { e.preventDefault(); selectNode(rowOrder[i + 1]); scrollSel(); }
    else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); selectNode(rowOrder[i - 1]); scrollSel(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (!state.expanded.has(n) && nodeChildren(n).length) toggleExpand(n, true); else if (rowOrder[i + 1]) { selectNode(rowOrder[i + 1]); scrollSel(); } }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (state.expanded.has(n)) toggleExpand(n, false); else { var p = parentOf(n); if (p && p.nodeType !== 9) { selectNode(p.nodeType === 11 ? p : p); scrollSel(); } } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && n.parentNode && n !== document.documentElement && n !== document.body && n.nodeType !== 11) {
      e.preventDefault(); var next = rowOrder[i + 1] || rowOrder[i - 1]; var parent = n.parentNode; n.remove(); state.selected = (next && next.isConnected) ? next : parent; renderTree(); renderSide();
    }
  }
  function scrollSel() { var r = rowByNode.get(state.selected); if (r) r.scrollIntoView({ block: 'nearest' }); }

  function renderCrumbs() {
    if (!ui.crumbs) return;
    clear(ui.crumbs);
    var chain = [], n = state.selected;
    while (n && n.nodeType !== 9) { chain.unshift(n); n = n.nodeType === 11 ? n.host : n.parentNode; }
    chain.forEach(function (c, i) {
      if (c.nodeType === 11) return;
      var cr = h('span', { class: 'crumb' + (i === chain.length - 1 ? ' last' : '') }, c.nodeType === 1 ? nodeLabel(c) : '#text');
      cr.addEventListener('click', function () { selectNode(c, true); });
      cr.addEventListener('mouseenter', function () { highlight(c.nodeType === 1 ? c : c.parentElement); });
      cr.addEventListener('mouseleave', hideHighlight);
      ui.crumbs.append(cr);
    });
    ui.crumbs.scrollLeft = ui.crumbs.scrollWidth;
  }

  // opts.suggest(value) -> [{ label, value, hint, swatch }]  (value = full new input text)
  function inlineEdit(el, initial, commit, opts) {
    if (ui.editing) return;
    opts = opts || {};
    ui.editing = true;
    var before = el.textContent;
    var input = h('input', { class: 'ed', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
    input.value = initial;
    function size() { input.size = Math.max(2, input.value.length + 1); }
    size();
    clear(el).append(input);
    input.focus();
    input.select();
    var done = false, items = [], active = -1;

    function closeAc() { items = []; active = -1; if (ui.ac) ui.ac.style.display = 'none'; }
    function renderAc() {
      if (!opts.suggest) return;
      items = opts.suggest(input.value) || [];
      if (!items.length) return closeAc();
      if (!ui.ac) { ui.ac = h('div', { class: 'ac' }); root.append(ui.ac); }
      var ac = clear(ui.ac);
      active = 0;
      items.forEach(function (it, i) {
        var row = h('div', { class: 'ac-item' + (i === 0 ? ' on' : '') },
          it.swatch ? h('span', { class: 'swatch', style: { background: it.swatch } }) : null,
          h('span', { class: 'ac-label' }, highlightMatch(it.label, it.match || '')),
          it.hint ? h('span', { class: 'ac-hint' }, it.hint) : null);
        row.addEventListener('mousedown', function (e) { e.preventDefault(); active = i; accept(true); });
        row.addEventListener('mouseenter', function () { setActive(i); });
        ac.append(row);
      });
      ac.style.display = 'block';
      var r = input.getBoundingClientRect(), hgt = Math.min(ac.scrollHeight, 220);
      ac.style.left = Math.max(4, Math.min(window.innerWidth - ac.offsetWidth - 4, r.left)) + 'px';
      ac.style.top = (r.bottom + hgt + 4 < window.innerHeight ? r.bottom + 2 : Math.max(4, r.top - hgt - 2)) + 'px';
      ac.scrollTop = 0;
    }
    function setActive(i) {
      if (!ui.ac || !items.length) return;
      active = (i + items.length) % items.length;
      Array.prototype.forEach.call(ui.ac.children, function (c, j) { c.classList.toggle('on', j === active); });
      var cur = ui.ac.children[active]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    // Apply the highlighted suggestion; returns true if one was applied.
    function accept(andFinish) {
      if (active < 0 || !items[active]) return false;
      input.value = items[active].value; size(); closeAc();
      if (andFinish) finish(true);
      return true;
    }
    function finish(ok) {
      if (done) return; done = true;
      closeAc();
      var val = input.value;
      ui.editing = false;
      el.textContent = ok ? val : before;
      if (ok) commit(val);
    }
    input.addEventListener('input', function () { size(); renderAc(); });
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      var open = items.length > 0;
      if (open && e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (open && e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (open) accept(false); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); if (open) closeAc(); else finish(false); }
      else if (e.key === 'Tab') { e.preventDefault(); if (open) accept(false); finish(true); if (el.__next) el.__next(); }
      else if (open && e.key === 'ArrowRight' && input.selectionStart === input.value.length) { e.preventDefault(); accept(false); renderAc(); }
    });
    input.addEventListener('blur', function () { finish(true); });
    if (opts.suggest && opts.showOnOpen) renderAc();
  }

  function highlightMatch(text, q) {
    if (!q) return text;
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    return [text.slice(0, i), h('b', null, text.slice(i, i + q.length)), text.slice(i + q.length)];
  }

  /* ------------------------------------------------------- CSS suggestions */
  var SHORTHANDS = ['all', 'animation', 'background', 'border', 'border-block', 'border-bottom', 'border-color', 'border-image', 'border-inline', 'border-left', 'border-radius', 'border-right', 'border-style', 'border-top', 'border-width', 'column-rule', 'columns', 'container', 'flex', 'flex-flow', 'font', 'gap', 'grid', 'grid-area', 'grid-column', 'grid-row', 'grid-template', 'inset', 'inset-block', 'inset-inline', 'list-style', 'margin', 'margin-block', 'margin-inline', 'mask', 'offset', 'outline', 'overflow', 'overscroll-behavior', 'padding', 'padding-block', 'padding-inline', 'place-content', 'place-items', 'place-self', 'scroll-margin', 'scroll-padding', 'text-decoration', 'text-emphasis', 'transition'];
  var KEYWORDS = ('auto none normal block inline inline-block flex inline-flex grid inline-grid contents table table-row table-cell list-item flow-root ' +
    'hidden visible scroll clip static relative absolute fixed sticky row row-reverse column column-reverse wrap nowrap wrap-reverse ' +
    'start end center flex-start flex-end left right top bottom baseline stretch space-between space-around space-evenly self-start self-end ' +
    'bold bolder lighter italic oblique uppercase lowercase capitalize underline overline line-through solid dashed dotted double groove ridge inset outset ' +
    'pointer default text move grab grabbing not-allowed wait help crosshair progress zoom-in zoom-out text-top text-bottom middle sub super ' +
    'pre pre-wrap pre-line break-spaces break-word break-all keep-all anywhere ellipsis border-box content-box padding-box cover contain fill ' +
    'repeat no-repeat repeat-x repeat-y round space transparent currentcolor black white red green blue gray orange purple yellow pink ' +
    'ease ease-in ease-out ease-in-out linear step-start step-end infinite alternate alternate-reverse forwards backwards both running paused all smooth ' +
    'thin medium thick small large x-small x-large xx-large larger smaller max-content min-content fit-content dense collapse separate ' +
    'disc circle square decimal inside outside isolate multiply screen overlay darken lighten horizontal vertical x y mandatory proximity ' +
    'nearest balance pretty manual subgrid masonry tabular-nums antialiased subpixel-antialiased optimizeLegibility').split(' ');
  var GLOBAL_KW = ['inherit', 'initial', 'unset', 'revert', 'revert-layer'];
  var propNamesCache = null, kwCache = {}, customCache = { root: null, at: 0, names: [] };

  function cssPropNames() {
    if (propNamesCache) return propNamesCache;
    var set = {};
    try { var cs = getComputedStyle(document.documentElement); for (var i = 0; i < cs.length; i++) set[cs[i]] = 1; } catch (e) {}
    SHORTHANDS.forEach(function (n) { try { if (!window.CSS || window.CSS.supports(n, 'inherit')) set[n] = 1; } catch (e) {} });
    propNamesCache = Object.keys(set).sort(function (a, b) { return (a.charAt(0) === '-') - (b.charAt(0) === '-') || (a < b ? -1 : 1); });
    return propNamesCache;
  }
  // Custom properties (--*) declared in the element's tree scope and in the document.
  function customPropNames(el) {
    var rootNode = el && el.getRootNode ? el.getRootNode() : document;
    if (customCache.root === rootNode && Date.now() - customCache.at < 5000) return customCache.names;
    var set = {};
    function fromStyle(st) { for (var i = 0; i < st.length; i++) if (st[i].indexOf('--') === 0) set[st[i]] = 1; }
    function walk(rules) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.style) fromStyle(r.style);
        if (r.cssRules) walk(r.cssRules);
        if (r.styleSheet) { try { walk(r.styleSheet.cssRules); } catch (e) {} }
      }
    }
    var roots = [document];
    for (var n = el; n; n = inheritParent(n)) { var rn = n.getRootNode && n.getRootNode(); if (rn && roots.indexOf(rn) === -1) roots.push(rn); }
    if (el && el.shadowRoot) roots.push(el.shadowRoot);
    roots.forEach(function (rn) { sheetsOf(rn).forEach(function (sh) { try { walk(sh.cssRules); } catch (e) {} }); });
    for (var a = el; a; a = inheritParent(a)) { try { fromStyle(a.style); } catch (e) {} }
    customCache = { root: rootNode, at: Date.now(), names: Object.keys(set).sort() };
    return customCache.names;
  }
  function keywordsFor(prop) {
    if (kwCache[prop]) return kwCache[prop];
    var list = [];
    if (window.CSS && window.CSS.supports && prop.indexOf('--') !== 0) {
      KEYWORDS.forEach(function (k) { try { if (window.CSS.supports(prop, k)) list.push(k); } catch (e) {} });
    }
    kwCache[prop] = list.concat(GLOBAL_KW);
    return kwCache[prop];
  }
  function rankMatches(cands, q, limit) {
    var lq = q.toLowerCase(), pre = [], sub = [];
    cands.forEach(function (c) {
      var lc = c.toLowerCase();
      if (!lq || lc.indexOf(lq) === 0) pre.push(c);
      else if (lc.indexOf(lq) > 0 || (lq.length > 2 && lc.replace(/-/g, '').indexOf(lq.replace(/-/g, '')) !== -1)) sub.push(c);
    });
    if (lq) pre.sort(function (a, b) { return (a.toLowerCase() === lq ? -1 : 0) - (b.toLowerCase() === lq ? -1 : 0) || a.length - b.length; });
    return pre.concat(sub).slice(0, limit || 50);
  }
  function resolvedVar(el, name) {
    try { return getComputedStyle(el).getPropertyValue(name).trim(); } catch (e) { return ''; }
  }
  function looksColor(v) { return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()/i.test(v); }

  function suggestPropName(el) {
    return function (value) {
      var q = value.trim();
      if (!q || q.indexOf(':') !== -1) return [];
      var names = q.indexOf('--') === 0 ? customPropNames(el) : cssPropNames().concat(q.charAt(0) === '-' ? customPropNames(el) : []);
      return rankMatches(names, q, 40).map(function (n) {
        var hint = n.indexOf('--') === 0 ? resolvedVar(el, n) : '';
        return { label: n, value: n, match: q, hint: hint.length > 28 ? hint.slice(0, 28) + '\u2026' : hint, swatch: looksColor(hint) ? hint : null };
      });
    };
  }
  function suggestPropValue(el, getProp) {
    return function (value) {
      var prop = (getProp() || '').trim();
      // complete only the last token: after a space, comma or "("
      var m = value.match(/^(.*?[\s,(])?([^\s,(]*)$/);
      var head = (m && m[1]) || '', tok = (m && m[2]) || '';
      var out = [];
      if (tok.indexOf('--') === 0 || /var\($/.test(head)) {
        var inVar = /var\($/.test(head);
        rankMatches(customPropNames(el), tok, 40).forEach(function (n) {
          var v = resolvedVar(el, n);
          out.push({ label: n, value: inVar ? head + n + ')' : head + 'var(' + n + ')', match: tok, hint: v.length > 28 ? v.slice(0, 28) + '\u2026' : v, swatch: looksColor(v) ? v : null });
        });
        return out;
      }
      if (prop.indexOf('--') === 0 && !tok) return [];
      if ('var('.indexOf(tok.toLowerCase()) === 0 && tok) out.push({ label: 'var(', value: head + 'var(', match: tok, hint: 'custom property' });
      rankMatches(keywordsFor(prop), tok, 40).forEach(function (k) {
        out.push({ label: k, value: head + k, match: tok, swatch: /color|background|fill|stroke|border|outline|shadow|caret|accent/.test(prop) && looksColorName(k) ? k : null });
      });
      return out;
    };
  }
  function looksColorName(k) { return /^(black|white|red|green|blue|gray|orange|purple|yellow|pink|transparent|currentcolor)$/.test(k); }

  function editAttr(node, span, name) {
    var initial = name ? name + '="' + node.getAttribute(name) + '"' : '';
    inlineEdit(span, initial, function (text) {
      text = text.trim();
      try {
        var t = document.createElement('template');
        t.innerHTML = '<div ' + text + '></div>';
        var d = t.content.firstChild;
        if (name) node.removeAttribute(name);
        if (d) Array.prototype.forEach.call(d.attributes, function (a) { node.setAttribute(a.name, a.value); });
      } catch (e) { addLog('error', ['Could not set attribute: ' + e.message], { site: null }); }
      renderTree(); renderSide();
    });
  }
  function editText(textNode, span) {
    inlineEdit(span, textNode.data, function (text) { textNode.data = text; renderTree(); });
  }

  /* ----------------------------------------------------------------- styles */
  var disabledDecls = new WeakMap();
  function disabledFor(decl) { var m = disabledDecls.get(decl); if (!m) { m = new Map(); disabledDecls.set(decl, m); } return m; }

  function parseDecls(text) {
    var out = [], depth = 0, q = null, start = 0;
    for (var i = 0; i <= text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === q && text[i - 1] !== '\\') q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if ((ch === ';' && depth === 0) || i === text.length) {
        var part = text.slice(start, i).trim(); start = i + 1;
        if (!part) continue;
        var c = part.indexOf(':'); if (c < 0) continue;
        var name = part.slice(0, c).trim(), value = part.slice(c + 1).trim(), imp = false;
        if (/!\s*important$/i.test(value)) { imp = true; value = value.replace(/\s*!\s*important$/i, ''); }
        out.push({ name: name, value: value, imp: imp });
      }
    }
    return out;
  }

  function splitSelectors(s) {
    var out = [], depth = 0, start = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
    }
    out.push(s.slice(start).trim());
    return out;
  }
  function specificity(sel) {
    sel = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').replace(/:(?:not|is|has|matches)\(((?:[^()]|\([^()]*\))*)\)/g, ' $1 ');
    var pe = (sel.match(/::[\w-]+/g) || []).length; sel = sel.replace(/::[\w-]+(\([^)]*\))?/g, '');
    var a = (sel.match(/#[\w-]+/g) || []).length;
    var attrs = (sel.match(/\[[^\]]*\]/g) || []).length; sel = sel.replace(/\[[^\]]*\]/g, '');
    var b = attrs + (sel.match(/\.[\w-]+|:[\w-]+(\([^)]*\))?/g) || []).length;
    var c = pe + (sel.replace(/[#.:][\w-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
    return a * 10000 + b * 100 + c;
  }

  // hostMode: match ":host" / ":host(sel)" rules from el's own shadow root against el.
  function collectRules(el, sheetList, hostMode) {
    var out = [], order = 0, blocked = [];
    function test(s) {
      if (!hostMode) { try { return el.matches(s) ? specificity(s) : -1; } catch (e) { return -1; } }
      var m = s.match(/^:host(?:\((.*)\))?$/);
      if (!m) return -1;
      if (!m[1]) return 100;
      try { return el.matches(m[1]) ? 100 + specificity(m[1]) : -1; } catch (e) { return -1; }
    }
    function walk(rules, label, sheet) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.selectorText !== undefined && r.style) {
          var best = -1;
          splitSelectors(r.selectorText).forEach(function (sel) { best = Math.max(best, test(sel)); });
          if (best >= 0) out.push({ rule: r, label: label, spec: best, order: order++, sheet: sheet });
          if (r.cssRules && r.cssRules.length) walk(r.cssRules, label, sheet);
        } else if (r.media && r.cssRules) {
          var mt = r.media.mediaText;
          if (!mt || !window.matchMedia || window.matchMedia(mt).matches) walk(r.cssRules, label + ' @media ' + mt, sheet);
        } else if (r.styleSheet) {
          walkSheet(r.styleSheet);
        } else if (r.cssRules) {
          if (typeof CSSSupportsRule !== 'undefined' && r instanceof CSSSupportsRule && window.CSS && window.CSS.supports && !window.CSS.supports(r.conditionText)) continue;
          walk(r.cssRules, label, sheet);
        }
      }
    }
    function walkSheet(sheet) {
      if (sheet.disabled) return;
      try { if (sheet.media && sheet.media.mediaText && window.matchMedia && !window.matchMedia(sheet.media.mediaText).matches) return; } catch (e) {}
      var label = sheet.href ? sheet.href.split(/[?#]/)[0].split('/').pop() : (sheet.ownerNode ? '<style>' : 'constructed');
      var rules; try { rules = sheet.cssRules; } catch (e) { blocked.push(sheet.href || label); return; }
      if (rules) walk(rules, label, sheet);
    }
    (sheetList || sheetsOf(el.getRootNode ? el.getRootNode() : document)).forEach(walkSheet);
    out.sort(function (x, y) { return (y.spec - x.spec) || (y.order - x.order); });
    return { rules: out, blocked: blocked };
  }
  function sheetsOf(rootNode) {
    if (!rootNode) return [];
    return Array.prototype.slice.call(rootNode.styleSheets || []).concat(Array.prototype.slice.call(rootNode.adoptedStyleSheets || []));
  }

  // Flat-tree parent: slotted elements inherit from their <slot>, shadow children from the host.
  function inheritParent(n) {
    if (n.assignedSlot) return n.assignedSlot;
    if (n.parentElement) return n.parentElement;
    var p = n.parentNode;
    return p && p.nodeType === 11 && p.host ? p.host : null;
  }

  var INHERITED = /^(--|color$|cursor$|direction$|font(-|$)|line-height$|letter-spacing$|word-spacing$|text-(align|align-last|indent|transform|shadow|rendering|underline-position|wrap|justify|size-adjust|emphasis)|white-space|word-break$|overflow-wrap$|word-wrap$|hyphens$|tab-size$|visibility$|list-style|quotes$|caption-side$|border-collapse$|border-spacing$|empty-cells$|writing-mode$|text-orientation$|color-scheme$|accent-color$|caret-color$|pointer-events$|image-rendering$|paint-order$|fill|stroke|marker|clip-rule$|orphans$|widows$|-webkit-(font-smoothing|text-fill-color|text-stroke|text-security|line-clamp|text-size-adjust|tap-highlight-color|locale|rtl-ordering|user-modify)|-moz-osx-font-smoothing$)/;
  function isInherited(name) { return INHERITED.test(name); }

  // User-agent styles: Safari doesn't expose its UA stylesheet, so we measure it.
  // A same-tag element inside a blank, stylesheet-free iframe is compared with a
  // neutral element; whatever differs is what the UA stylesheet sets.
  var uaFrame = null, uaCache = new Map();
  var UA_ATTRS = ['type', 'hidden', 'dir', 'open', 'multiple', 'size', 'disabled', 'popover', 'contenteditable', 'controls', 'lang', 'role'];
  var UA_SKIP = /^(width|height|inline-size|block-size|transform-origin|perspective-origin|-webkit-locale|font-family|math-|baseline-source|(margin|padding|border|scroll-margin|scroll-padding)-(block|inline)|inset-|(min|max)-(block|inline)-size)/;
  function uaStyles(el) {
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return [];
    var tag = el.localName;
    var attrs = UA_ATTRS.filter(function (a) { return el.hasAttribute(a); }).map(function (a) { return [a, el.getAttribute(a)]; });
    var key = tag + '|' + JSON.stringify(attrs);
    if (uaCache.has(key)) return uaCache.get(key);
    var out = [];
    try {
      if (!uaFrame || !uaFrame.contentDocument || !uaFrame.contentDocument.body) {
        uaFrame = h('iframe', { 'aria-hidden': 'true', tabindex: '-1', style: { position: 'fixed', left: '-10000px', top: '0', width: '10px', height: '10px', border: '0', visibility: 'hidden' } });
        root.append(uaFrame);
        var d0 = uaFrame.contentDocument;
        d0.open(); d0.write('<!doctype html><html><head></head><body></body></html>'); d0.close();
      }
      var doc = uaFrame.contentDocument, w = uaFrame.contentWindow;
      var probe = doc.createElement(tag), base = doc.createElement('sdt-probe');
      attrs.forEach(function (a) { try { probe.setAttribute(a[0], a[1]); } catch (e) {} });
      doc.body.append(base, probe);
      var cs = w.getComputedStyle(probe), bs = w.getComputedStyle(base);
      for (var i = 0; i < cs.length; i++) {
        var n = cs[i];
        if (UA_SKIP.test(n)) continue;
        var v = cs.getPropertyValue(n);
        if (v !== bs.getPropertyValue(n)) out.push({ name: n, value: v });
      }
      probe.remove(); base.remove();
      out.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    } catch (e) { out = []; }
    uaCache.set(key, out);
    return out;
  }

  function renderSide() {
    if (!ui.side || state.tab !== 'elements') return;
    var el = state.selected;
    var st = ui.side.scrollTop;
    clear(ui.side);
    if (!el || el.nodeType !== 1) { ui.side.append(h('div', { class: 'note' }, el && el.nodeType === 3 ? 'Text node selected.' : 'Select an element.')); return; }
    if (state.sideTab === 'Computed') renderComputed(el); else renderStyles(el);
    ui.side.scrollTop = st;
  }

  function renderStyles(el) {
    var seen = new Set(), blockedAll = [];
    function covered(name) {
      if (seen.has(name)) return true;
      var hit = false;
      seen.forEach(function (s) { if (!hit && s.charAt(0) !== '-' && name.indexOf(s + '-') === 0) hit = true; });
      return hit;
    }
    // Build all blocks that apply to one element (inline, author rules, :host rules, UA).
    function blocksFor(node, onlyInherited) {
      var list = [];
      var keep = function (d) { return !onlyInherited || isInherited(d.name); };
      list.push({ decl: node.style, selector: 'element.style', label: '', inline: true, filter: onlyInherited ? isInherited : null });
      var res = collectRules(node);
      blockedAll = blockedAll.concat(res.blocked);
      res.rules.forEach(function (r) { list.push({ decl: r.rule.style, selector: r.rule.selectorText, label: r.label, sheet: r.sheet, filter: onlyInherited ? isInherited : null }); });
      if (node.shadowRoot) {
        collectRules(node, sheetsOf(node.shadowRoot), true).rules.forEach(function (r) {
          list.push({ decl: r.rule.style, selector: r.rule.selectorText, label: r.label + ' (shadow root)', sheet: r.sheet, filter: onlyInherited ? isInherited : null });
        });
      }
      list.forEach(function (b) { b.items = parseDecls(b.decl.cssText).filter(keep); });
      var ua = uaStyles(node).filter(keep);
      if (ua.length) list.push({ selector: node.localName, label: 'user agent stylesheet', readonly: true, items: ua.map(function (d) { return { name: d.name, value: d.value }; }) });
      // Inherited sections hide rules with nothing inheritable (inline style always shown for the element itself).
      return list.filter(function (b) { return b.items.length || (!onlyInherited && b.inline) || (b.decl && disabledFor(b.decl).size); });
    }
    function mark(list) {
      list.forEach(function (b) {
        b.items.forEach(function (d) { d.over = covered(d.name); });
        b.items.forEach(function (d) { seen.add(d.name); });
      });
    }

    var own = blocksFor(el, false);
    mark(own);
    own.forEach(function (b) { ui.side.append(ruleBlock(el, b)); });

    for (var a = inheritParent(el); a; a = inheritParent(a)) {
      var inh = blocksFor(a, true);
      if (!inh.length) continue;
      mark(inh);
      var who = h('span', { class: 'noderef' }, nodeLabel(a));
      (function (node) {
        who.addEventListener('click', function () { selectNode(node, true); });
        who.addEventListener('mouseenter', function () { highlight(node); });
        who.addEventListener('mouseleave', hideHighlight);
      })(a);
      ui.side.append(h('div', { class: 'inh-head' }, 'Inherited from ', who));
      inh.forEach(function (b) { ui.side.append(ruleBlock(a, b)); });
    }

    blockedAll = blockedAll.filter(function (x, i) { return blockedAll.indexOf(x) === i; });
    if (blockedAll.length) ui.side.append(h('div', { class: 'note' }, blockedAll.length + ' cross-origin stylesheet(s) can\u2019t be read: ' + blockedAll.join(', ')));
  }

  function ruleBlock(el, b) {
    var blk = h('div', { class: 'rule' + (b.readonly ? ' ua' : '') });
    var srcEl = b.label ? h('span', { class: 'rule-src', title: (b.sheet && b.sheet.href) || b.label }, b.label) : null;
    blk.append(h('div', { class: 'rule-head' }, h('span', { class: 'rule-sel' }, b.selector + ' {'), srcEl));
    if (b.readonly) {
      b.items.forEach(function (d) { blk.append(declRow(el, b, d, false)); });
      blk.append(h('div', null, '}'));
      return blk;
    }
    var disabled = disabledFor(b.decl);
    b.items.forEach(function (d) { if (!disabled.has(d.name)) blk.append(declRow(el, b, d, false)); });
    disabled.forEach(function (v, name) { if (!b.filter || b.filter(name)) blk.append(declRow(el, b, { name: name, value: v.value, imp: v.imp, bad: v.bad }, true)); });
    var add = h('div', { class: 'add-decl', title: 'Click to add a property' });
    add.addEventListener('click', function () { newDecl(el, b, add); });
    blk.append(add, h('div', null, '}'));
    return blk;
  }

  var COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:red|blue|green|black|white|gray|grey|orange|purple|yellow|pink|transparent)\b/i;
  function declRow(el, b, d, off) {
    var cb = h('input', { type: 'checkbox', title: off ? 'Enable' : 'Disable' });
    cb.checked = !off;
    var name = h('span', { class: 'd-name' }, d.name);
    var val = h('span', { class: 'd-val' }, d.value + (d.imp ? ' !important' : ''));
    var cls = 'decl' + (off ? ' off' : '') + (d.over && !off ? ' over' : '') + (d.bad ? ' bad' : '');
    var row = h('div', { class: cls }, cb, name, ':\u00a0');
    var cm = d.value.match(COLOR_RE);
    if (cm) row.append(h('span', { class: 'swatch', style: { background: cm[0] } }));
    row.append(val, ';');
    if (b.readonly) { cb.remove(); return row; }
    cb.addEventListener('change', function () {
      var dis = disabledFor(b.decl);
      if (cb.checked) { var v = dis.get(d.name); dis.delete(d.name); applyDecl(b.decl, null, d.name, v.value + (v.imp ? ' !important' : '')); }
      else { dis.set(d.name, { value: d.value, imp: d.imp }); b.decl.removeProperty(d.name); }
      renderSide();
    });
    name.addEventListener('click', function () {
      name.__next = function () { val.click(); };
      inlineEdit(name, d.name, function (txt) { if (txt.trim() !== d.name) { applyDecl(b.decl, d.name, txt.trim(), d.value + (d.imp ? ' !important' : '')); renderSide(); } }, { suggest: suggestPropName(el) });
    });
    val.addEventListener('click', function () {
      inlineEdit(val, d.value + (d.imp ? ' !important' : ''), function (txt) {
        if (off) { disabledFor(b.decl).set(d.name, { value: txt.replace(/\s*!\s*important$/i, ''), imp: /!\s*important$/i.test(txt) }); }
        else applyDecl(b.decl, d.name, d.name, txt);
        renderSide();
      }, { suggest: suggestPropValue(el, function () { return d.name; }) });
    });
    return row;
  }

  function applyDecl(decl, oldName, name, value) {
    if (oldName && oldName !== name) decl.removeProperty(oldName);
    if (!name) return;
    value = String(value).trim().replace(/;+$/, '');
    var imp = '';
    if (/!\s*important$/i.test(value)) { imp = 'important'; value = value.replace(/\s*!\s*important$/i, ''); }
    if (!value) { decl.removeProperty(name); return; }
    decl.setProperty(name, value, imp);
    if (!decl.getPropertyValue(name)) disabledFor(decl).set(name, { value: value, imp: !!imp, bad: true });
    else disabledFor(decl).delete(name);
  }

  function newDecl(el, b, add) {
    var name = h('span', { class: 'd-name' });
    var val = h('span', { class: 'd-val' });
    var row = h('div', { class: 'decl' }, name, ':\u00a0', val, ';');
    add.replaceWith(row);
    inlineEdit(name, '', function (n) {
      var propName = n.trim();
      if (!propName) { setTimeout(renderSide, 0); return; }
      if (propName.indexOf(':') !== -1) {
        var parts = propName.split(':'); propName = parts.shift().trim();
        applyDecl(b.decl, null, propName, parts.join(':')); setTimeout(renderSide, 0); return;
      }
      setTimeout(function () {
        inlineEdit(val, '', function (v) { if (v.trim()) applyDecl(b.decl, null, propName, v); setTimeout(renderSide, 0); },
          { suggest: suggestPropValue(el, function () { return propName; }), showOnOpen: true });
      }, 0);
    }, { suggest: suggestPropName(el) });
  }

  function renderComputed(el) {
    var cs = getComputedStyle(el);
    ui.side.append(boxModel(el, cs));
    var f = h('input', { class: 'filter', placeholder: 'Filter', type: 'search', style: { margin: '4px 8px', width: 'calc(100% - 16px)' } });
    f.value = state.computedFilter;
    var list = h('div', { class: 'computed' });
    function fill() {
      clear(list);
      var names = []; for (var i = 0; i < cs.length; i++) names.push(cs[i]);
      names.sort().forEach(function (n) {
        var v = cs.getPropertyValue(n);
        if (state.computedFilter && (n + ' ' + v).toLowerCase().indexOf(state.computedFilter) === -1) return;
        var cm = v.match(COLOR_RE);
        list.append(h('div', { class: 'crow' }, h('span', { class: 'd-name' }, n), ':\u00a0', cm ? h('span', { class: 'swatch', style: { background: cm[0] } }) : null, h('span', { class: 'd-val' }, v)));
      });
    }
    f.addEventListener('input', function () { state.computedFilter = f.value.toLowerCase(); fill(); });
    fill();
    ui.side.append(f, list);
  }

  function boxModel(el, cs) {
    function px(p) { var v = parseFloat(cs[p]); return v ? (Math.round(v * 100) / 100) : '-'; }
    function sides(prefix, suffix) { suffix = suffix || ''; return { t: px(prefix + 'Top' + suffix), r: px(prefix + 'Right' + suffix), b: px(prefix + 'Bottom' + suffix), l: px(prefix + 'Left' + suffix) }; }
    function box(cls, label, s, inner) {
      return h('div', { class: 'bm ' + cls }, h('span', { class: 'lbl' }, label), h('div', null, String(s.t)),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' } }, h('span', null, String(s.l)), inner, h('span', null, String(s.r))),
        h('div', null, String(s.b)));
    }
    var r = el.getBoundingClientRect();
    var pad = sides('padding'), bor = sides('border', 'Width');
    var cw = r.width - (+pad.l || 0) - (+pad.r || 0) - (+bor.l || 0) - (+bor.r || 0);
    var ch = r.height - (+pad.t || 0) - (+pad.b || 0) - (+bor.t || 0) - (+bor.b || 0);
    var content = h('div', { class: 'bm bm-c' }, Math.round(cw * 100) / 100 + ' \u00d7 ' + Math.round(ch * 100) / 100);
    return h('div', { class: 'boxmodel' }, box('bm-m', 'margin', sides('margin'), box('bm-b', 'border', bor, box('bm-p', 'padding', pad, content))));
  }

  /* -------------------------------------------------------------- highlight */
  function highlight(el) {
    if (!el || el.nodeType !== 1 || !hl) return hideHighlight();
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    function n(p) { return parseFloat(cs[p]) || 0; }
    var m = { t: n('marginTop'), r: n('marginRight'), b: n('marginBottom'), l: n('marginLeft') };
    var b = { t: n('borderTopWidth'), r: n('borderRightWidth'), b: n('borderBottomWidth'), l: n('borderLeftWidth') };
    var p = { t: n('paddingTop'), r: n('paddingRight'), b: n('paddingBottom'), l: n('paddingLeft') };
    var parts = hl.children;
    function place(div, x, y, w, hh, bw) {
      div.style.left = x + 'px'; div.style.top = y + 'px'; div.style.width = Math.max(0, w) + 'px'; div.style.height = Math.max(0, hh) + 'px';
      if (bw) div.style.borderWidth = bw.t + 'px ' + bw.r + 'px ' + bw.b + 'px ' + bw.l + 'px';
      div.style.boxSizing = 'border-box';
    }
    place(parts[0], r.left - m.l, r.top - m.t, r.width + m.l + m.r, r.height + m.t + m.b, m);
    place(parts[1], r.left, r.top, r.width, r.height, b);
    place(parts[2], r.left + b.l, r.top + b.t, r.width - b.l - b.r, r.height - b.t - b.b, p);
    place(parts[3], r.left + b.l + p.l, r.top + b.t + p.t, r.width - b.l - b.r - p.l - p.r, r.height - b.t - b.b - p.t - p.b);
    hl.style.display = 'block';
    clear(hlTip).append(h('span', { class: 'tn' }, nodeLabel(el)), h('span', { class: 'dim' }, Math.round(r.width * 100) / 100 + ' \u00d7 ' + Math.round(r.height * 100) / 100));
    hlTip.style.display = 'block';
    var tipY = r.top - m.t - 26; if (tipY < 4) tipY = r.bottom + m.b + 4;
    hlTip.style.left = Math.max(4, Math.min(window.innerWidth - hlTip.offsetWidth - 4, r.left)) + 'px';
    hlTip.style.top = Math.min(window.innerHeight - 24, tipY) + 'px';
  }
  function hideHighlight() { if (hl) { hl.style.display = 'none'; hlTip.style.display = 'none'; } }

  function pickTarget(e) {
    var path = e.composedPath ? e.composedPath() : [e.target];
    for (var i = 0; i < path.length; i++) { var n = path[i]; if (n === host) return null; if (n.nodeType === 1) return n; }
    return null;
  }
  function onPickMove(e) { var t = pickTarget(e); if (t) highlight(t); }
  function onPickBlock(e) { if (pickTarget(e)) { e.preventDefault(); e.stopPropagation(); } }
  function onPickClick(e) {
    var t = pickTarget(e); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    setPicking(false); hideHighlight(); inspect(t);
  }
  function onPickKey(e) { if (e.key === 'Escape') { setPicking(false); hideHighlight(); } }
  function setPicking(on) {
    if (state.picking === on) return;
    state.picking = on;
    if (ui.pickBtn) ui.pickBtn.classList.toggle('on', on);
    var opts = true;
    if (on) {
      origAdd.call(document, 'mousemove', onPickMove, opts);
      ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(function (t) { origAdd.call(document, t, onPickBlock, { capture: true, passive: false }); });
      origAdd.call(document, 'click', onPickClick, opts);
      origAdd.call(document, 'keydown', onPickKey, opts);
    } else {
      origRemove.call(document, 'mousemove', onPickMove, opts);
      ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(function (t) { origRemove.call(document, t, onPickBlock, { capture: true }); });
      origRemove.call(document, 'click', onPickClick, opts);
      origRemove.call(document, 'keydown', onPickKey, opts);
    }
  }

  /* ---------------------------------------------------------------- network */
  var NET_TYPES = ['All', 'Fetch/XHR', 'Doc', 'CSS', 'JS', 'Img', 'Font', 'Media', 'Other'];
  function buildNetwork() {
    var v = h('div', { class: 'view' });
    var filter = h('input', { class: 'filter', placeholder: 'Filter URLs', type: 'search' });
    filter.addEventListener('input', function () { state.netFilter = filter.value.toLowerCase(); renderNet(); });
    var chips = h('span', { style: { display: 'flex', gap: '2px' } });
    NET_TYPES.forEach(function (t) {
      var c = h('button', { class: 'chip' + (state.netType === t ? ' on' : '') }, t);
      c.addEventListener('click', function () { state.netType = t; Array.prototype.forEach.call(chips.children, function (x) { x.classList.toggle('on', x === c); }); renderNet(); });
      chips.append(c);
    });
    v.append(h('div', { class: 'toolbar' },
      h('button', { class: 'ibtn', title: 'Clear network log', onclick: function () { state.net.length = 0; state.netSel = null; renderNet(); } }, icon('clear')),
      h('div', { class: 'sep' }), filter, h('div', { class: 'sep' }), chips));

    ui.netBody = h('tbody');
    var table = h('table', null,
      h('thead', null, h('tr', null,
        h('th', { class: 'c-n', style: { width: '34%' } }, 'Name'),
        h('th', { class: 'c-x', style: { width: '8%' } }, 'Method'),
        h('th', { class: 'c-x', style: { width: '8%' } }, 'Status'),
        h('th', { class: 'c-x', style: { width: '10%' } }, 'Type'),
        h('th', { class: 'c-x', style: { width: '10%' } }, 'Size'),
        h('th', { class: 'c-x', style: { width: '10%' } }, 'Time'),
        h('th', { class: 'c-x' }, 'Waterfall'))),
      ui.netBody);
    ui.netTable = h('div', { class: 'net-table' }, table);
    ui.netEmpty = h('div', { class: 'empty' }, 'Recording network activity\u2026 Perform a request or reload the page.');
    ui.netTable.append(ui.netEmpty);
    ui.netDetail = h('div', { class: 'net-detail' });
    ui.netWrap = h('div', { class: 'net-wrap' }, ui.netTable, ui.netDetail);
    ui.netStatus = h('div', { class: 'statusbar' });
    v.append(ui.netWrap, ui.netStatus);
    return v;
  }

  var netRenderPending = false;
  function scheduleNetRender() {
    if (netRenderPending) return; netRenderPending = true;
    requestAnimationFrame(function () { netRenderPending = false; if (state.open && state.tab === 'network') renderNet(); });
  }

  function netName(url) {
    try { var u = new URL(url); var last = u.pathname.split('/').filter(Boolean).pop() || u.host; return decodeURIComponent(last) + u.search; } catch (e) { return url; }
  }

  function renderNet() {
    if (!ui.netBody) return;
    var list = state.net.filter(function (e) {
      if (state.netType !== 'All' && resourceType(e) !== state.netType) return false;
      if (state.netFilter && e.url.toLowerCase().indexOf(state.netFilter) === -1) return false;
      return true;
    });
    var t0 = Infinity, t1 = 0;
    list.forEach(function (e) { t0 = Math.min(t0, e.start); t1 = Math.max(t1, e.end || performance.now()); });
    var span = Math.max(1, t1 - t0);
    var st = ui.netTable.scrollTop;
    clear(ui.netBody);
    ui.netEmpty.style.display = list.length ? 'none' : '';
    list.forEach(function (e) {
      var dur = e.end != null ? e.end - e.start : null;
      var fail = e.error || (e.status >= 400);
      var statusTxt = e.error ? '(failed)' : e.status == null ? (e.cached ? '(cache)' : e.fromPerf ? '\u2014' : '(pending)') : String(e.status);
      var bar = h('div', { class: 'wf' }, h('i', { style: { left: ((e.start - t0) / span * 100) + '%', width: (((e.end || performance.now()) - e.start) / span * 100) + '%' } }));
      var tr = h('tr', { class: (fail ? 'fail' : '') + (state.netSel === e ? ' sel' : '') },
        h('td', { title: e.url }, netName(e.url)),
        h('td', { class: 'c-x' }, e.method),
        h('td', { class: 'c-x' }, statusTxt),
        h('td', { class: 'c-x' }, resourceType(e) === 'Fetch/XHR' ? e.kind : resourceType(e).toLowerCase()),
        h('td', { class: 'c-x' }, e.cached ? '(disk cache)' : fmtBytes(e.size)),
        h('td', { class: 'c-x' }, e.end != null ? fmtMs(dur) : 'Pending'),
        h('td', { class: 'c-x' }, bar));
      tr.addEventListener('click', function () { state.netSel = state.netSel === e ? null : e; renderNet(); });
      ui.netBody.append(tr);
    });
    ui.netTable.scrollTop = st;
    var total = list.reduce(function (s, e) { return s + (e.size || 0); }, 0);
    append(clear(ui.netStatus), [
      h('span', null, list.length + (list.length !== state.net.length ? ' / ' + state.net.length : '') + ' requests'),
      h('span', null, fmtBytes(total) + ' transferred'),
      list.length ? h('span', null, 'Finish: ' + fmtMs(span)) : null]);
    ui.netWrap.classList.toggle('detail', !!state.netSel);
    if (state.netSel) renderNetDetail(state.netSel);
  }

  function kvList(obj) {
    var keys = Object.keys(obj || {});
    if (!keys.length) return h('div', { class: 'muted' }, 'None');
    return keys.sort().map(function (k) { return h('div', { class: 'kv' }, h('span', { class: 'k' }, k + ':'), h('span', { class: 'v' }, obj[k])); });
  }
  function tryJSON(s) { if (typeof s !== 'string') return undefined; var t = s.trim(); if (!/^[[{"]/.test(t) && !/^(true|false|null|-?\d)/.test(t)) return undefined; try { return JSON.parse(t); } catch (e) { return undefined; } }

  function curlFor(e) {
    var parts = ["curl '" + e.url.replace(/'/g, "'\\''") + "'"];
    if (e.method !== 'GET') parts.push('-X ' + e.method);
    Object.keys(e.reqHeaders || {}).forEach(function (k) { parts.push("-H '" + k + ': ' + String(e.reqHeaders[k]).replace(/'/g, "'\\''") + "'"); });
    if (e.reqBody && e.reqBody.charAt(0) !== '[') parts.push("--data-raw '" + e.reqBody.replace(/'/g, "'\\''") + "'");
    return parts.join(' \\\n  ');
  }

  function renderNetDetail(e) {
    var d = ui.netDetail; clear(d);
    var tabs = h('div', { class: 'side-tabs' },
      h('button', { class: 'ibtn', title: 'Close', onclick: function () { state.netSel = null; renderNet(); } }, icon('close')));
    ['Headers', 'Payload', 'Preview', 'Response', 'Timing'].forEach(function (n) {
      if (n === 'Payload' && !e.reqBody && e.url.indexOf('?') === -1) return;
      if ((n === 'Preview' || n === 'Response') && e.fromPerf && resourceType(e) !== 'Img') return;
      var t = h('div', { class: 'tab' + (state.netDetailTab === n ? ' on' : '') }, n);
      t.addEventListener('click', function () { state.netDetailTab = n; renderNetDetail(e); });
      tabs.append(t);
    });
    tabs.append(h('div', { class: 'grow' }), h('button', { class: 'chip', title: 'Copy as cURL', onclick: function (ev) { copyText(curlFor(e)); ev.target.textContent = 'Copied'; setTimeout(function () { ev.target.textContent = 'Copy as cURL'; }, 1200); } }, 'Copy as cURL'));
    var body = h('div', { class: 'scroll' });
    d.append(tabs, body);
    var tab = state.netDetailTab;
    if (!Array.prototype.some.call(tabs.querySelectorAll('.tab'), function (x) { return x.textContent === tab; })) tab = 'Headers';

    if (tab === 'Headers') {
      var status = e.error ? 'Failed: ' + e.error : (e.status != null ? e.status + ' ' + (e.statusText || '') : e.cached ? '200 (from cache)' : '\u2014');
      append(body, [
        h('div', { class: 'dsec' }, h('h4', null, 'General'),
          h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Request URL:'), h('span', { class: 'v' }, e.url)),
          h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Request Method:'), h('span', { class: 'v' }, e.method)),
          h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Status Code:'), h('span', { class: 'v' }, status)),
          h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Initiator:'), h('span', { class: 'v' }, e.kind))),
        e.fromPerf ? h('div', { class: 'dsec muted' }, 'Headers aren\u2019t available for resources the page loaded natively (images, scripts, stylesheets). Only fetch() and XMLHttpRequest calls are fully captured.') : [
          h('div', { class: 'dsec' }, h('h4', null, 'Response Headers'), kvList(e.resHeaders)),
          h('div', { class: 'dsec' }, h('h4', null, 'Request Headers'), kvList(e.reqHeaders),
            h('div', { class: 'muted', style: { marginTop: '4px' } }, 'Only headers set by page code are shown; the browser adds others (cookies, user-agent) that scripts can\u2019t see.'))]]);
    } else if (tab === 'Payload') {
      try {
        var q = new URL(e.url).searchParams, qo = {}, any = false;
        q.forEach(function (v, k) { qo[k] = v; any = true; });
        if (any) body.append(h('div', { class: 'dsec' }, h('h4', null, 'Query String Parameters'), kvList(qo)));
      } catch (err) {}
      if (e.reqBody) {
        var j = tryJSON(e.reqBody);
        body.append(h('div', { class: 'dsec' }, h('h4', null, 'Request Payload'),
          j !== undefined ? h('div', { class: 'mono' }, expandable(j, preview(j, true), true)) : h('pre', { class: 'body', style: { padding: 0 } }, e.reqBody)));
      }
    } else if (tab === 'Preview') {
      if (resourceType(e) === 'Img' || /^image\//.test(e.mime)) body.append(h('div', { class: 'dsec' }, h('img', { src: e.url, style: { maxWidth: '100%', maxHeight: '260px' } })));
      else {
        var pj = tryJSON(e.resBody);
        if (pj !== undefined) body.append(h('div', { class: 'dsec mono' }, typeof pj === 'object' && pj ? expandable(pj, preview(pj, true), true) : renderValue(pj)));
        else body.append(h('pre', { class: 'body' }, e.resBody == null ? (e.done ? 'No response body.' : 'Waiting for response\u2026') : e.resBody));
      }
    } else if (tab === 'Response') {
      body.append(h('pre', { class: 'body' }, e.resBody == null ? (e.done ? 'No response body.' : 'Waiting for response\u2026') : e.resBody));
    } else if (tab === 'Timing') {
      var rows = [['Started at', fmtMs(e.start) + ' after page load'], ['Total duration', e.end != null ? fmtMs(e.end - e.start) : 'Pending']];
      var t = e.timing;
      if (t) {
        if (t.domainLookupEnd > t.domainLookupStart) rows.push(['DNS lookup', fmtMs(t.domainLookupEnd - t.domainLookupStart)]);
        if (t.connectEnd > t.connectStart) rows.push(['Initial connection', fmtMs(t.connectEnd - t.connectStart)]);
        if (t.responseStart > t.requestStart) rows.push(['Waiting for server (TTFB)', fmtMs(t.responseStart - t.requestStart)]);
        if (t.responseEnd > t.responseStart) rows.push(['Content download', fmtMs(t.responseEnd - t.responseStart)]);
      }
      body.append(h('div', { class: 'dsec' }, rows.map(function (r) { return h('div', { class: 'kv' }, h('span', { class: 'k' }, r[0]), h('span', { class: 'v' }, r[1])); })));
    }
  }

  /* ---------------------------------------------------------------- sources */
  var srcState = { filter: '', showVendor: false, open: null, collapsed: {} };
  function pageScripts() {
    var set = {};
    Array.prototype.forEach.call(document.scripts, function (sc) { if (sc.src) set[sc.src] = 1; });
    try { performance.getEntriesByType('resource').forEach(function (r) { if (r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name)) set[r.name] = 1; }); } catch (e) {}
    return Object.keys(set).filter(function (u) { return u !== scriptSrc && !/safari-devtools\.js/.test(u) && /^(https?|file):/.test(u); });
  }
  function buildSources() {
    var v = h('div', { class: 'view' });
    var filter = h('input', { class: 'filter', placeholder: 'Filter files', type: 'search' });
    filter.addEventListener('input', function () { srcState.filter = filter.value.toLowerCase(); renderSourcesNav(); });
    var vendor = h('input', { type: 'checkbox' });
    vendor.addEventListener('change', function () { srcState.showVendor = vendor.checked; renderSourcesNav(); });
    ui.srcNav = h('div', { class: 'src-nav' });
    ui.srcTitle = h('div', { class: 'src-title' }, 'Select a file, or click a file:line link in the Console.');
    ui.srcCode = h('div', { class: 'src-code' });
    var left = h('div', { class: 'src-left' },
      h('div', { class: 'toolbar' }, filter),
      h('label', { class: 'src-opt' }, vendor, ' Show node_modules'),
      ui.srcNav);
    var right = h('div', { class: 'src-right' }, ui.srcTitle, ui.srcCode);
    v.append(h('div', { class: 'split' }, left, right));
    return v;
  }
  function renderSourcesNav() {
    if (!ui.srcNav) return;
    var scripts = pageScripts();
    scripts.forEach(function (u) { loadMap(u); });
    var st = ui.srcNav.scrollTop;
    clear(ui.srcNav);
    var q = srcState.filter;
    function fileRow(label, title, target, active) {
      var r = h('div', { class: 'src-file' + (active ? ' on' : ''), title: title }, label);
      r.addEventListener('click', function () { openSource(target); });
      return r;
    }
    function group(key, title, rows) {
      if (!rows.length) return;
      var closed = srcState.collapsed[key];
      var hd = h('div', { class: 'src-group' }, (closed ? '\u25b6 ' : '\u25bc ') + title + ' (' + rows.length + ')');
      hd.addEventListener('click', function () { srcState.collapsed[key] = !closed; renderSourcesNav(); });
      ui.srcNav.append(hd);
      if (!closed) rows.forEach(function (r) { ui.srcNav.append(r); });
    }
    var o = srcState.open;
    SM.list.forEach(function (m) {
      var rows = m.files.filter(function (f) {
        if (!srcState.showVendor && /node_modules|\(webpack\)|webpack\/bootstrap|webpack\/runtime/.test(f.url)) return false;
        return !q || f.display.toLowerCase().indexOf(q) !== -1;
      }).sort(function (a, b) { return a.display < b.display ? -1 : 1; }).map(function (f) {
        return fileRow(f.display, f.url, { file: f, line: 1 }, o && o.file === f);
      });
      group('map:' + m.url, 'Original sources \u00b7 ' + shortName(m.script), rows);
    });
    var gen = scripts.filter(function (u) { return !q || u.toLowerCase().indexOf(q) !== -1; }).map(function (u) {
      return fileRow(displayPath(u), u, { url: u, line: 1 }, o && !o.file && o.url === u);
    });
    group('page', 'Page scripts (as served)', gen);
    if (!ui.srcNav.children.length) ui.srcNav.append(h('div', { class: 'note' }, 'No scripts found yet. Source maps appear here once loaded.'));
    ui.srcNav.scrollTop = st;
  }
  // target: { file, line, col } for an original source, or { url, line, col } for a served script.
  function openSource(target) {
    if (!target) return;
    if (!state.open) show();
    switchTab('sources');
    srcState.open = target;
    renderSourcesNav();
    var title = target.file ? target.file.display : displayPath(target.url);
    clear(ui.srcTitle).append(h('span', { class: 'mono' }, title + (target.line > 1 ? ':' + target.line : '')));
    if (target.generated) {
      var g = target.generated, link = h('span', { class: 'srclink' }, 'view served code (' + shortName(g.url) + ':' + g.line + ')');
      link.addEventListener('click', function () { openSource({ url: g.url, line: g.line, col: g.col }); });
      ui.srcTitle.append('  ', link);
    } else if (target.url) {
      loadMap(target.url).then(function (m) { if (m) ui.srcTitle.append(h('span', { class: 'muted' }, '  \u00b7 source map found: originals listed on the left')); });
    }
    clear(ui.srcCode).append(h('div', { class: 'note' }, 'Loading\u2026'));
    var p = target.file ? target.file.content() : fetchText(target.url).then(function (r) { return r.text; });
    p.then(function (text) { if (srcState.open === target) renderCode(text, target.line, target.col); },
      function (err) { if (srcState.open === target) clear(ui.srcCode).append(h('div', { class: 'note' }, 'Source not available: ' + (err && err.message || err) + (target.file ? '. The source map has no embedded sourcesContent and the file can\u2019t be fetched.' : ''))); });
  }
  var JS_KW = /^(?:break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|async|await|of|static|get|set|interface|type|enum|implements|private|public|protected|readonly|abstract|declare|namespace|as|from|true|false|null|undefined)$/;
  function highlightLine(text) {
    var out = [], re = /(\/\/.*$|\/\*.*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d[\d_.xXa-fA-FeEn]*\b|[A-Za-z_$][\w$]*)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      var t = m[0], c = null;
      if (t.charAt(0) === '/' ) c = 'c-cmt';
      else if (/^["'`]/.test(t)) c = 'v-str';
      else if (/^\d/.test(t)) c = 'v-num';
      else if (JS_KW.test(t)) c = 'v-bool';
      out.push(c ? h('span', { class: c }, t) : t);
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  function renderCode(text, line, col) {
    var MAXLINE = 4000, MAXLINES = 60000;
    var lines = String(text).split('\n');
    var big = text.length > 400000;
    var frag = document.createDocumentFragment(), hit = null;
    var startAt = 0, endAt = Math.min(lines.length, MAXLINES);
    if (line && line > MAXLINES) { startAt = Math.max(0, line - 2000); endAt = Math.min(lines.length, line + 2000); }
    for (var i = startAt; i < endAt; i++) {
      var raw = lines[i], shown = raw;
      if (shown.length > MAXLINE) {
        var from = (i + 1 === line && col) ? Math.max(0, col - 200) : 0;
        shown = (from ? '\u2026' : '') + raw.slice(from, from + MAXLINE) + '\u2026';
      }
      var row = h('div', { class: 'src-line' + (i + 1 === line ? ' hit' : '') },
        h('span', { class: 'src-ln' }, String(i + 1)),
        h('span', { class: 'src-tx' }, big ? shown : highlightLine(shown)));
      if (i + 1 === line) hit = row;
      frag.append(row);
    }
    clear(ui.srcCode).append(frag);
    if (lines.length > endAt) ui.srcCode.append(h('div', { class: 'note' }, '\u2026 ' + (lines.length - endAt) + ' more lines not shown'));
    if (hit) hit.scrollIntoView({ block: 'center' }); else ui.srcCode.scrollTop = 0;
  }

  /* ---------------------------------------------------------------- storage */
  function getStore(kind) {
    var items = [];
    try {
      if (kind === 'cookies') {
        (document.cookie ? document.cookie.split(/;\s*/) : []).forEach(function (c) {
          var i = c.indexOf('='); var k = i < 0 ? c : c.slice(0, i), v = i < 0 ? '' : c.slice(i + 1);
          try { v = decodeURIComponent(v); } catch (e) {}
          items.push([k, v]);
        });
      } else {
        var s = kind === 'local' ? localStorage : sessionStorage;
        for (var j = 0; j < s.length; j++) { var key = s.key(j); if (key && key.indexOf('__sdt') === 0) continue; items.push([key, s.getItem(key)]); }
      }
    } catch (e) { return { error: String(e.message || e) }; }
    items.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    return { items: items };
  }
  function setItem(kind, key, value) {
    if (kind === 'cookies') document.cookie = encodeURIComponent(key).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent) + '=' + encodeURIComponent(value) + '; path=/';
    else (kind === 'local' ? localStorage : sessionStorage).setItem(key, value);
  }
  function removeItem(kind, key) {
    if (kind === 'cookies') {
      var exp = '=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      var paths = ['/', location.pathname, location.pathname.replace(/\/[^/]*$/, '') || '/'];
      var domains = ['', location.hostname, '.' + location.hostname.split('.').slice(-2).join('.')];
      paths.forEach(function (p) { domains.forEach(function (d) { document.cookie = key + exp + '; path=' + p + (d ? '; domain=' + d : ''); }); });
    } else (kind === 'local' ? localStorage : sessionStorage).removeItem(key);
  }

  function buildStorage() {
    var v = h('div', { class: 'view' });
    ui.storeNav = h('div', { class: 'store-nav' });
    var navItems = [['local', 'Local storage'], ['session', 'Session storage'], ['cookies', 'Cookies']];
    ui.storeNav.append(h('div', { class: 'grp' }, 'Storage'));
    navItems.forEach(function (p) {
      var it = h('div', { class: 'item' + (state.storeKind === p[0] ? ' on' : '') }, p[1]);
      it.addEventListener('click', function () { state.storeKind = p[0]; state.storeSel = null; Array.prototype.forEach.call(ui.storeNav.querySelectorAll('.item'), function (x) { x.classList.toggle('on', x === it); }); renderStorage(true); });
      ui.storeNav.append(it);
    });
    ui.storeNav.append(h('div', { class: 'grp', style: { marginTop: '8px', textTransform: 'none', letterSpacing: 0 } }, location.origin));

    var filter = h('input', { class: 'filter', placeholder: 'Filter', type: 'search' });
    filter.addEventListener('input', function () { state.storeFilter = filter.value.toLowerCase(); renderStorage(true); });
    var tb = h('div', { class: 'toolbar' },
      h('button', { class: 'ibtn', title: 'Refresh', onclick: function () { renderStorage(true); } }, icon('refresh')),
      h('button', { class: 'ibtn', title: 'Clear all', onclick: function () {
        if (!confirm('Delete all ' + state.storeKind + ' entries for ' + location.origin + '?')) return;
        var r = getStore(state.storeKind); (r.items || []).forEach(function (p) { removeItem(state.storeKind, p[0]); }); renderStorage(true);
      } }, icon('clear')),
      h('div', { class: 'sep' }), filter);
    ui.storeBody = h('tbody');
    ui.storeTable = h('div', { class: 'scroll' }, h('table', null,
      h('colgroup', null, h('col', { style: { width: '32%' } }), h('col'), h('col', { style: { width: '28px' } })),
      h('thead', null, h('tr', null, h('th', null, 'Key'), h('th', null, 'Value'), h('th'))), ui.storeBody));
    ui.storeNote = h('div', { class: 'note', style: { display: 'none' } });
    ui.storePreview = h('div', { class: 'preview', style: { display: 'none' } });
    var k = h('input', { class: 'filter', placeholder: 'Key' });
    var val = h('input', { class: 'filter', placeholder: 'Value' });
    function addIt() { if (!k.value) return; try { setItem(state.storeKind, k.value, val.value); } catch (e) { alert(e.message); } k.value = ''; val.value = ''; renderStorage(true); k.focus(); }
    val.addEventListener('keydown', function (e) { if (e.key === 'Enter') addIt(); });
    k.addEventListener('keydown', function (e) { if (e.key === 'Enter') val.focus(); });
    var addRow = h('div', { class: 'addrow' }, k, val, h('button', { class: 'btn', onclick: addIt }, 'Add'));
    var main = h('div', { class: 'store-main' }, tb, ui.storeTable, ui.storeNote, ui.storePreview, addRow);
    v.append(h('div', { class: 'split' }, ui.storeNav, main));
    window.addEventListener('storage', function () { if (state.open && state.tab === 'storage') renderStorage(); });
    return v;
  }

  var lastStoreSnap = '', storeTimer = null;
  function startStoragePoll() { stopStoragePoll(); storeTimer = setInterval(function () { if (!ui.editing && state.open && state.tab === 'storage') renderStorage(); }, 1500); }
  function stopStoragePoll() { if (storeTimer) clearInterval(storeTimer); storeTimer = null; }

  function renderStorage(force) {
    if (!ui.storeBody) return;
    var kind = state.storeKind, res = getStore(kind);
    var snap = kind + '|' + state.storeFilter + '|' + JSON.stringify(res) + '|' + (state.storeSel || '');
    if (!force && snap === lastStoreSnap) return;
    lastStoreSnap = snap;
    clear(ui.storeBody);
    ui.storeNote.style.display = 'none';
    if (res.error) { ui.storeNote.style.display = ''; ui.storeNote.textContent = 'Storage unavailable: ' + res.error; return; }
    var items = res.items.filter(function (p) { return !state.storeFilter || (p[0] + ' ' + p[1]).toLowerCase().indexOf(state.storeFilter) !== -1; });
    items.forEach(function (p) {
      var key = p[0], value = p[1];
      var kc = h('td', { class: 'edit mono', title: 'Double-click to rename' }, key);
      var vc = h('td', { class: 'edit mono', title: 'Double-click to edit' }, value.length > 500 ? value.slice(0, 500) + '\u2026' : value);
      var del = h('button', { class: 'del', title: 'Delete' }, '\u2715');
      var tr = h('tr', { class: state.storeSel === key ? 'sel' : '' }, kc, vc, h('td', null, del));
      tr.addEventListener('click', function () { state.storeSel = key; Array.prototype.forEach.call(ui.storeBody.children, function (r) { r.classList.toggle('sel', r === tr); }); showStorePreview(key, value); });
      kc.addEventListener('dblclick', function () { inlineEdit(kc, key, function (nk) { if (nk && nk !== key) { removeItem(kind, key); setItem(kind, nk, value); state.storeSel = nk; } renderStorage(true); }); });
      vc.addEventListener('dblclick', function () { inlineEdit(vc, value, function (nv) { if (nv !== value) setItem(kind, key, nv); renderStorage(true); }); });
      del.addEventListener('click', function (e) { e.stopPropagation(); removeItem(kind, key); if (state.storeSel === key) state.storeSel = null; renderStorage(true); });
      ui.storeBody.append(tr);
    });
    if (!items.length) { ui.storeNote.style.display = ''; ui.storeNote.textContent = res.items.length ? 'No entries match the filter.' : 'No entries.'; }
    if (kind === 'cookies') { ui.storeNote.style.display = ''; ui.storeNote.textContent = (ui.storeNote.textContent && !items.length ? ui.storeNote.textContent + ' ' : '') + 'HttpOnly cookies are hidden from page scripts and can\u2019t be shown here.'; }
    var sel = state.storeSel && res.items.filter(function (p) { return p[0] === state.storeSel; })[0];
    if (sel) showStorePreview(sel[0], sel[1]); else ui.storePreview.style.display = 'none';
  }
  function showStorePreview(key, value) {
    var p = ui.storePreview; clear(p); p.style.display = '';
    var j = tryJSON(value);
    p.append(h('div', { class: 'muted', style: { marginBottom: '4px' } }, key));
    p.append(j !== undefined && j && typeof j === 'object' ? expandable(j, preview(j, true), true) : j !== undefined ? renderValue(j) : h('div', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, value));
  }

  /* ------------------------------------------------------------------- boot */
  var api = {
    show: function () { if (ui.ready) show(); else state.open = true; },
    hide: function () { if (ui.ready) hide(); else state.open = false; },
    toggle: function () { state.open ? api.hide() : api.show(); },
    inspect: function (n) { if (ui.ready) inspect(n); },
    clear: clearConsole,
    version: '1.0.0'
  };
  window.__SDT__ = api;
  window.SafariDevTools = api;

  // Commands from the Safari extension (content scripts share the DOM, not JS globals).
  document.addEventListener('sdt:command', function (e) {
    var cmd = e.detail;
    if (cmd === 'ping') document.dispatchEvent(new CustomEvent('sdt:pong'));
    else if (cmd === 'toggle') api.toggle();
    else if (cmd === 'show') api.show();
    else if (cmd === 'hide') api.hide();
  });

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
