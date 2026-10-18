import { test, expect } from './safari-devtools.fixture';

// Runs against ../demo.html (served by the webServer in playwright.config.ts).

test('demo page loads without console errors', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  await devtools.waitForLog('Demo page loaded');
  expect(await devtools.errors()).toEqual([]);
});

test('uncaught errors are captured with their message', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  await page.getByRole('button', { name: 'throw uncaught' }).click();
  const [err] = await devtools.errors();
  expect(err.text).toContain('undefinedFunction');
});

test('the UI copes with a failing API (mocked before load)', async ({ page, devtools }) => {
  await devtools.mockBeforeLoad('jsonplaceholder.typicode.com/todos', { status: 500, body: { error: 'down' } });
  await page.goto('/demo.html');
  await page.getByRole('button', { name: 'GET (fetch)' }).click();
  const req = await devtools.waitForRequest('todos/1');
  expect(req.status).toBe(500);
  expect(req.mocked).toBe(true);
});

test('offline mode makes fetch fail', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  await devtools.throttle('offline');
  await page.getByRole('button', { name: 'POST JSON' }).click();
  await expect.poll(async () => (await devtools.network({ failed: true })).length).toBeGreaterThan(0);
  await devtools.throttle('none');
});

test('no accessibility errors', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  const errors = (await devtools.audit({ severity: 'error' })).filter((i) => i.group === 'Accessibility');
  expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
});

test('web component exposes its API', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  const c = await devtools.component('user-badge');
  expect(c.defined).toBe(true);
  expect(c.shadowRoot).toBe(true);
});

test('brand token is applied to the card', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  const tokens = await devtools.tokens();
  expect(tokens.map((t) => t.name)).toContain('--brand');
  const css = await devtools.computed('#profile', ['padding-top']);
  expect(css['padding-top']).toBe('16px');
});

test('keyboard users can reach every control, with a name', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  const order = await devtools.tabOrder();
  expect(order.length).toBeGreaterThan(0);
  expect(order.filter((o) => !o.name), 'controls without an accessible name').toEqual([]);
});

test('profile card has no visual regressions (snapshot)', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  await devtools.snapshot('profile', '#profile');
  // ...change something here, e.g. toggle a theme or load new data...
  const { diffs } = await devtools.compareSnapshot('profile');
  expect(diffs, JSON.stringify(diffs, null, 2)).toEqual([]);
});

test('layout survives dark mode, RTL and 200% text', async ({ page, devtools }) => {
  await page.goto('/demo.html');
  await devtools.emulate({ colorScheme: 'dark', dir: 'rtl', textScale: 200 });
  expect(await devtools.errors()).toEqual([]);
});
