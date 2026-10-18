// The demo app's own code (it has a deliberate bug for the video).
function formatMoney(n) { return '$' + n.toFixed(2); }
function applyCoupon(cart, coupon) {
  return cart.total - coupon.discount.amount; // coupon.discount is undefined for expired coupons
}
async function loadCart() {
  console.log('Checkout loaded', { user: 'birat', items: 2, currency: 'USD' });
  console.info('Feature flags', ['newCheckout', 'applePay']);
  const cart = await fetch('/api/cart').then((r) => r.json());
  fetch('/api/user').then((r) => r.json());
  fetch('/api/recommendations?limit=4').then((r) => r.json());
  console.warn('<acme-avatar>: attribute "user" will be renamed to "name" in v3');
  const coupon = await fetch('/api/coupon?code=SPRING').then((r) => r.json()).catch(() => ({}));
  console.log('Cart total', formatMoney(cart.total));
  try { applyCoupon(cart, coupon); } catch (e) { console.error(e); }
}
if (window.name !== '__sdt_preview') loadCart();
