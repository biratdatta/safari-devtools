// Drive the REAL Safari app (not Playwright's WebKit) with WebDriver + safaridriver,
// inject Safari DevTools, and read its data.
//
// One-time setup on the Mac:
//   1. Safari > Settings > Advanced > tick "Show features for web developers"
//   2. Safari > Settings > Developer > tick "Allow remote automation"
//   3. Terminal: safaridriver --enable   (asks for your password once)
//
// Run:  URL=http://localhost:8765/demo.html node real-safari.mjs
import { Builder } from 'selenium-webdriver';
import fs from 'node:fs';

const TOOL = fs.readFileSync(new URL('../safari-devtools.js', import.meta.url), 'utf8');
const URL_TO_TEST = process.env.URL || 'http://localhost:8765/demo.html';

const driver = await new Builder().forBrowser('safari').build();
const sdt = (action, ...args) => driver.executeAsyncScript(
  'const done = arguments[arguments.length - 1];' +
  'Promise.resolve(window.SafariDevTools.automation[arguments[0]](...arguments[1])).then(done, (e) => done({ error: String(e) }));',
  action, args);

try {
  await driver.get(URL_TO_TEST);
  // WebDriver can't run scripts before the page's own, so this captures activity from here on.
  // For full capture, include safari-devtools.js in the page or use the Safari extension.
  await driver.executeScript(TOOL);
  await driver.executeScript("console.log('hello from WebDriver')");

  console.log('Errors:', await sdt('errors'));
  console.log('Audit (errors only):', await sdt('audit', { severity: 'error' }));
  console.log('Viewport:', await sdt('viewport'));
  await sdt('open', 'console'); // show the panel in the real Safari window
  await new Promise((r) => setTimeout(r, 3000));
} finally {
  await driver.quit();
}
