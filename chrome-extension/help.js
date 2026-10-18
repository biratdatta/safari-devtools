// Shows why the panel couldn't be opened, with a fix. Details arrive in the URL hash.
let info = {};
try { info = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
const url = info.url || '(unknown: the extension could not read the tab address)';
const err = info.error || '(no message)';
document.getElementById('url').textContent = url;
document.getElementById('err').textContent = err;

function steps(list) { const ol = document.createElement('ol'); list.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ol.appendChild(li); }); return ol; }
let fix;
if (/ExtensionsSettings|policy|blocked by/i.test(err)) {
  fix = ['Your organisation’s Chrome policy blocks extensions on this site (common on work laptops).',
    'Open chrome://policy and look for ExtensionSettings / runtime_blocked_hosts to confirm.',
    'Use the script-tag version on your own app instead, or ask IT to allow the extension or the site.'];
} else if (/^(chrome|edge|about|devtools|chrome-extension|view-source|chrome-error):/i.test(url) || /chromewebstore\.google\.com|chrome\.google\.com\/webstore/.test(url) || /Cannot access a chrome/i.test(err)) {
  fix = ['Chrome never lets extensions run on its own pages (New Tab, settings, chrome://, the Web Store, error pages).',
    'Open a normal website, e.g. https://example.com, and click the icon again.'];
} else if (/^file:/i.test(url) || /file:/.test(err)) {
  fix = ['Open chrome://extensions and click Details on Safari DevTools.',
    'Turn on “Allow access to file URLs”.',
    'Reload the page and click the icon again.'];
} else if (/permission|Cannot access contents|host/i.test(err)) {
  fix = ['Open chrome://extensions and click Details on Safari DevTools.',
    'Under “Site access” choose “On all sites”.',
    'Reload the page and click the icon again.'];
} else if (/No tab|Frame with ID|closed|navigat/i.test(err)) {
  fix = ['The page was still loading or changed while opening. Reload it, wait until it has loaded, and click the icon again.'];
} else {
  fix = ['Reload the page and click the icon again.', 'If it still fails, copy the details below and send them over.'];
}
document.getElementById('fix').appendChild(steps(fix));
document.getElementById('copy').addEventListener('click', () => {
  const text = 'Page: ' + url + '\nError: ' + err + '\nChrome: ' + navigator.userAgent + '\nExtension: ' + chrome.runtime.getManifest().version;
  navigator.clipboard.writeText(text).then(() => { document.getElementById('copy').textContent = 'Copied'; }, () => {});
});
