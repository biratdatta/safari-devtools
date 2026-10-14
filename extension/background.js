// Toolbar button: tell the page's content script to toggle the DevTools panel.
const ext = globalThis.browser || globalThis.chrome;

ext.action.onClicked.addListener((tab) => {
  if (!tab || tab.id == null) return;
  try {
    const p = ext.tabs.sendMessage(tab.id, { type: 'sdt-command', command: 'toggle' });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    // Page doesn't allow extensions (e.g. a Safari settings page); nothing to do.
  }
});
