#!/usr/bin/env node
/*
 * Safari DevTools remote relay: zero dependencies, Node 16+.
 *
 *   node remote/relay.js            (PORT=9230 by default)
 *
 * On your iPhone, load the page with the tool pointed at this relay:
 *   <script src="http://<mac-ip>:9230/safari-devtools.js" data-remote="http://<mac-ip>:9230"></script>
 * or add ?sdt-remote=http://<mac-ip>:9230 to a page that already includes the tool,
 * or open http://<mac-ip>:9230/demo on the phone to try it.
 * Then open http://localhost:9230 on your Mac to watch the console & network and run code on the phone.
 *
 * Automation / AI agents: JSON API under /api (see README), and remote/mcp.js for MCP clients.
 * Control endpoints (viewer, /api, /eval) only answer requests from this Mac unless you
 * set a token:  SDT_TOKEN=some-secret node remote/relay.js  -> send "Authorization: Bearer some-secret"
 * (or ?token=some-secret). The phone-side endpoints (/push, /cmd, /safari-devtools.js) stay open.
 *
 * Optional integrations (keys stay in this process):
 *   ANTHROPIC_API_KEY=... [SDT_MODEL=claude-sonnet-5-5]            -> "Explain this error" in the panel
 *   JIRA_URL=https://you.atlassian.net JIRA_EMAIL=... JIRA_TOKEN=... JIRA_PROJECT=KEY [JIRA_ISSUE_TYPE=Bug]
 *                                                                     -> one-click Jira bug reports
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = +process.env.PORT || 9230;
const TOKEN = process.env.SDT_TOKEN || (process.argv.indexOf('--token') !== -1 ? process.argv[process.argv.indexOf('--token') + 1] : '');
const pendingResults = new Map(); // command id -> { resolve, timer }
const HERE = __dirname;
const TOOL = [path.join(HERE, '..', 'safari-devtools.js'), path.join(HERE, '..', 'standalone', 'safari-devtools.js')].find((p) => fs.existsSync(p));
const VIEWER = path.join(HERE, 'viewer.html');

const clients = new Map(); // id -> { id, info, buf, cmds, waiters, lastSeen }
const viewers = new Set(); // { res, client }
let cmdSeq = 0;

function client(id) {
  if (!clients.has(id)) clients.set(id, { id, info: {}, buf: [], cmds: [], waiters: [], lastSeen: Date.now() });
  const c = clients.get(id);
  c.lastSeen = Date.now();
  return c;
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}
function json(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}
function readBody(req, limit = 5e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function broadcast(id, msgs) {
  for (const v of viewers) {
    if (v.client && v.client !== id) continue;
    for (const m of msgs) v.res.write('data: ' + JSON.stringify(Object.assign({ client: id }, m)) + '\n\n');
  }
}
function isLocal(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}
function authorized(req, url) {
  if (TOKEN) {
    const h = req.headers.authorization || '';
    return h === 'Bearer ' + TOKEN || url.searchParams.get('token') === TOKEN;
  }
  return isLocal(req);
}
// "Explain this error" (Claude) and Jira bug reports. Secrets come from the environment
// and never leave this process.
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.SDT_MODEL || 'claude-sonnet-5-5';
const AI_URL = process.env.SDT_AI_URL || 'https://api.anthropic.com/v1/messages';
const JIRA = { url: (process.env.JIRA_URL || '').replace(/\/+$/, ''), email: process.env.JIRA_EMAIL || '', token: process.env.JIRA_TOKEN || '', project: process.env.JIRA_PROJECT || '', issueType: process.env.JIRA_ISSUE_TYPE || 'Bug' };
const ORIGINS = (process.env.SDT_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
// These endpoints spend API credit / create tickets, so a random website open in your
// browser must not be able to call them. Allowed: a valid token, or a request from this
// Mac whose page origin is local (localhost, 127.0.0.1, *.local, *.test) or listed in SDT_ORIGINS.
function integrationAllowed(req, url) {
  if (TOKEN) return authorized(req, url);
  if (!isLocal(req)) return false;
  const o = req.headers.origin;
  if (!o || o === 'null') return true;
  try {
    const host = new URL(o).hostname;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) || /\.(localhost|local|test)$/.test(host) || ORIGINS.includes(o) || ORIGINS.includes(host);
  } catch (e) { return false; }
}
// Plain text -> Atlassian Document Format. Lines between {code} / {noformat} or ``` become code blocks,
// "h3. Title" becomes a heading, "* item" a bullet list.
function toAdf(text) {
  const content = []; let code = null; let list = null;
  const para = (t) => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] });
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const fence = /^(\{code(:[^}]*)?\}|\{noformat\}|```\w*)$/.test(line.trim());
    if (fence) { if (code) { content.push({ type: 'codeBlock', content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] }); code = null; } else { list = null; code = []; } continue; }
    if (code) { code.push(raw); continue; }
    const m = line.match(/^h([1-6])\.\s+(.*)$/);
    if (m) { list = null; content.push({ type: 'heading', attrs: { level: +m[1] }, content: [{ type: 'text', text: m[2] }] }); continue; }
    const b = line.match(/^[*#-]\s+(.*)$/);
    if (b) { if (!list) { list = { type: 'bulletList', content: [] }; content.push(list); } list.content.push({ type: 'listItem', content: [para(b[1])] }); continue; }
    list = null;
    if (line.trim()) content.push(para(line.replace(/\*([^*]+)\*/g, '$1')));
  }
  if (code) content.push({ type: 'codeBlock', content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] });
  return { type: 'doc', version: 1, content: content.length ? content : [para('')] };
}

function pickClient(id) {
  if (id && clients.has(id)) return clients.get(id);
  const list = [...clients.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  return list[0] || null;
}
// Queue a command for the page and wait for its result.
function runOnDevice(c, cmd, timeoutMs) {
  cmd.id = ++cmdSeq;
  c.cmds.push(cmd);
  flushCmds(c);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pendingResults.delete(cmd.id); resolve({ ok: false, error: 'Timed out after ' + timeoutMs + ' ms. Is the page open and in the foreground? (iOS pauses background tabs.)' }); }, timeoutMs);
    pendingResults.set(cmd.id, { resolve, timer });
  });
}
function clientList() {
  return [...clients.values()].sort((a, b) => b.lastSeen - a.lastSeen).map((c) => ({
    id: c.id, url: c.info.url, title: c.info.title, ua: c.info.ua, viewport: c.info.viewport, lastSeen: c.lastSeen, online: Date.now() - c.lastSeen < 30000,
  }));
}
function flushCmds(c) {
  if (!c.cmds.length) return;
  const w = c.waiters.splice(0);
  if (!w.length) return;
  const cmds = c.cmds.splice(0);
  w.forEach((res, i) => json(res, 200, i === 0 ? cmds : []));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url, 'http://x');
  const id = (url.searchParams.get('client') || '').replace(/[^\w-]/g, '').slice(0, 40);
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (url.pathname === '/push' && req.method === 'POST') {
      if (!id) return json(res, 400, { error: 'client required' });
      const c = client(id);
      const msgs = JSON.parse((await readBody(req)) || '[]');
      msgs.forEach((m) => {
        m.at = Date.now();
        if (m.type === 'hello') c.info = m;
        if (m.type === 'result' && pendingResults.has(m.id)) {
          const p = pendingResults.get(m.id); pendingResults.delete(m.id); clearTimeout(p.timer);
          p.resolve(m.ok ? { ok: true, value: m.value } : { ok: false, error: m.value });
        }
        c.buf.push(m);
      });
      if (c.buf.length > 5000) c.buf.splice(0, c.buf.length - 5000);
      broadcast(id, msgs);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === '/cmd' && req.method === 'GET') {
      if (!id) return json(res, 400, { error: 'client required' });
      const c = client(id);
      if (c.cmds.length) return json(res, 200, c.cmds.splice(0));
      c.waiters.push(res);
      const t = setTimeout(() => { const i = c.waiters.indexOf(res); if (i !== -1) { c.waiters.splice(i, 1); json(res, 200, []); } }, 25000);
      req.on('close', () => { clearTimeout(t); const i = c.waiters.indexOf(res); if (i !== -1) c.waiters.splice(i, 1); });
      return;
    }

    // ---- AI explain + Jira (keys stay on this Mac; the page never sees them) ----
    if (url.pathname === '/ai/explain' || url.pathname.startsWith('/jira/')) {
      if (!integrationAllowed(req, url)) return json(res, 403, { error: 'Not allowed. From another device or a non-local site, start the relay with SDT_TOKEN and enter the token in the panel, or list the site in SDT_ORIGINS.' });
    }
    if (url.pathname === '/ai/explain' && req.method === 'POST') {
      if (!AI_KEY) return json(res, 501, { error: 'Set ANTHROPIC_API_KEY when starting the relay to enable "Ask Claude".' });
      const body = JSON.parse((await readBody(req, 4e5)) || '{}');
      const prompt = String(body.prompt || '').slice(0, 120000);
      if (!prompt) return json(res, 400, { error: 'Missing prompt' });
      const r = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 1500, system: 'You are a senior front-end engineer helping debug a web page (Safari or Chrome; the user agent is in the context). Be concise and concrete: name the root cause, point to the exact line, and give a minimal code fix. Use Markdown with fenced code blocks.', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, 502, { error: (data.error && data.error.message) || ('Anthropic API returned ' + r.status) });
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return json(res, 200, { text, model: data.model || AI_MODEL });
    }
    if (url.pathname === '/jira/config') return json(res, 200, { configured: !!(JIRA.url && JIRA.email && JIRA.token && JIRA.project), project: JIRA.project || null, host: JIRA.url ? new URL(JIRA.url).host : null, ai: !!AI_KEY });
    if (url.pathname === '/jira/create' && req.method === 'POST') {
      if (!(JIRA.url && JIRA.email && JIRA.token && JIRA.project)) return json(res, 501, { error: 'Set JIRA_URL, JIRA_EMAIL, JIRA_TOKEN and JIRA_PROJECT when starting the relay.' });
      const body = JSON.parse((await readBody(req, 25e6)) || '{}');
      const auth = 'Basic ' + Buffer.from(JIRA.email + ':' + JIRA.token).toString('base64');
      const fields = { project: { key: JIRA.project }, issuetype: { name: JIRA.issueType }, summary: String(body.summary || 'Bug').slice(0, 250), description: toAdf(String(body.description || '')) };
      if (Array.isArray(body.labels) && body.labels.length) fields.labels = body.labels.map(String);
      const r = await fetch(JIRA.url + '/rest/api/3/issue', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ fields }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, 502, { error: 'Jira: ' + (Object.values(data.errors || {}).join('; ') || (data.errorMessages || []).join('; ') || r.status) });
      const attachErrors = [];
      for (const a of (Array.isArray(body.attachments) ? body.attachments : []).slice(0, 10)) {
        try {
          const buf = a.base64 != null ? Buffer.from(String(a.base64), 'base64') : Buffer.from(String(a.text || ''), 'utf8');
          const fd = new FormData();
          fd.append('file', new Blob([buf], { type: a.type || 'application/octet-stream' }), String(a.name || 'attachment').replace(/[\\/]/g, '_'));
          const ar = await fetch(JIRA.url + '/rest/api/3/issue/' + data.key + '/attachments', { method: 'POST', headers: { authorization: auth, 'X-Atlassian-Token': 'no-check' }, body: fd });
          if (!ar.ok) attachErrors.push(a.name + ': HTTP ' + ar.status);
        } catch (e) { attachErrors.push(a.name + ': ' + e.message); }
      }
      return json(res, 200, { key: data.key, url: JIRA.url + '/browse/' + data.key, attachErrors });
    }

    const control = url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/events' || url.pathname === '/clients' || url.pathname === '/eval' || url.pathname.startsWith('/api/');
    if (control && !authorized(req, url)) {
      return json(res, 401, { error: TOKEN ? 'Missing or wrong token' : 'Control endpoints only answer requests from this computer. Start the relay with SDT_TOKEN=... to allow other machines.' });
    }

    // ---- JSON API for automation and AI agents
    if (url.pathname === '/api/devices') return json(res, 200, clientList());
    if (url.pathname === '/api/logs' || url.pathname === '/api/network') {
      const c = pickClient(id);
      if (!c) return json(res, 404, { error: 'No device connected yet' });
      const want = url.pathname === '/api/logs' ? 'log' : 'net';
      const level = url.searchParams.get('level'), text = (url.searchParams.get('text') || '').toLowerCase(), limit = +url.searchParams.get('limit') || 200;
      const out = c.buf.filter((m) => m.type === want && (!level || m.level === level) && (!text || JSON.stringify(m).toLowerCase().includes(text))).slice(-limit);
      return json(res, 200, { device: c.id, items: out });
    }
    if ((url.pathname === '/api/eval' || url.pathname === '/api/call') && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 1e6)) || '{}');
      const c = pickClient(body.client || id);
      if (!c) return json(res, 404, { error: 'No device connected yet' });
      const cmd = url.pathname === '/api/eval' ? { code: String(body.code || '') } : { action: String(body.action || ''), args: Array.isArray(body.args) ? body.args : [] };
      const result = await runOnDevice(c, cmd, Math.min(+body.timeout || 15000, 120000));
      return json(res, result.ok ? 200 : 422, Object.assign({ device: c.id }, result));
    }

    if (url.pathname === '/eval' && req.method === 'POST') {
      const c = clients.get(id);
      if (!c) return json(res, 404, { error: 'unknown client' });
      const { code } = JSON.parse(await readBody(req, 1e6));
      const cmd = { id: ++cmdSeq, code: String(code || '') };
      c.cmds.push(cmd);
      flushCmds(c);
      return json(res, 200, { id: cmd.id });
    }

    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const v = { res, client: id || null };
      viewers.add(v);
      if (id && clients.has(id)) clients.get(id).buf.forEach((m) => res.write('data: ' + JSON.stringify(Object.assign({ client: id }, m)) + '\n\n'));
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); viewers.delete(v); });
      return;
    }

    if (url.pathname === '/clients') return json(res, 200, clientList());

    if (url.pathname === '/safari-devtools.js' && TOOL) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
      return fs.createReadStream(TOOL).pipe(res);
    }

    if (url.pathname === '/demo') {
      const host = req.headers.host;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Remote demo</title><script src="http://${host}/safari-devtools.js" data-remote="http://${host}"></script>
<body style="font:17px -apple-system,system-ui;padding:24px"><h1>Remote demo</h1><p>This page streams to your Mac. Tap the buttons, then watch <b>http://localhost:${PORT}</b> on the Mac.</p>
<p><button onclick="console.log('Hello from the phone', {time: new Date().toLocaleTimeString(), ua: navigator.userAgent})">console.log</button>
<button onclick="console.error(new Error('Something broke on the phone'))">error</button>
<button onclick="fetch('/demo').then(r=>console.log('fetched /demo:', r.status))">fetch</button></p></body>`);
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return fs.createReadStream(VIEWER).pipe(res);
    }

    res.writeHead(404); res.end('Not found');
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  const ip = ips[0] || 'localhost';
  console.log(`\nSafari DevTools relay running.\n`);
  console.log(`  Viewer on this Mac:   http://localhost:${PORT}`);
  console.log(`  Try it on the iPhone: http://${ip}:${PORT}/demo   (same Wi-Fi)`);
  console.log(`\n  In your own page:\n    <script src="http://${ip}:${PORT}/safari-devtools.js" data-remote="http://${ip}:${PORT}"></script>`);
  console.log(`  or add  ?sdt-remote=http://${ip}:${PORT}  to a page that already loads the tool.\n`);
  console.log(TOKEN ? `  Automation API: http://${ip}:${PORT}/api  (token required)\n` : `  Automation API: http://localhost:${PORT}/api  (this Mac only; set SDT_TOKEN to allow others)\n`);
  console.log(`  Explain with Claude: ${AI_KEY ? 'on (' + AI_MODEL + ')' : 'off (set ANTHROPIC_API_KEY)'}   Jira: ${JIRA.url && JIRA.project ? 'on (' + JIRA.project + ')' : 'off (set JIRA_URL, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT)'}\n`);
  if (!TOOL) console.log('  (safari-devtools.js not found next to the relay, so /safari-devtools.js is unavailable)\n');
});
