// Runs in the extension's isolated world at document_start (Safari and Chrome).
// Its only job: load safari-devtools.js into the PAGE's own JavaScript world,
// so it can see the page's console, fetch/XHR and storage.
(function () {
  'use strict';
  if (window.top !== window) return; // top frame only
  var ext = globalThis.browser || globalThis.chrome;
  if (!ext || !ext.runtime) return;

  var url = ext.runtime.getURL('safari-devtools.js');
  var loaded = false;
  document.addEventListener('sdt:pong', function () { loaded = true; });

  function ping() {
    document.dispatchEvent(new CustomEvent('sdt:command', { detail: 'ping' }));
    return loaded;
  }
  function send(cmd) {
    document.dispatchEvent(new CustomEvent('sdt:command', { detail: cmd }));
  }
  function makeScript() {
    var s = document.createElement('script');
    s.dataset.source = 'extension';
    s.dataset.launcher = 'false'; // use the toolbar button or Ctrl+Shift+D instead
    return s;
  }
  function log(msg) { try { console.info('[Safari DevTools] ' + msg); } catch (e) {} }
  function parent() { return document.head || document.documentElement; }

  function whenRoot(fn) {
    if (document.documentElement) return fn();
    var mo = new MutationObserver(function () { if (document.documentElement) { mo.disconnect(); fn(); } });
    mo.observe(document, { childList: true });
  }

  var pending = [];
  whenRoot(inject);

  function inject() {
    // 0) Chrome loads the tool itself as a MAIN-world content script (manifest "world": "MAIN"),
    //    which also works on pages whose CSP blocks injected scripts. Nothing to do then.
    if (ping()) { log('ready (main world)'); return; }

    // 1) Inline injection: runs synchronously, before the page's own scripts,
    //    so every log and request from page load is captured.
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send();
      if (xhr.responseText) {
        var inline = makeScript();
        inline.textContent = xhr.responseText + '\n//# sourceURL=safari-devtools.js';
        parent().appendChild(inline);
        inline.remove();
      }
    } catch (e) { log('inline load failed: ' + e.message); }
  
    // 2) Fallback: if the page's Content-Security-Policy blocked inline scripts,
    //    load it as an external file instead (slightly later, but still early).
    if (ping()) { log('ready (inline)'); return; }
    {
      var ext1 = makeScript();
      ext1.src = url;
      ext1.onload = function () {
        ext1.remove();
        loaded = loaded || ping();
        log(loaded ? 'ready (external file)' : 'loaded but not responding');
        pending.splice(0).forEach(send);
      };
      ext1.onerror = function () { ext1.remove(); log('BLOCKED: this page does not allow injected scripts (Content-Security-Policy).'); };
      parent().appendChild(ext1);
    }
  }

  // Toolbar button → toggle the panel.
  ext.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'sdt-command') return;
    if (loaded || ping()) { send(msg.command); if (sendResponse) sendResponse({ ok: true }); }
    else { pending.push(msg.command); if (sendResponse) sendResponse({ ok: false, queued: true }); }
  });
})();
