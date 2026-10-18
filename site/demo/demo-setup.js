// Runs before Safari DevTools loads: a clean, repeatable state for each video scene.
(function () {
  if (window.name === '__sdt_preview') return; // frames inside the Responsive preview
  try {
    Object.keys(sessionStorage).filter(function (k) { return k.indexOf('__sdt') === 0; }).forEach(function (k) { sessionStorage.removeItem(k); });
    Object.keys(localStorage).filter(function (k) { return k.indexOf('__sdt') === 0; }).forEach(function (k) { localStorage.removeItem(k); });
    var q = new URLSearchParams(location.search);
    sessionStorage.setItem('__sdt_ui', JSON.stringify({ open: q.get('state') !== 'intro', tab: 'console', height: +(q.get('ph') || 430) }));
  } catch (e) {}
  // Pretend relay for the Jira and Claude features (the video has no server).
  var realFetch = window.fetch;
  window.fetch = function (url, opts) {
    var u = String(url);
    var json = function (o) { return Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } })); };
    if (/localhost:9230\/jira\/config/.test(u)) return json({ configured: true, project: 'SHOP', host: 'acme.atlassian.net', ai: true });
    if (/localhost:9230\/jira\/create/.test(u)) return new Promise(function (r) { setTimeout(function () { r(new Response(JSON.stringify({ key: 'SHOP-142', url: 'https://acme.atlassian.net/browse/SHOP-142', attachErrors: [] }), { status: 200 })); }, 50); });
    if (/localhost:9230\/ai\/explain/.test(u)) return json({ model: 'claude-sonnet-5-5', text: window.__DEMO_ANSWER__ || '' });
    return realFetch.apply(this, arguments);
  };
})();
