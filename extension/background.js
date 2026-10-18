// Toolbar button (and Alt+Shift+D in Chrome): show or hide the DevTools panel.
// Shared by the Safari and Chrome extensions.
const ext = globalThis.browser || globalThis.chrome;

function setBadge(tabId, text, title) {
  try {
    ext.action.setBadgeText({ tabId, text });
    if (text) ext.action.setBadgeBackgroundColor({ tabId, color: '#d93025' });
    ext.action.setTitle({ tabId, title: title || 'Toggle DevTools (Alt+Shift+D)' });
  } catch (e) { /* older browsers */ }
}

function whyNot(url, err) {
  const u = String(url || '');
  if (/^(chrome|edge|brave|opera|vivaldi|about|devtools|chrome-extension|safari-web-extension):/.test(u) || /chromewebstore\.google\.com|chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons/.test(u)) {
    return 'The browser doesn’t let extensions run on its own pages (settings, new tab, extension store). Open a normal website.';
  }
  if (/^file:/.test(u)) {
    return 'For local files, open chrome://extensions → Safari DevTools → Details and turn on “Allow access to file URLs”, then reload the page.';
  }
  return 'Couldn’t open DevTools on this page: ' + ((err && err.message) || err || 'unknown error') + '. Try reloading the page.';
}

// Chrome / Edge: run directly in the page's MAIN world. This also works on tabs that were
// open before the extension was installed or reloaded, where the content script isn't connected.
// Pages like claude.ai artifacts, CodePen or Storybook show their real content in an iframe
// that fills the window. Open DevTools in that frame (where the app's console, network and DOM
// live) instead of in the thin wrapper page around it.
async function pickFrame(tabId) {
  let res;
  try {
    res = await ext.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => ({ top: window === window.top, area: innerWidth * innerHeight, w: innerWidth, h: innerHeight }),
    });
  } catch (e) { return 0; } // no access to the frames: use the main page
  const top = res.find((r) => r.frameId === 0 && r.result);
  const topArea = top ? top.result.area : 0;
  let best = null;
  for (const r of res) {
    if (!r.result || r.frameId === 0) continue;
    if (r.result.w < 320 || r.result.h < 240) continue; // ads, widgets, tracking pixels
    if (!best || r.result.area > best.result.area) best = r;
  }
  return best && topArea && best.result.area >= topArea * 0.5 ? best.frameId : 0;
}

async function toggleInFrame(tab, frameId) {
  const target = { tabId: tab.id, frameIds: [frameId] };
  if (frameId !== 0) {
    // Close a panel the wrapper page may have open, so there's only one.
    try { await ext.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: 'MAIN', func: () => { if (window.SafariDevTools) window.SafariDevTools.hide(); } }); } catch (e) {}
  }
  const [r] = await ext.scripting.executeScript({
    target, world: 'MAIN',
    func: () => { if (window.SafariDevTools) { window.SafariDevTools.toggle(); return 'toggled'; } return 'missing'; },
  });
  if (r && r.result === 'toggled') return;
  // Not loaded yet (tab opened before the extension, or the page blocked it): load it now.
  await ext.scripting.executeScript({ target, world: 'MAIN', files: ['sdt-config.js', 'safari-devtools.js'] });
  await ext.scripting.executeScript({ target, world: 'MAIN', func: () => { if (window.SafariDevTools) window.SafariDevTools.show(); } });
}

// Safari: ask the content script, which talks to the page through DOM events.
function toggleWithMessage(tab) {
  const p = ext.tabs.sendMessage(tab.id, { type: 'sdt-command', command: 'toggle' });
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

async function toggleWithScripting(tab) {
  const frameId = await pickFrame(tab.id);
  if (frameId === 0) return toggleInFrame(tab, 0);
  try { await toggleInFrame(tab, frameId); }
  catch (e) { await toggleInFrame(tab, 0); } // that frame can't be scripted: use the main page
}

ext.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  setBadge(tab.id, '', '');
  const perms = (ext.runtime.getManifest().permissions || []);
  if (ext.scripting && ext.scripting.executeScript && perms.indexOf('scripting') !== -1) {
    try { await toggleWithScripting(tab); return; }
    catch (e) {
      // Fall back to the content script (it loads with the page on every normal site).
      try {
        const res = await ext.tabs.sendMessage(tab.id, { type: 'sdt-command', command: 'toggle' });
        if (res && res.ok) return;
      } catch (e2) { /* no content script on this page either */ }
      const msg = whyNot(tab.url, e);
      setBadge(tab.id, '!', msg);
      console.warn('[Safari DevTools] ' + msg, e);
      // Show the exact reason in a tab (Chrome build only; it ships help.html).
      try {
        const detail = encodeURIComponent(JSON.stringify({ url: tab.url || tab.pendingUrl || '', error: String((e && e.message) || e) }));
        ext.tabs.create({ url: ext.runtime.getURL('help.html') + '#' + detail, index: tab.index + 1 });
      } catch (e3) { /* ignore */ }
      return;
    }
  }
  try { toggleWithMessage(tab); } catch (e) { /* page doesn't allow extensions (e.g. Safari settings) */ }
});
