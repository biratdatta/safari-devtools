// Drives the real Safari DevTools panel for each video scene.
// Parent (Remotion) -> {sdtDemo:'goto', step, token}; page -> {sdtDemo:'at', step, token, rects}.
(function () {
  var q = new URLSearchParams(location.search);
  // Play a scene on its own (website showcase, checks): window.__DEMO_AUTOPLAY__ or ?state=…&play=STEP
  var auto = window.__DEMO_AUTOPLAY__ || (q.get('play') != null ? { state: q.get('state') || 'console', step: +q.get('play') } : null);
  if (window.name === '__sdt_preview' || (window.parent === window && !auto)) return;
  var STATE = (auto && auto.state) || q.get('state') || 'console';
  var api = window.SafariDevTools, A = api && api.automation;
  var host = function () { return document.querySelector('safari-devtools'); };
  var $s = function (sel) { var h = host(); return h && h.shadowRoot ? h.shadowRoot.querySelector(sel) : null; };
  var $$s = function (sel) { var h = host(); return h && h.shadowRoot ? [].slice.call(h.shadowRoot.querySelectorAll(sel)) : []; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var frames = function () { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); };
  var byText = function (sel, text) { return $$s(sel).filter(function (e) { return e.textContent.trim() === text; })[0]; };
  async function until(fn, ms) { var t = Date.now(); while (Date.now() - t < (ms || 4000)) { var v = fn(); if (v) return v; await wait(40); } return null; }

  window.__DEMO_ANSWER__ = 'Root cause: /api/coupon returns 410 for an expired coupon, so `coupon.discount` is undefined and `applyCoupon` reads `.amount` from it (cart.js:4).\n\nFix: check the response and fall back to no discount:\n\n```js\nfunction applyCoupon(cart, coupon) {\n  const amount = coupon?.discount?.amount ?? 0;\n  return cart.total - amount;\n}\n```\nAlso show "This coupon has expired" when the request fails.';

  var STEPS = {
    intro: [async function () {}, async function () { api.show(); A.open('console'); }],
    console: [async function () { A.open('console'); await until(function () { return $s('.log.error'); }); }],
    explain: [
      async function () { A.open('console'); var b = await until(function () { return $s('.log.error .explain'); }); },
      async function () {
        $s('.log.error .explain').click();
        var ask = await until(function () { return byText('.modal .btn', 'Ask Claude'); });
        if (ask) ask.click();
        await until(function () { return $s('.ai-answer'); });
        var body = $s('.modal-body'); if (body) body.scrollTop = body.scrollHeight;
      }],
    elements: [
      async function () { api.inspect(document.querySelector('acme-avatar').shadowRoot.querySelector('.av')); A.open('elements'); },
      async function () { A.setToken('--brand', '#7c3aed'); api.inspect(document.getElementById('pay')); }],
    network: [
      async function () { A.open('network'); await until(function () { return $$s('.net-table tbody tr').length >= 5; }); },
      async function () { var r = $$s('.net-table tbody tr').filter(function (tr) { return /coupon/.test(tr.textContent); })[0]; if (r) r.click(); }],
    accessibility: [
      async function () { A.open('accessibility'); },
      async function () { var t = byText('.side-tabs .tab', 'Tab order'); if (t) t.click(); A.tabOverlay(true); }],
    contrast: [
      async function () { api.inspect(document.querySelector('.hint')); A.open('accessibility'); var t = byText('.side-tabs .tab', 'Contrast'); if (t) t.click(); },
      async function () { var b = byText('.dsec .chip', 'Apply'); if (b) b.click(); }],
    bug: [
      async function () {
        // Real interactions first, so the auto-captured steps have something to show.
        var coupon = document.querySelector('input[placeholder="Coupon code"]');
        coupon.focus(); coupon.value = 'SPRING'; coupon.dispatchEvent(new Event('input', { bubbles: true })); coupon.dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('pay').click();
        await wait(60);
        var b = $s('.tabs .ibtn[title^="Report a bug"]'); if (b) b.click();
        var w = await until(function () { return $s('.modal textarea'); });
        if (w) { w.value = 'Applying the SPRING coupon breaks checkout: the total never updates and Pay stays enabled.'; w.dispatchEvent(new Event('input')); }
        await until(function () { return /Will file in/.test(($s('.modal') || {}).textContent || ''); });
      },
      async function () { var j = byText('.modal .btn', 'Create Jira issue'); if (j) j.click(); await until(function () { return /Created/.test(($s('.modal') || {}).textContent || ''); }); }],
    responsive: [
      async function () { var d = $s('.tabs .ibtn[title^="Toggle device toolbar"]'); if (d) d.click(); await until(function () { return $$s('.rp iframe').length; }); await wait(700); },
      async function () { var c = $s('.rp .ibtn[title^="Close"]'); if (c) c.click(); A.emulate({ colorScheme: 'dark', pseudo: true }); A.open('device'); }],
  };

  function rect(el) { if (!el) return null; var r = el.getBoundingClientRect(); return r.width || r.height ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; }
  function unionOf(els) {
    var b = null;
    els.forEach(function (el) { var r = el && el.getBoundingClientRect(); if (!r || !(r.width || r.height)) return;
      b = b ? [Math.min(b[0], r.left), Math.min(b[1], r.top), Math.max(b[2], r.right), Math.max(b[3], r.bottom)] : [r.left, r.top, r.right, r.bottom]; });
    return b ? [Math.round(b[0]), Math.round(b[1]), Math.round(b[2] - b[0]), Math.round(b[3] - b[1])] : null;
  }
  function rects() {
    var R = {};
    var add = function (k, el) { var v = rect(el); if (v) R[k] = v; };
    add('panel', $s('.panel'));
    add('tabs', $s('.tabs'));
    add('errorRow', $s('.log.error'));
    add('explainBtn', $s('.log.error .explain'));
    add('modal', $s('.modal'));
    add('answer', $s('.ai-answer'));
    add('askBtn', byText('.modal .btn', 'Ask Claude'));
    add('selRow', $s('.dom-tree .row.sel'));
    add('styles', $s('.split > .right'));
    add('pay', document.getElementById('pay'));
    add('avatar', document.querySelector('acme-avatar'));
    add('netTable', $s('.net-table'));
    add('couponRow', $$s('.net-table tbody tr').filter(function (tr) { return /coupon/.test(tr.textContent); })[0]);
    add('netDetail', $s('.net-detail'));
    add('axView', $s('.view.on'));
    add('tabBadge', $s('.tab-layer .tab-num'));
    add('contrastSample', $s('.contrast-sample'));
    add('applyBtn', byText('.dsec .chip', 'Apply'));
    add('hint', document.querySelector('.hint'));
    add('jiraBtn', byText('.modal .btn', 'Create Jira issue'));
    add('steps', $$s('.modal textarea')[1]);
    add('rp', $s('.rp'));
    add('rpFrames', $s('.rp-frames'));
    add('emuBox', $s('.view.on .dsec'));
    add('cart', document.getElementById('cart'));
    add('tabOrderTab', byText('.side-tabs .tab', 'Tab order'));
    add('bugBtn', $s('.tabs .ibtn[title^="Report a bug"]'));
    add('explainRow', $s('.log.error'));
    add('deviceBtn', $s('.tabs .ibtn[title^="Toggle device toolbar"]'));
    add('tree', $s('.dom-tree'));
    add('axTree', $s('.ax-tree'));
    add('summary', document.getElementById('summary'));
    var u;
    if ((u = unionOf($$s('.con-list .log')))) R.logs = u;
    if ((u = unionOf($$s('.net-table tbody tr')))) R.netRows = u;
    var mb = $s('.modal-body');
    if (mb && (u = unionOf([].slice.call(mb.children, -2)))) R.modalFoot = u;
    return R;
  }

  var current = -1, busy = Promise.resolve();
  function goto(step, token) {
    busy = busy.then(async function () {
      var list = STEPS[STATE] || [];
      step = Math.min(step, list.length - 1);
      if (step < current) { location.replace(location.pathname + '?state=' + STATE + '&ph=' + (q.get('ph') || 430) + '&step=' + step + '&token=' + token + '&r=' + Date.now()); return; }
      while (current < step) { current++; try { await list[current](); } catch (e) { console.warn('demo step failed', e); } await wait(120); }
      await frames(); await wait(80);
      if (window.parent !== window) parent.postMessage({ sdtDemo: 'at', state: STATE, step: current, token: token, rects: rects(), view: [innerWidth, innerHeight] }, '*');
    });
  }
  addEventListener('message', function (e) { var d = e.data; if (d && d.sdtDemo === 'goto') goto(d.step | 0, d.token); });
  // First paint: wait for the app's requests and logs, then report step N from the URL (0 by default).
  until(function () { return api && api.ready() && A.network().filter(function (n) { return n.done; }).length >= 4 && A.errors().length >= 1; }, 6000).then(function () {
    setTimeout(function () { goto(auto ? auto.step : +(q.get('step') || 0), q.get('token') || 'load'); }, 150);
  });
})();
