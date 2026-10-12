// 房屋經營 × 連線問答 — 遊戲伺服器（HTTP 靜態檔 + WebSocket）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { STYLES, CATS, ITEMS } = require('./catalog');
const { buildMatchQuestions, bankSize } = require('./questions');

// ───────── 遊戲參數（想調整數值改這裡）─────────
const CFG = {
  startMoney: 1000,
  entryFee: 50,
  questions: 10,
  questionMs: 15000,
  revealMs: 3500,
  queueWaitMs: 10000,       // 線上配對等不到真人就由電腦頂替
  baseMoney: 10,            // 答對一題基本金額
  comboMul: 1.2,            // 連答倍率
  expPerQuestion: 10,
  comboBonus: { 5: { money: 20, exp: 10 }, 8: { money: 50, exp: 30 }, 10: { money: 100, exp: 50 } },
  firstLevelExp: 200,
  levelMul: 1.3,
  grid: { cols: 8, rows: 5 },
  baseCapacity: 10,
  warehouse: { build: 200, capacity: 50, upgradeBase: 150, upgradeCap: 10 },
  shopBuild: 300,
  sellRate: 0.5,
};
const expNeed = (lv) => Math.round(CFG.firstLevelExp * Math.pow(CFG.levelMul, lv - 1));

// ───────── 存檔 ─────────
const DATA_DIR = path.join(__dirname, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'players.json');
let players = {};
try { players = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch (e) { /* 第一次啟動 */ }
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFile(SAVE_FILE, JSON.stringify(players), () => {});
  }, 500);
}

function newProfile(name, gender) {
  return {
    token: crypto.randomBytes(16).toString('hex'),
    name, gender,
    money: CFG.startMoney, exp: 0, level: 1,
    owned: {}, worn: {},
    house: { wall: null, carpet: null, placed: [] },
    buildings: { warehouse: false, shop: false }, warehouseLv: 0,
    stats: { played: 0, wins: 0, bestCombo: 0 },
  };
}
const capacity = (p) => CFG.baseCapacity + (p.buildings.warehouse ? CFG.warehouse.capacity + CFG.warehouse.upgradeCap * p.warehouseLv : 0);
const itemCount = (p) => Object.values(p.owned).reduce((a, b) => a + b, 0);
const publicProfile = (p) => ({ ...p, token: undefined, expNeed: expNeed(p.level), capacity: capacity(p), itemCount: itemCount(p) });

function addExp(p, amount) {
  p.exp += amount;
  let ups = 0;
  while (p.exp >= expNeed(p.level)) { p.exp -= expNeed(p.level); p.level++; ups++; }
  return ups;
}

// ───────── 連線 ─────────
const sessions = new Set();
const send = (s, o) => { if (s && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(o)); };
const pushProfile = (s) => send(s, { t: 'profile', p: publicProfile(s.p) });
const broadcastOnline = () => sessions.forEach((s) => send(s, { t: 'online', n: [...sessions].filter((x) => x.p).length }));

// ───────── 問答對戰 ─────────
let waiting = null; // { sess, timer }
const BOT_NAMES = ['小電', '阿智機器人', '電腦博士', '腦力王', '百科小子'];

function leaveQueue(sess, refund = true) {
  if (waiting && waiting.sess === sess) {
    clearTimeout(waiting.timer);
    waiting = null;
    if (refund) { sess.p.money += CFG.entryFee; saveSoon(); pushProfile(sess); }
    return true;
  }
  return false;
}

function joinQuiz(sess, mode) {
  if (sess.room || (waiting && waiting.sess === sess)) return send(sess, { t: 'err', msg: '你已在配對或對戰中' });
  if (sess.p.money < CFG.entryFee) return send(sess, { t: 'err', msg: `金錢不足，參加費需要 ${CFG.entryFee} 元` });
  sess.p.money -= CFG.entryFee; saveSoon(); pushProfile(sess);

  const bot = () => ({ bot: true, name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], gender: Math.random() < 0.5 ? 'm' : 'f', acc: 0.55 + Math.random() * 0.35 });
  if (mode === 'bot') return startRoom([{ sess }, bot()]);

  if (waiting) {
    const other = waiting.sess;
    clearTimeout(waiting.timer); waiting = null;
    return startRoom([{ sess: other }, { sess }]);
  }
  waiting = { sess, timer: setTimeout(() => { waiting = null; startRoom([{ sess }, bot()]); }, CFG.queueWaitMs) };
  send(sess, { t: 'queue', ms: CFG.queueWaitMs });
}

function startRoom(entries) {
  const room = {
    qs: buildMatchQuestions(CFG.questions), idx: -1, open: false, timer: null, botTimers: [],
    pl: entries.map((e) => ({
      sess: e.sess || null, bot: !!e.bot, acc: e.acc,
      name: e.sess ? e.sess.p.name : e.name, gender: e.sess ? e.sess.p.gender : e.gender,
      choice: null, answered: 0, correct: 0, streak: 0, chain: 0, bank: 0, bestStreak: 0, exp: 0,
    })),
  };
  room.pl.forEach((pl, i) => {
    if (!pl.sess) return;
    pl.sess.room = room;
    const opp = room.pl[1 - i];
    send(pl.sess, { t: 'matchFound', opp: { name: opp.name, gender: opp.gender, bot: opp.bot }, total: CFG.questions });
  });
  room.timer = setTimeout(() => nextQuestion(room), 2500);
}

const alive = (room) => room.pl.some((p) => p.sess && p.sess.ws.readyState === 1);

function nextQuestion(room) {
  if (!alive(room)) return closeRoom(room, false);
  room.idx++;
  if (room.idx >= room.qs.length) return finishRoom(room);
  const q = room.qs[room.idx];
  room.pl.forEach((p) => { p.choice = null; });
  room.open = true;
  room.pl.forEach((p) => send(p.sess, { t: 'q', i: room.idx, total: room.qs.length, cat: q.cat, q: q.q, opts: q.opts, ms: CFG.questionMs }));
  room.pl.forEach((p, i) => {
    if (!p.bot) return;
    const delay = 2000 + Math.random() * 7000;
    room.botTimers.push(setTimeout(() => {
      const ok = Math.random() < p.acc;
      const wrongs = [0, 1, 2, 3].filter((x) => x !== q.correct);
      answer(room, i, ok ? q.correct : wrongs[Math.floor(Math.random() * 3)]);
    }, delay));
  });
  room.timer = setTimeout(() => resolve(room), CFG.questionMs + 400);
}

function answer(room, i, choice) {
  const p = room.pl[i];
  if (!room.open || p.choice !== null || !Number.isInteger(choice) || choice < 0 || choice > 3) return;
  p.choice = choice;
  room.pl.forEach((o, j) => { if (j !== i) send(o.sess, { t: 'oppAns' }); });
  if (room.pl.every((x) => x.choice !== null)) resolve(room);
}

function resolve(room) {
  if (!room.open) return;
  room.open = false;
  clearTimeout(room.timer);
  room.botTimers.forEach(clearTimeout); room.botTimers = [];
  const q = room.qs[room.idx];
  const events = room.pl.map(() => []);

  room.pl.forEach((p, i) => {
    const answered = p.choice !== null;
    if (answered) { p.answered++; p.exp += CFG.expPerQuestion; }
    if (answered && p.choice === q.correct) {
      p.correct++; p.streak++;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      p.chain = p.streak === 1 ? CFG.baseMoney : (p.chain + CFG.baseMoney) * CFG.comboMul;
      const b = CFG.comboBonus[p.streak];
      if (b) { p.bank += b.money; p.exp += b.exp; events[i].push(`${p.streak} 連答獎勵 +${b.money} 元 +${b.exp} 經驗`); }
    } else {
      p.bank += p.chain; p.chain = 0; p.streak = 0; // 連擊中斷，把累積的錢存起來
    }
  });

  const view = (p) => ({ choice: p.choice, ok: p.choice === q.correct, streak: p.streak, correct: p.correct, chain: Math.round(p.chain), money: Math.round(p.bank + p.chain), exp: p.exp });
  room.pl.forEach((p, i) => {
    send(p.sess, { t: 'reveal', correct: q.correct, you: view(p), opp: view(room.pl[1 - i]), events: events[i], last: room.idx === room.qs.length - 1 });
  });
  room.timer = setTimeout(() => nextQuestion(room), CFG.revealMs);
}

function finishRoom(room) {
  room.pl.forEach((p, i) => {
    if (!p.sess) return;
    const opp = room.pl[1 - i];
    const money = Math.round(p.bank + p.chain);
    const prof = p.sess.p;
    prof.money += money;
    const ups = addExp(prof, p.exp);
    prof.stats.played++;
    if (p.correct > opp.correct) prof.stats.wins++;
    prof.stats.bestCombo = Math.max(prof.stats.bestCombo, p.bestStreak);
    send(p.sess, {
      t: 'end',
      result: p.correct > opp.correct ? 'win' : p.correct < opp.correct ? 'lose' : 'draw',
      you: { correct: p.correct, money, exp: p.exp, bestStreak: p.bestStreak, levelUps: ups },
      opp: { name: opp.name, correct: opp.correct },
      net: money - CFG.entryFee,
    });
    pushProfile(p.sess);
  });
  saveSoon();
  closeRoom(room, true);
}

function closeRoom(room, done) {
  clearTimeout(room.timer);
  room.botTimers.forEach(clearTimeout);
  room.open = false;
  room.pl.forEach((p) => { if (p.sess && p.sess.room === room) p.sess.room = null; });
}

// ───────── 房屋 / 商店 ─────────
const FURN = new Set(Object.keys(CATS).filter((k) => CATS[k].kind === 'furn'));
const wornCount = (p, id) => Object.values(p.worn).filter((x) => x === id).length;
const placedCount = (p, id) => p.house.placed.filter((x) => x.id === id).length;

function validateHouse(p, h) {
  if (!h || typeof h !== 'object') return '資料錯誤';
  const used = {};
  const use = (id) => { used[id] = (used[id] || 0) + 1; return used[id] <= (p.owned[id] || 0); };
  const out = { wall: null, carpet: null, placed: [] };
  if (h.wall) { const it = ITEMS[h.wall]; if (!it || it.cat !== 'wall' || !use(h.wall)) return '牆壁不合法'; out.wall = h.wall; }
  if (h.carpet) { const it = ITEMS[h.carpet]; if (!it || it.cat !== 'carpet' || !use(h.carpet)) return '地毯不合法'; out.carpet = h.carpet; }
  if (!Array.isArray(h.placed) || h.placed.length > CFG.grid.cols * CFG.grid.rows * 2) return '擺放資料錯誤';
  const cells = new Set();
  for (const pl of h.placed) {
    const it = pl && ITEMS[pl.id];
    if (!it || !FURN.has(it.cat)) return '家具不合法';
    if (!Number.isInteger(pl.x) || !Number.isInteger(pl.y) || pl.x < 0 || pl.y < 0 || pl.x >= CFG.grid.cols || pl.y >= CFG.grid.rows) return '位置超出範圍';
    const key = `${pl.x},${pl.y},${it.cat === 'mattress' ? 'm' : 'f'}`; // 床墊可疊在其他家具上
    if (cells.has(key)) return '該格已有家具';
    cells.add(key);
    if (!use(pl.id)) return '你沒有足夠的家具';
    out.placed.push({ id: pl.id, x: pl.x, y: pl.y });
  }
  p.house = out;
  return null;
}

function handle(sess, m) {
  const p = sess.p;
  const err = (msg) => send(sess, { t: 'err', msg });
  const ok = () => { saveSoon(); pushProfile(sess); };

  switch (m.t) {
    case 'quiz': return joinQuiz(sess, m.mode);
    case 'cancelQueue': if (leaveQueue(sess)) send(sess, { t: 'queueCancelled' }); return;
    case 'answer': if (sess.room) { const i = sess.room.pl.findIndex((x) => x.sess === sess); if (i >= 0) answer(sess.room, i, m.choice); } return;
    case 'buy': {
      if (!p.buildings.shop) return err('請先建造商店');
      const it = ITEMS[m.id];
      if (!it) return err('沒有這個商品');
      if (p.level < it.lv) return err(`需要等級 ${it.lv}`);
      if (p.money < it.price) return err('金錢不足');
      if (itemCount(p) >= capacity(p)) return err('倉庫已滿，請先建造/升級倉庫或賣出物品');
      p.money -= it.price; p.owned[it.id] = (p.owned[it.id] || 0) + 1;
      return ok();
    }
    case 'sell': {
      if (!p.buildings.shop) return err('請先建造商店');
      const it = ITEMS[m.id];
      if (!it || (p.owned[it.id] || 0) - placedCount(p, it.id) - wornCount(p, it.id) - (p.house.wall === it.id ? 1 : 0) - (p.house.carpet === it.id ? 1 : 0) <= 0) return err('此物品使用中或不存在，請先取下');
      p.owned[it.id]--; if (!p.owned[it.id]) delete p.owned[it.id];
      p.money += Math.floor(it.price * CFG.sellRate);
      return ok();
    }
    case 'build': {
      if (m.kind === 'warehouse') {
        if (p.buildings.warehouse) return err('已建造');
        if (p.money < CFG.warehouse.build) return err('金錢不足');
        p.money -= CFG.warehouse.build; p.buildings.warehouse = true;
      } else if (m.kind === 'shop') {
        if (p.buildings.shop) return err('已建造');
        if (p.money < CFG.shopBuild) return err('金錢不足');
        p.money -= CFG.shopBuild; p.buildings.shop = true;
      } else return err('未知建築');
      return ok();
    }
    case 'upgradeWarehouse': {
      if (!p.buildings.warehouse) return err('請先建造倉庫');
      const cost = CFG.warehouse.upgradeBase * (p.warehouseLv + 1);
      if (p.money < cost) return err(`升級需要 ${cost} 元`);
      p.money -= cost; p.warehouseLv++;
      return ok();
    }
    case 'house': { const e = validateHouse(p, m.house); if (e) { err(e); return pushProfile(sess); } return ok(); }
    case 'equip': {
      if (!['head', 'suit', 'top', 'bottom', 'shoes'].includes(m.slot)) return err('部位錯誤');
      if (m.id) {
        const it = ITEMS[m.id];
        if (!it || it.cat !== m.slot || !p.owned[m.id]) return err('無法穿戴');
        p.worn[m.slot] = m.id;
      } else delete p.worn[m.slot];
      return ok();
    }
  }
}

// ───────── HTTP + WS ─────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(__dirname, 'public', path.normalize(f));
  if (!full.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  const sess = { ws, p: null, room: null };
  sessions.add(sess);
  let msgs = 0;
  const rateTimer = setInterval(() => { msgs = 0; }, 1000);

  ws.on('message', (raw) => {
    if (++msgs > 30) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hello' || m.t === 'create') {
      if (m.t === 'hello') {
        const found = Object.values(players).find((x) => x.token === m.token);
        if (!found) return send(sess, { t: 'needCreate' });
        sess.p = found;
      } else {
        const name = String(m.name || '').trim().slice(0, 12);
        if (!name) return send(sess, { t: 'err', msg: '請輸入名字' });
        if (m.gender !== 'm' && m.gender !== 'f') return send(sess, { t: 'err', msg: '請選擇性別' });
        sess.p = newProfile(name, m.gender);
        players[sess.p.token] = sess.p;
        saveSoon();
      }
      // 同一帳號重複登入時，踢掉舊連線
      sessions.forEach((o) => { if (o !== sess && o.p === sess.p) { leaveQueue(o, true); o.p = null; send(o, { t: 'kicked' }); } });
      send(sess, { t: 'welcome', token: sess.p.token, p: publicProfile(sess.p), catalog: { items: ITEMS, cats: CATS, styles: STYLES }, cfg: { entryFee: CFG.entryFee, grid: CFG.grid, warehouse: CFG.warehouse, shopBuild: CFG.shopBuild, sellRate: CFG.sellRate, questionMs: CFG.questionMs } });
      return broadcastOnline();
    }
    if (!sess.p) return;
    handle(sess, m);
  });

  ws.on('close', () => {
    clearInterval(rateTimer);
    sessions.delete(sess);
    if (sess.p) leaveQueue(sess, true);
    broadcastOnline();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`遊戲啟動：http://localhost:${PORT}  題庫：`, bankSize()));
