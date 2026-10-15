#!/usr/bin/env node
/*
 * Safari DevTools MCP server: lets AI agents (Claude Desktop, Claude Code, Cursor, …)
 * read the console/network of a page running in Safari or on an iPhone, run JavaScript,
 * mock requests, audit the page and inspect elements. Zero dependencies, Node 18+.
 *
 * It talks to the relay (node remote/relay.js), so start that first.
 *
 *   Claude Code:     claude mcp add safari-devtools -- node /path/to/remote/mcp.js
 *   Claude Desktop:  "mcpServers": { "safari-devtools": { "command": "node", "args": ["/path/to/remote/mcp.js"] } }
 *
 * Env: SDT_RELAY (default http://localhost:9230), SDT_TOKEN (if the relay uses one).
 */
'use strict';
const RELAY = (process.env.SDT_RELAY || 'http://localhost:9230').replace(/\/+$/, '');
const TOKEN = process.env.SDT_TOKEN || '';
const MAX = 60000;

async function relay(path, body) {
  const headers = { 'content-type': 'application/json' };
  if (TOKEN) headers.authorization = 'Bearer ' + TOKEN;
  let res;
  try {
    res = await fetch(RELAY + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  } catch (e) {
    throw new Error('Cannot reach the relay at ' + RELAY + '. Start it with: node remote/relay.js');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) : 'Relay error ' + res.status);
  return data;
}
const call = (action, args, device, timeout) => relay('/api/call', { action, args: args || [], client: device, timeout }).then((r) => r.value);
const qs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

const device = { type: 'string', description: 'Device id from list_devices. Defaults to the most recently active page.' };
const TOOLS = [
  { name: 'list_devices', description: 'List pages/devices connected to the Safari DevTools relay (URL, user agent, viewport, online).', inputSchema: { type: 'object', properties: {} },
    run: () => relay('/api/devices') },
  { name: 'get_console', description: 'Console messages from the page (logs, warnings, errors, uncaught exceptions with source-mapped locations).',
    inputSchema: { type: 'object', properties: { level: { type: 'string', enum: ['error', 'warn', 'info', 'verbose'] }, text: { type: 'string', description: 'Only messages containing this text' }, limit: { type: 'number' }, device } },
    run: (a) => relay('/api/logs?' + qs({ client: a.device, level: a.level, text: a.text, limit: a.limit || 100 })) },
  { name: 'get_network', description: 'Network requests made by the page (fetch, XHR, WebSocket, EventSource, plus resources) with status, timing and size. Set details=true for headers and bodies.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'Substring or /regex/ to filter URLs' }, failed: { type: 'boolean' }, details: { type: 'boolean' }, device } },
    run: (a) => call('network', [{ url: a.url, failed: a.failed, bodies: !!a.details }], a.device) },
  { name: 'run_js', description: 'Run JavaScript in the page and return the result (awaits promises). Has access to window, document and the SafariDevTools API.',
    inputSchema: { type: 'object', properties: { code: { type: 'string' }, device }, required: ['code'] },
    run: (a) => relay('/api/eval', { code: a.code, client: a.device }).then((r) => r.value) },
  { name: 'audit_page', description: 'Audit the page for Safari/iPhone pitfalls and accessibility problems (incl. inside shadow DOM). Returns issues with CSS selectors.',
    inputSchema: { type: 'object', properties: { severity: { type: 'string', enum: ['error', 'warning', 'info'] }, device } },
    run: (a) => call('audit', [{ severity: a.severity }], a.device, 30000) },
  { name: 'inspect_element', description: 'Describe an element: box, text, matched CSS rules, key computed styles, event listeners and (for web components) properties/slots/parts. ">>>" pierces shadow roots, e.g. "user-card >>> .label".',
    inputSchema: { type: 'object', properties: { selector: { type: 'string' }, device }, required: ['selector'] },
    run: async (a) => {
      const [element, styles, listeners] = await Promise.all([call('element', [a.selector], a.device), call('styles', [a.selector], a.device), call('listeners', [a.selector], a.device)]);
      const computed = await call('computed', [a.selector, ['display', 'position', 'width', 'height', 'margin', 'padding', 'color', 'background-color', 'font-size', 'font-family', 'z-index', 'overflow', 'visibility', 'opacity']], a.device);
      const out = { element, computed, styles, listeners };
      if (element && element.tag && element.tag.includes('-')) out.component = await call('component', [a.selector], a.device).catch(() => null);
      return out;
    } },
  { name: 'query_elements', description: 'Find elements matching a CSS selector (searches inside open shadow roots too).',
    inputSchema: { type: 'object', properties: { selector: { type: 'string' }, limit: { type: 'number' }, device }, required: ['selector'] },
    run: (a) => call('query', [a.selector, a.limit || 20], a.device) },
  { name: 'mock_request', description: 'Mock fetch/XHR responses whose URL matches (substring, * wildcard or /regex/). Returns a rule id.',
    inputSchema: { type: 'object', properties: { match: { type: 'string' }, status: { type: 'number' }, body: { description: 'Response body (string or JSON)' }, contentType: { type: 'string' }, delayMs: { type: 'number' }, method: { type: 'string' }, device }, required: ['match'] },
    run: (a) => call('mock', [a.match, { status: a.status, body: a.body, type: a.contentType, delay: a.delayMs, method: a.method }], a.device) },
  { name: 'block_request', description: 'Make matching fetch/XHR requests fail, to test error handling.',
    inputSchema: { type: 'object', properties: { match: { type: 'string' }, device }, required: ['match'] },
    run: (a) => call('block', [a.match], a.device) },
  { name: 'clear_request_rules', description: 'Remove all mock/block/delay rules.', inputSchema: { type: 'object', properties: { device } },
    run: (a) => call('clearRules', [], a.device) },
  { name: 'set_throttling', description: 'Simulate a slow or offline network for fetch/XHR.',
    inputSchema: { type: 'object', properties: { preset: { type: 'string', enum: ['none', 'fast4g', 'fast3g', 'slow3g', 'offline'] }, device }, required: ['preset'] },
    run: (a) => call('throttle', [a.preset], a.device) },
  { name: 'get_design_tokens', description: 'All CSS custom properties (--tokens) on the page with current values, usage counts and where they are defined.',
    inputSchema: { type: 'object', properties: { device } }, run: (a) => call('tokens', [], a.device) },
  { name: 'get_performance', description: 'Performance metrics: FCP, LCP, CLS, INP, TTFB, load timings, FPS and DOM size (where Safari exposes them).',
    inputSchema: { type: 'object', properties: { device } }, run: (a) => call('perf', [], a.device) },
  { name: 'get_storage', description: 'localStorage, sessionStorage and (non-HttpOnly) cookies.', inputSchema: { type: 'object', properties: { device } },
    run: (a) => call('storage', [], a.device) },
  { name: 'get_viewport', description: 'Viewport size, device pixel ratio, safe-area insets and measured 100vh/svh/lvh/dvh.', inputSchema: { type: 'object', properties: { device } },
    run: (a) => call('viewport', [], a.device) },
  { name: 'debug_report', description: 'Full debug report: page info, console, network, performance, storage and active rules.', inputSchema: { type: 'object', properties: { device } },
    run: (a) => call('report', [], a.device, 30000) },
];

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function text(v) { let s = typeof v === 'string' ? v : JSON.stringify(v, null, 2); if (s && s.length > MAX) s = s.slice(0, MAX) + '\n… (truncated)'; return s; }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return send({ jsonrpc: '2.0', id, result: { protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: { tools: {} },
      serverInfo: { name: 'safari-devtools', version: '1.1.0' },
      instructions: 'Inspect and control web pages running in Safari or on an iPhone via the Safari DevTools relay. Call list_devices first.' } });
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === (params && params.name));
    if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool ' + (params && params.name) } });
    try {
      const out = await tool.run((params && params.arguments) || {});
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: text(out) }] } });
    } catch (e) {
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Error: ' + (e.message || e) }], isError: true } });
    }
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch (e) { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    handle(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
