// 房屋經營 × 連線問答 — 遊戲伺服器（HTTP 靜態檔 + WebSocket；遊戲邏輯在 core.js）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
if (parseInt(process.versions.node, 10) < 16) { console.error('Node.js 版本太舊（' + process.versions.node + '），請安裝 Node.js 18 以上：https://nodejs.org'); process.exit(1); }
const { WebSocketServer } = require('ws');
const { createGame } = require('./core');


// ───────── 存檔：優先用 Node 內建 SQLite（Node 22+）；沒有就改用 JSON 檔（Node 16+ 皆可）─────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
function jsonStorage(file) {
  let data = { accounts: {}, qstats: {}, reports: [] }, need = false;
  try { data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (e) { /* 第一次啟動 */ }
  return {
    accounts: () => Object.entries(data.accounts).map(([username, profile]) => ({ username, profile })),
    qstats: () => Object.entries(data.qstats).map(([id, v]) => ({ id, n: v.n, c: v.c })),
    saveAccount(u, json) { data.accounts[u] = json; need = true; },
    saveQ(id, n, c) { data.qstats[id] = { n, c }; need = true; },
    report(r) { data.reports.push(r); need = true; },
    flush() { if (!need) return; need = false; fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file); },
  };
}
function sqliteStorage(file) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file);
  db.exec(`
CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, profile TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS qstats(id TEXT PRIMARY KEY, n INTEGER NOT NULL, c INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT, qid TEXT, q TEXT, reason TEXT, by TEXT, ts INTEGER);
`);
  const upAcc = db.prepare('INSERT INTO accounts(username, profile) VALUES(?,?) ON CONFLICT(username) DO UPDATE SET profile=excluded.profile');
  const upQ = db.prepare('INSERT INTO qstats(id,n,c) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET n=excluded.n, c=excluded.c');
  const rep = db.prepare('INSERT INTO reports(qid,q,reason,by,ts) VALUES(?,?,?,?,?)');
  return {
    accounts: () => db.prepare('SELECT username, profile FROM accounts').all(),
    qstats: () => db.prepare('SELECT id, n, c FROM qstats').all(),
    saveAccount: (u, json) => upAcc.run(u, json), saveQ: (id, n, c) => upQ.run(id, n, c),
    report: (r) => rep.run(r.qid, r.q, r.reason, r.by, r.ts), flush() {},
  };
}
let storage;
try { if (process.env.NO_SQLITE) throw new Error('forced'); storage = sqliteStorage(path.join(DATA_DIR, 'game.db')); }
catch (e) { storage = jsonStorage(path.join(DATA_DIR, 'game.json')); console.log('提示：這個 Node 版本沒有內建 SQLite，改用 JSON 檔存檔（data/game.json）。'); }

const game = createGame({
  storage, startMoney: process.env.START_MONEY, startLevel: process.env.START_LEVEL,
  hashPw: (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex'),
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
  safeEqual: (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')),
});
process.on('SIGINT', () => { game.flush(); process.exit(0); });
process.on('SIGTERM', () => { game.flush(); process.exit(0); });

// ───────── HTTP + WS ─────────
const MIME = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/catalog.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(game.catalog)); }
  if (f === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (f === '/') f = '/index.html';
  const root = path.join(__dirname, 'public');
  const full = path.join(root, path.normalize(f));
  if (!full.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  const conn = game.connect({ out: (o) => ws.send(JSON.stringify(o)), alive: () => ws.readyState === 1 });
  ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch (e) { return; } conn.message(m); });
  ws.on('close', () => conn.close());
});

const PORT = process.env.PORT || 3000;
wss.on('error', () => {}); // 連接埠被占用時，ws 會轉發錯誤；由下面統一處理
let tries = 0;
server.on('error', (e) => {
  const port = server.address() ? 0 : Number(server.__port);
  if (e.code === 'EADDRINUSE' && tries++ < 10) { console.log(`連接埠 ${port} 已被使用，改用 ${port + 1}…`); server.__port = port + 1; server.listen(port + 1); }
  else { console.error('伺服器無法啟動：', e.message); process.exit(1); }
});
server.on('listening', () => {
  const port = server.address().port;
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${port}`);
  console.log('==============================================');
  console.log(' 遊戲已啟動！請用瀏覽器開啟：');
  console.log(`   本機：http://localhost:${port}`);
  if (lan.length) console.log(`   區網（同一個 Wi-Fi 的其他裝置）：${lan.join('  ')}`);
  console.log(' 題庫：', JSON.stringify(game.bankSize()), '／ 按 Ctrl+C 結束');
  console.log('==============================================');
  if (process.env.OPEN_BROWSER) {
    const url = `http://localhost:${port}`;
    exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`, () => {});
  }
});
server.__port = Number(PORT);
server.listen(server.__port);

