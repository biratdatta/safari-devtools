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
  if (!TOOL) console.log('  (safari-devtools.js not found next to the relay, so /safari-devtools.js is unavailable)\n');
});
