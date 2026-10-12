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


const { openStorage } = require('./storage');
openStorage().then(start).catch((e) => { console.error('啟動失敗：', e); process.exit(1); });

function start(storage) {
const game = createGame({
  storage, startMoney: process.env.START_MONEY, startLevel: process.env.START_LEVEL, timeScale: () => Number(process.env.TIME_SCALE) || 1,
  hashPw: (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex'),
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
  safeEqual: (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')),
});
const bye = async () => { game.flush(); if (storage.drain) await storage.drain(); process.exit(0); };
process.on('SIGINT', bye);
process.on('SIGTERM', bye);

// ───────── HTTP + WS ─────────
const MIME = { '.glb': 'model/gltf-binary', '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/catalog.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(game.catalog)); }
  if (f === '/js/minigames.js') { // 與伺服器共用的小遊戲核心（CommonJS）包成瀏覽器可 import 的模組
    return fs.readFile(path.join(__dirname, 'minigames.js'), 'utf8', (e, src) => {
      if (e) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(`const module = { exports: {} }; (function (module, exports) {\n${src}\n})(module, module.exports);\nexport default module.exports;`);
    });
  }
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
}
