// Chrome / Edge: runs in the page's MAIN world just before safari-devtools.js.
// A MAIN-world content script has no <script> tag, so the settings that the
// Safari extension passes as data-* attributes are passed here instead.
window.__SDT_CONFIG__ = { source: 'extension', launcher: 'false' };
