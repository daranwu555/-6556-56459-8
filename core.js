// 遊戲核心（Node 伺服器與瀏覽器單機版共用）。與傳輸方式（WebSocket / 本機）無關。
const { STYLES, CATS, ITEMS } = require('./catalog');
const { buildMatchQuestions, bankSize } = require('./questions');

// env: { storage, hashPw(pw,salt), randomHex(n), safeEqual(a,b), startMoney, startLevel, offline }
//   storage: { accounts():[{username,profile}], qstats():[{id,n,c}], saveAccount(u,json), saveQ(id,n,c), report(row), flush() }
function createGame(env) {
// ───────── 遊戲參數（想調整數值改這裡）─────────
const CFG = {
  startMoney: Number(env.startMoney) || 1000,
  entryFee: 50,
  questions: 10,
  questionMs: 15000,
  revealMs: 3500,
  queueWaitMs: 10000,        // 線上配對等不到真人就由電腦頂替
  codeWaitMs: 120000,        // 邀請碼房間等待時間
  baseMoney: 10,             // 答對一題基本金額
  comboMul: 1.2,             // 老手連答倍率（+20%）
  noviceMul: 1.6,            // 新手「遇到老手」時的連答倍率（+60%）；雙方都是新手或對電腦則維持 comboMul
  noviceLevel: 15,           // 等級 <= 此值視為新手
  likeReward: 5,             // 按讚的人獲得的金額
  likeDailyCap: 5,           // 每人每天最多領幾次按讚獎勵（防止開小帳號洗錢）
  expPerQuestion: 10,
  comboBonus: { 5: { money: 20, exp: 10 }, 8: { money: 50, exp: 30 }, 10: { money: 100, exp: 50 } },
  firstLevelExp: 200,
  levelMul: 1.3,
  styleBonus: { ratio: 0.8, minItems: 6, rate: 0.05 }, // 房屋風格 >=80% 且 >=6 件 → 答題金錢 +5%
  warehouse: { base: 50, upgradeCap: 5, upgradeBase: 150 }, // 倉庫放建材
  shopBuild: 300,
  sellRate: 0.35,
  renameCost: 100000,        // 改名費用（取名免費，改名要錢）
  // 房屋等級：cols × rows 為房間大小（公尺）；第 n 項 = 擴建到等級 n+1 的條件
  houseLevels: [
    { cols: 6, rows: 4 },
    { cols: 7, rows: 4, money: 300, mats: { material_wood: 5, material_brick: 5 } },
    { cols: 7, rows: 5, money: 500, mats: { material_wood: 8, material_brick: 8, material_cement: 5 } },
    { cols: 8, rows: 5, money: 800, mats: { material_brick: 10, material_cement: 10, material_glass: 5 } },
    { cols: 9, rows: 5, money: 1200, mats: { material_wood: 10, material_cement: 10, material_glass: 10, material_steel: 10 } },
    { cols: 10, rows: 6, money: 2000, mats: { material_brick: 20, material_cement: 20, material_glass: 15, material_steel: 20 } },
  ],
  seenKeep: 300,             // 每位玩家記住最近見過的題數，盡量不重複
};
const expNeed = (lv) => Math.round(CFG.firstLevelExp * Math.pow(CFG.levelMul, lv - 1));
const gridOf = (p) => CFG.houseLevels[p.houseLv - 1];

  // ───────── 資料（記憶體為主、定時寫回 storage）─────────
  const players = new Map();   // username -> profile
  const byToken = new Map();   // token -> profile
  const byPid = new Map();     // pid -> profile
  const qstats = new Map();    // qid -> {n,c}
  const dirty = new Set(), dirtyQ = new Set();
  for (const r of env.storage.accounts()) {
    const p = JSON.parse(r.profile);
    if (p.house.placed.some((x) => !Number.isFinite(x.z))) p.house.placed = []; // 舊版格子資料
    players.set(r.username, p); byToken.set(p.token, p); byPid.set(p.pid, p);
  }
  for (const r of env.storage.qstats()) qstats.set(r.id, { n: r.n, c: r.c });
  function flush() {
    for (const u of dirty) { const p = players.get(u); if (p) env.storage.saveAccount(u, JSON.stringify(p)); }
    for (const id of dirtyQ) { const s = qstats.get(id); if (s) env.storage.saveQ(id, s.n, s.c); }
    dirty.clear(); dirtyQ.clear();
    env.storage.flush();
  }
  const flushTimer = setInterval(flush, 1000);
  if (flushTimer && flushTimer.unref) flushTimer.unref();
  const touch = (p) => dirty.add(p.username);

const hashPw = (pw, salt) => env.hashPw(pw, salt);
function newProfile(username, password, name, gender) {
  const salt = env.randomHex(16);
  return {
    username, passSalt: salt, passHash: hashPw(password, salt),
    token: env.randomHex(16), pid: env.randomHex(5),
    name, gender,
    money: CFG.startMoney, exp: 0, level: Number(env.startLevel) || 1,
    owned: { [`suit_start_${gender}`]: 1, [`shoes_start_${gender}`]: 1 }, // 初始服裝
    worn: { suit: `suit_start_${gender}`, shoes: `shoes_start_${gender}` },
    houseLv: 1, house: { wall: null, carpet: null, placed: [] },
    shop: false, warehouseLv: 0,
    likes: 0, likedBy: [], seen: [], lastSeen: Date.now(),
    stats: { played: 0, wins: 0, bestCombo: 0 },
  };
}
const matCount = (p) => Object.keys(p.owned).reduce((a, id) => a + (ITEMS[id] && ITEMS[id].kind === 'mat' ? p.owned[id] : 0), 0);
const capacity = (p) => CFG.warehouse.base + CFG.warehouse.upgradeCap * p.warehouseLv;
const isNovice = (p) => p.level <= CFG.noviceLevel;
const publicProfile = (p) => {
  const { passSalt, passHash, token, likedBy, seen, ...rest } = p;
  return { ...rest, expNeed: expNeed(p.level), capacity: capacity(p), matCount: matCount(p), novice: isNovice(p), styleBonus: styleBonusOf(p), cols: gridOf(p).cols, rows: gridOf(p).rows };
};

function addExp(p, amount) {
  p.exp += amount;
  let ups = 0;
  while (p.exp >= expNeed(p.level)) { p.exp -= expNeed(p.level); p.level++; ups++; }
  return ups;
}

// 房屋風格加成
function styleBonusOf(p) {
  const ids = [p.house.wall, p.house.carpet, ...p.house.placed.map((x) => x.id), ...Object.values(p.worn)].filter(Boolean);
  if (ids.length < CFG.styleBonus.minItems) return 0;
  const c = {}; ids.forEach((id) => { const s = ITEMS[id].style; c[s] = (c[s] || 0) + 1; });
  return Math.max(...Object.values(c)) / ids.length >= CFG.styleBonus.ratio ? CFG.styleBonus.rate : 0;
}

// ───────── 連線 ─────────
const sessions = new Set();
const send = (s, o) => { if (s && s.out && s.alive()) s.out(o); };
const pushProfile = (s) => send(s, { t: 'profile', p: publicProfile(s.p) });
const broadcastOnline = () => { const n = [...sessions].filter((x) => x.p).length; sessions.forEach((s) => send(s, { t: 'online', n })); };

// ───────── 問答對戰 ─────────
let waiting = null;           // 線上配對佇列：{ sess, timer }
const codeRooms = new Map();  // 邀請碼：code -> { sess, timer }
const BOT_NAMES = ['小電', '阿智機器人', '電腦博士', '腦力王', '百科小子'];
const botEntry = () => ({ bot: true, name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], gender: Math.random() < 0.5 ? 'm' : 'f', acc: 0.55 + Math.random() * 0.35 });

function leaveQueue(sess, refund = true) {
  let left = false;
  if (waiting && waiting.sess === sess) { clearTimeout(waiting.timer); waiting = null; left = true; }
  for (const [code, w] of codeRooms) if (w.sess === sess) { clearTimeout(w.timer); codeRooms.delete(code); left = true; }
  if (left && refund) { sess.p.money += CFG.entryFee; touch(sess.p); pushProfile(sess); }
  return left;
}

function joinQuiz(sess, mode, code) {
  if (sess.room || sess.queued()) return send(sess, { t: 'err', msg: '你已在配對或對戰中' });
  if (sess.p.money < CFG.entryFee) return send(sess, { t: 'err', msg: `金錢不足，參加費需要 ${CFG.entryFee} 元` });
  if (mode === 'code') {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(code)) return send(sess, { t: 'err', msg: '邀請碼請用 3~8 個英數字' });
    sess.p.money -= CFG.entryFee; touch(sess.p); pushProfile(sess);
    const w = codeRooms.get(code);
    if (w) { clearTimeout(w.timer); codeRooms.delete(code); return startRoom([{ sess: w.sess }, { sess }]); }
    codeRooms.set(code, { sess, timer: setTimeout(() => { codeRooms.delete(code); sess.p.money += CFG.entryFee; touch(sess.p); pushProfile(sess); send(sess, { t: 'queueCancelled', msg: '沒有人加入邀請碼，已退費' }); }, CFG.codeWaitMs) });
    return send(sess, { t: 'queue', ms: CFG.codeWaitMs, code });
  }
  sess.p.money -= CFG.entryFee; touch(sess.p); pushProfile(sess);
  if (mode === 'bot') return startRoom([{ sess }, botEntry()]);
  if (waiting) { const other = waiting.sess; clearTimeout(waiting.timer); waiting = null; return startRoom([{ sess: other }, { sess }]); }
  waiting = { sess, timer: setTimeout(() => { waiting = null; startRoom([{ sess }, botEntry()]); }, CFG.queueWaitMs) };
  send(sess, { t: 'queue', ms: CFG.queueWaitMs });
}

function startRoom(entries) {
  const humans = entries.filter((e) => e.sess).map((e) => e.sess.p);
  const exclude = new Set(); humans.forEach((p) => p.seen.forEach((id) => exclude.add(id)));
  let qs = buildMatchQuestions(CFG.questions, exclude);
  if (qs.length < CFG.questions) qs = buildMatchQuestions(CFG.questions);
  humans.forEach((p) => { p.seen.push(...qs.map((q) => q.id)); if (p.seen.length > CFG.seenKeep) p.seen.splice(0, p.seen.length - CFG.seenKeep); touch(p); });

  const room = {
    qs, idx: -1, open: false, timer: null, botTimers: [],
    pl: entries.map((e) => {
      const p = e.sess && e.sess.p;
      return {
        sess: e.sess || null, bot: !!e.bot, acc: e.acc,
        name: p ? p.name : e.name, gender: p ? p.gender : e.gender, level: p ? p.level : 99,
        mul: CFG.comboMul,
        styleBonus: p ? styleBonusOf(p) : 0,
        choice: null, correct: 0, streak: 0, chain: 0, bank: 0, bestStreak: 0, exp: 0,
      };
    }),
  };
  // 新手遇到老手（雙方都是真人）時，新手連答倍率才提高為 noviceMul；其餘一律 comboMul
  const [a0, a1] = room.pl;
  if (a0.sess && a1.sess) { const n0 = isNovice(a0.sess.p), n1 = isNovice(a1.sess.p); if (n0 && !n1) a0.mul = CFG.noviceMul; if (n1 && !n0) a1.mul = CFG.noviceMul; }
  room.pl.forEach((pl, i) => {
    if (!pl.sess) return;
    pl.sess.room = room;
    const opp = room.pl[1 - i];
    send(pl.sess, { t: 'matchFound', opp: { name: opp.name, gender: opp.gender, bot: opp.bot, level: opp.bot ? null : opp.level }, total: CFG.questions, mul: pl.mul, styleBonus: pl.styleBonus });
  });
  room.timer = setTimeout(() => nextQuestion(room), 2500);
}

const alive = (room) => room.pl.some((p) => p.sess && p.sess.alive());

function nextQuestion(room) {
  if (!alive(room)) return closeRoom(room);
  room.idx++;
  if (room.idx >= room.qs.length) return finishRoom(room);
  const q = room.qs[room.idx];
  room.pl.forEach((p) => { p.choice = null; if (p.sess) { p.sess.qseen = p.sess.qseen || new Map(); p.sess.qseen.set(q.id, q); } });
  room.open = true;
  room.pl.forEach((p) => send(p.sess, { t: 'q', i: room.idx, total: room.qs.length, id: q.id, cat: q.cat, q: q.q, opts: q.opts, ms: CFG.questionMs }));
  room.pl.forEach((p, i) => {
    if (!p.bot) return;
    room.botTimers.push(setTimeout(() => {
      const wrongs = [0, 1, 2, 3].filter((x) => x !== q.correct);
      answer(room, i, Math.random() < p.acc ? q.correct : wrongs[Math.floor(Math.random() * 3)]);
    }, 2000 + Math.random() * 7000));
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
  const st = qstats.get(q.id) || { n: 0, c: 0 };

  room.pl.forEach((p, i) => {
    const answered = p.choice !== null;
    if (answered) { p.exp += CFG.expPerQuestion; if (!p.bot) { st.n++; if (p.choice === q.correct) st.c++; } }
    if (answered && p.choice === q.correct) {
      p.correct++; p.streak++;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      p.chain = p.streak === 1 ? CFG.baseMoney : (p.chain + CFG.baseMoney) * p.mul;
      const b = CFG.comboBonus[p.streak];
      if (b) { p.bank += b.money; p.exp += b.exp; events[i].push(`${p.streak} 連答獎勵 +${b.money} 元 +${b.exp} 經驗`); }
    } else { p.bank += p.chain; p.chain = 0; p.streak = 0; }
  });
  qstats.set(q.id, st); dirtyQ.add(q.id);

  const view = (p) => ({ choice: p.choice, ok: p.choice === q.correct, streak: p.streak, correct: p.correct, chain: Math.round(p.chain), money: Math.round((p.bank + p.chain) * (1 + p.styleBonus)), exp: p.exp });
  const diff = st.n >= 5 ? { rate: Math.round((st.c / st.n) * 100), n: st.n } : null;
  room.pl.forEach((p, i) => send(p.sess, { t: 'reveal', id: q.id, correct: q.correct, you: view(p), opp: view(room.pl[1 - i]), events: events[i], diff }));
  room.timer = setTimeout(() => nextQuestion(room), CFG.revealMs);
}

function finishRoom(room) {
  room.pl.forEach((p, i) => {
    if (!p.sess) return;
    const opp = room.pl[1 - i], prof = p.sess.p;
    const base = Math.round(p.bank + p.chain), money = Math.round((p.bank + p.chain) * (1 + p.styleBonus));
    prof.money += money;
    const ups = addExp(prof, p.exp);
    prof.stats.played++;
    if (p.correct > opp.correct) prof.stats.wins++;
    prof.stats.bestCombo = Math.max(prof.stats.bestCombo, p.bestStreak);
    touch(prof);
    send(p.sess, {
      t: 'end', result: p.correct > opp.correct ? 'win' : p.correct < opp.correct ? 'lose' : 'draw',
      you: { correct: p.correct, money, base, styleBonus: p.styleBonus, exp: p.exp, bestStreak: p.bestStreak, levelUps: ups, mul: p.mul },
      opp: { name: opp.name, correct: opp.correct }, net: money - CFG.entryFee,
    });
    pushProfile(p.sess);
  });
  closeRoom(room);
}
function closeRoom(room) {
  clearTimeout(room.timer); room.botTimers.forEach(clearTimeout); room.open = false;
  room.pl.forEach((p) => { if (p.sess && p.sess.room === room) p.sess.room = null; });
}

// ───────── 房屋 / 商店 / 倉庫 ─────────
const FURN = new Set(Object.keys(CATS).filter((k) => CATS[k].kind === 'furn'));
const wornCount = (p, id) => Object.values(p.worn).filter((x) => x === id).length;
const placedCount = (p, id) => p.house.placed.filter((x) => x.id === id).length;

function validateHouse(p, h) {
  if (!h || typeof h !== 'object') return '資料錯誤';
  const { cols, rows } = gridOf(p);
  const used = {};
  const use = (id) => { used[id] = (used[id] || 0) + 1; return used[id] <= (p.owned[id] || 0); };
  const out = { wall: null, carpet: null, placed: [] };
  if (h.wall) { const it = ITEMS[h.wall]; if (!it || it.cat !== 'wall' || !use(h.wall)) return '牆壁不合法'; out.wall = h.wall; }
  if (h.carpet) { const it = ITEMS[h.carpet]; if (!it || it.cat !== 'carpet' || !use(h.carpet)) return '地毯不合法'; out.carpet = h.carpet; }
  if (!Array.isArray(h.placed) || h.placed.length > 80) return '擺放資料錯誤';
  for (const pl of h.placed) {
    const it = pl && ITEMS[pl.id];
    if (!it || !FURN.has(it.cat)) return '家具不合法';
    if (!Number.isFinite(pl.x) || !Number.isFinite(pl.z) || !Number.isInteger(pl.rot) || pl.rot < 0 || pl.rot > 3) return '位置資料錯誤';
    const [w, d] = pl.rot % 2 ? [it.fp[1], it.fp[0]] : it.fp;
    const x = Math.round(pl.x * 100) / 100, z = Math.round(pl.z * 100) / 100;
    if (Math.abs(x) > cols / 2 - w / 2 + 1e-6 || Math.abs(z) > rows / 2 - d / 2 + 1e-6) return '家具超出房間範圍';
    for (const o of out.placed) { // 同一層（地面 / 床墊）的家具不可重疊
      const oi = ITEMS[o.id];
      if (oi.layer !== it.layer) continue;
      const [ow, od] = o.rot % 2 ? [oi.fp[1], oi.fp[0]] : oi.fp;
      if (Math.abs(x - o.x) < (w + ow) / 2 - 1e-6 && Math.abs(z - o.z) < (d + od) / 2 - 1e-6) return '家具不能重疊';
    }
    if (!use(pl.id)) return '你沒有足夠的家具';
    out.placed.push({ id: pl.id, x, z, rot: pl.rot });
  }
  p.house = out;
  return null;
}

const visitView = (p, viewer) => ({ pid: p.pid, name: p.name, gender: p.gender, level: p.level, houseLv: p.houseLv, cols: gridOf(p).cols, rows: gridOf(p).rows, house: p.house, worn: p.worn, likes: p.likes, liked: p.likedBy.includes(viewer.username) });

function boardData(viewer) {
  const all = [...players.values()];
  const row = (p) => ({ pid: p.pid, name: p.name, gender: p.gender, level: p.level, wins: p.stats.wins, bestCombo: p.stats.bestCombo, likes: p.likes, houseLv: p.houseLv, self: p === viewer, liked: p.likedBy.includes(viewer.username) });
  const top = (f) => all.slice().sort((a, b) => f(b) - f(a)).slice(0, 10).filter((p) => f(p) > 0).map(row);
  return { wins: top((p) => p.stats.wins), combo: top((p) => p.stats.bestCombo), likes: top((p) => p.likes), level: top((p) => p.level * 1e6 + p.exp), active: all.slice().sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 10).map(row) };
}

function handle(sess, m) {
  const p = sess.p;
  const err = (msg) => send(sess, { t: 'err', msg });
  const ok = () => { touch(p); pushProfile(sess); };

  switch (m.t) {
    case 'quiz': return joinQuiz(sess, m.mode, m.code);
    case 'cancelQueue': if (leaveQueue(sess)) send(sess, { t: 'queueCancelled' }); return;
    case 'answer': if (sess.room) { const i = sess.room.pl.findIndex((x) => x.sess === sess); if (i >= 0) answer(sess.room, i, m.choice); } return;
    case 'report': {
      const q = sess.qseen && sess.qseen.get(m.qid);
      if (!q) return err('找不到這一題');
      env.storage.report({ qid: m.qid, q: q.q, reason: String(m.reason || '').slice(0, 200), by: p.username, ts: Date.now() });
      return send(sess, { t: 'toast', msg: '已回報這題，謝謝！' });
    }
    case 'buy': {
      if (!p.shop) return err('請先建造商店');
      const it = ITEMS[m.id];
      if (!it || it.starter) return err('沒有這個商品');
      if ((p.owned[it.id] || 0) >= it.limit) return err(`「${it.name}」最多只能持有 ${it.limit} 件（已達上限）`);
      if (p.money < it.price) return err('金錢不足');
      if (it.kind === 'mat' && matCount(p) >= capacity(p)) return err('倉庫已滿，請先升級倉庫或賣出建材');
      p.money -= it.price; p.owned[it.id] = (p.owned[it.id] || 0) + 1;
      return ok();
    }
    case 'sell': {
      if (!p.shop) return err('請先建造商店');
      const it = ITEMS[m.id];
      if (it && it.starter) return err('初始服裝不能賣出');
      const free = it ? (p.owned[it.id] || 0) - placedCount(p, it.id) - wornCount(p, it.id) - (p.house.wall === it.id ? 1 : 0) - (p.house.carpet === it.id ? 1 : 0) : 0;
      if (free <= 0) return err('此物品使用中或不存在，請先取下');
      p.owned[it.id]--; if (!p.owned[it.id]) delete p.owned[it.id];
      p.money += Math.floor(it.price * CFG.sellRate);
      return ok();
    }
    case 'buildShop': {
      if (p.shop) return err('已建造');
      if (p.money < CFG.shopBuild) return err('金錢不足');
      p.money -= CFG.shopBuild; p.shop = true; return ok();
    }
    case 'upgradeWarehouse': {
      const cost = CFG.warehouse.upgradeBase * (p.warehouseLv + 1);
      if (p.money < cost) return err(`升級需要 ${cost} 元`);
      p.money -= cost; p.warehouseLv++; return ok();
    }
    case 'expand': {
      const next = CFG.houseLevels[p.houseLv];
      if (!next) return err('房屋已是最高等級');
      if (p.money < next.money) return err('金錢不足');
      for (const [id, n] of Object.entries(next.mats)) if ((p.owned[id] || 0) < n) return err(`建材不足：${ITEMS[id].name} 需要 ${n}`);
      p.money -= next.money;
      for (const [id, n] of Object.entries(next.mats)) { p.owned[id] -= n; if (!p.owned[id]) delete p.owned[id]; }
      p.houseLv++; return ok();
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
    case 'rename': {
      const name = String(m.name || '').trim().slice(0, 12);
      if (!name) return err('請輸入名字');
      if (name === p.name) return err('名字沒有變');
      if (p.money < CFG.renameCost) return err(`改名需要 ${CFG.renameCost.toLocaleString()} 元`);
      p.money -= CFG.renameCost; p.name = name; send(sess, { t: 'toast', msg: `已改名為「${name}」` }); return ok();
    }
    case 'board': return send(sess, { t: 'board', ...boardData(p) });
    case 'visit': {
      const t = byPid.get(String(m.pid));
      if (!t) return err('找不到這位玩家');
      return send(sess, { t: 'visit', v: visitView(t, p) });
    }
    case 'like': {
      const t = byPid.get(String(m.pid));
      if (!t || t === p) return err('無法按讚');
      if (t.likedBy.includes(p.username)) return err('你已經按過讚了');
      t.likedBy.push(p.username); t.likes++; touch(t);
      const day = new Date().toISOString().slice(0, 10);
      if (!p.likeDay || p.likeDay.d !== day) p.likeDay = { d: day, n: 0 };
      let reward = 0;
      if (p.likeDay.n < CFG.likeDailyCap) { p.likeDay.n++; reward = CFG.likeReward; p.money += reward; }
      touch(p); pushProfile(sess);
      send(sess, { t: 'likeOk', pid: t.pid, likes: t.likes, reward, left: CFG.likeDailyCap - p.likeDay.n });
      if (m.visit) send(sess, { t: 'visit', v: visitView(t, p) });
      sessions.forEach((s) => { if (s.p === t) { pushProfile(s); send(s, { t: 'toast', msg: `❤️ ${p.name} 幫你的房子按讚！` }); } });
      return;
    }
  }
}

// ───────── 帳號 ─────────
function auth(sess, m) {
  const err = (msg) => send(sess, { t: sess.p ? 'err' : 'authErr', msg });
  let p;
  if (m.t === 'hello') {
    p = byToken.get(String(m.token));
    if (!p) return send(sess, { t: 'needLogin' });
  } else if (m.t === 'login') {
    p = players.get(String(m.username || '').toLowerCase());
    if (!p || !env.safeEqual(hashPw(String(m.password || ''), p.passSalt), p.passHash)) return err('帳號或密碼錯誤');
  } else { // register
    const username = String(m.username || '').trim().toLowerCase();
    const name = String(m.name || '').trim().slice(0, 12);
    if (!/^[a-z0-9_]{3,16}$/.test(username)) return err('帳號需為 3~16 個英數字或底線');
    if (String(m.password || '').length < 6) return err('密碼至少 6 碼');
    if (!name) return err('請輸入角色名字');
    if (m.gender !== 'm' && m.gender !== 'f') return err('請選擇性別');
    if (players.has(username)) return err('這個帳號已被使用');
    p = newProfile(username, String(m.password), name, m.gender);
    players.set(username, p); byToken.set(p.token, p); byPid.set(p.pid, p); touch(p);
  }
  sessions.forEach((o) => { if (o !== sess && o.p === p) { leaveQueue(o, true); o.p = null; send(o, { t: 'kicked' }); } });
  sess.p = p; p.lastSeen = Date.now(); touch(p);
  send(sess, {
    t: 'welcome', token: p.token, p: publicProfile(p),
    catalog: { items: ITEMS, cats: CATS, styles: STYLES },
    cfg: { offline: !!env.offline, entryFee: CFG.entryFee, houseLevels: CFG.houseLevels, warehouse: CFG.warehouse, shopBuild: CFG.shopBuild, sellRate: CFG.sellRate, renameCost: CFG.renameCost, noviceLevel: CFG.noviceLevel, likeReward: CFG.likeReward, noviceMul: CFG.noviceMul, comboMul: CFG.comboMul, styleBonus: CFG.styleBonus },
  });
  broadcastOnline();
}

  // ───────── 對外介面 ─────────
  // transport: { out(obj): 傳訊息給這位玩家, alive(): 連線是否還在 }
  function connect(transport) {
    const sess = { out: transport.out, alive: transport.alive, p: null, room: null, qseen: null, queued() { return (waiting && waiting.sess === sess) || [...codeRooms.values()].some((w) => w.sess === sess); } };
    sessions.add(sess);
    let msgs = 0;
    const rateTimer = setInterval(() => { msgs = 0; }, 1000);
    return {
      message(m) {
        if (++msgs > 30) return;
        if (!m || typeof m.t !== 'string') return;
        if (m.t === 'hello' || m.t === 'login' || m.t === 'register') return auth(sess, m);
        if (sess.p) { sess.p.lastSeen = Date.now(); handle(sess, m); }
      },
      close() {
        clearInterval(rateTimer);
        sessions.delete(sess);
        if (sess.p) { leaveQueue(sess, true); touch(sess.p); }
        broadcastOnline();
      },
    };
  }
  return { connect, flush, CFG, bankSize, catalog: { items: ITEMS, cats: CATS, styles: STYLES } };
}

module.exports = { createGame };
