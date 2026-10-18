// Network responses for the demo app, served by Safari DevTools' own mock rules.
(function () {
  if (window.name === '__sdt_preview' || !window.SafariDevTools) return;
  var A = window.SafariDevTools.automation;
  A.mock('/api/cart', { body: { id: 'c_81f2', total: 237, items: [{ sku: 'HP-200', qty: 1, price: 199 }, { sku: 'USB-C2', qty: 2, price: 19 }] }, delay: 120 });
  A.mock('/api/user', { body: { id: 'u_17', name: 'Birat', tier: 'gold' }, delay: 60 });
  A.mock('/api/recommendations', { body: [{ sku: 'CASE-1' }, { sku: 'PAD-3' }, { sku: 'STAND' }, { sku: 'DOCK' }], delay: 340 });
  A.mock('/api/coupon', { status: 410, body: { error: 'Coupon expired' }, delay: 90 });
})();
