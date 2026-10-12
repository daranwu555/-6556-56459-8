// 小遊戲核心（瀏覽器與伺服器共用）：踩地雷、記憶翻牌、猜數字(1A2B)。
// 玩家在瀏覽器玩，並把操作紀錄送給伺服器；伺服器用同一份程式「重播」操作來驗證輸贏，避免作弊。
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── 設定與獎勵（想調整數值改這裡）──
const MINE_LEVELS = {
  easy: { w: 9, h: 9, mines: 10, fee: 30, reward: 90, minMs: 8000, name: '初級 9×9（10 顆雷）' },
  mid: { w: 16, h: 16, mines: 40, fee: 60, reward: 200, minMs: 25000, name: '中級 16×16（40 顆雷）' },
  hard: { w: 24, h: 16, mines: 80, fee: 100, reward: 400, minMs: 50000, name: '高級 24×16（80 顆雷）' },
};
const MEMORY = { pairs: 8, fee: 30, reward: 80, maxMoves: 24, minMs: 10000, name: '記憶翻牌（8 對，24 步內完成）' };
const NUMGAME = { digits: 4, maxGuesses: 8, fee: 30, reward: 100, minMs: 4000, name: '猜數字 1A2B（8 次內猜中）' };
// 切水果三個等級：越高級，同時飛出的水果越多（經驗值每級 ×1.2）
const FRUIT_LEVELS = {
  easy: { name: '初級', dens: 1, extra: 0, bomb: 0, exp: 50, botBase: 150 },
  mid: { name: '中級', dens: 1.4, extra: 0.3, bomb: 0.03, exp: 60, botBase: 270 },
  hard: { name: '高級', dens: 1.9, extra: 0.5, bomb: 0.06, exp: 72, botBase: 380 },
};
const FRUIT = { fee: 30, reward: 300, exp: 50, seconds: 60, tickMs: 20, minMs: 50000, levels: FRUIT_LEVELS, name: '切水果（限時 60 秒，積分贏過對手才算贏；切到炸彈就輸；初／中／高級）' };
const ZOMBIE = { fee: 30, reward: 150, exp: 30, seconds: 60, tickMs: 50, lives: 3, hitFrom: 0.5, needKills: 75, minMs: 50000, name: '三格打殭屍（殭屍走過一半才能點；亂點扣 1 條命；撐過 60 秒、擊倒 75 隻，3 條命）' };
const DAILY_CAP = 5; // 每種小遊戲每天最多領 5 次獎勵

// ── 踩地雷 ──
class Mine {
  constructor(seed, level) {
    const L = MINE_LEVELS[level]; if (!L) throw new Error('bad level');
    this.seed = seed; this.w = L.w; this.h = L.h; this.n = L.mines; this.mine = null;
    this.open = new Uint8Array(this.w * this.h); this.flag = new Uint8Array(this.w * this.h);
    this.over = false; this.win = false; this.opened = 0;
  }
  nb(i) { const x = i % this.w, y = (i / this.w) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h) r.push(ny * this.w + nx); } return r; }
  place(first) { // 第一次點擊與周圍八格一定安全
    const safe = new Set([first, ...this.nb(first)]), cand = []; for (let i = 0; i < this.w * this.h; i++) if (!safe.has(i)) cand.push(i);
    this.mine = new Uint8Array(this.w * this.h); for (const i of shuffle(cand, rng(this.seed)).slice(0, this.n)) this.mine[i] = 1;
  }
  count(i) { return this.nb(i).reduce((a, j) => a + this.mine[j], 0); }
  reveal(i) {
    if (this.over || this.flag[i] || this.open[i]) return;
    if (!this.mine) this.place(i);
    if (this.mine[i]) { this.over = true; this.win = false; this.hit = i; return; }
    const st = [i];
    while (st.length) { const c = st.pop(); if (this.open[c] || this.flag[c]) continue; this.open[c] = 1; this.opened++; if (this.count(c) === 0) for (const j of this.nb(c)) if (!this.open[j]) st.push(j); }
    if (this.opened === this.w * this.h - this.n) { this.over = true; this.win = true; }
  }
  toggleFlag(i) { if (!this.over && !this.open[i]) this.flag[i] ^= 1; }
  flagsLeft() { return this.n - this.flag.reduce((a, b) => a + b, 0); }
}
function verifyMine(seed, level, moves) {
  if (!Array.isArray(moves) || moves.length > 4000 || !MINE_LEVELS[level]) return { win: false };
  const g = new Mine(seed, level), size = g.w * g.h;
  for (const m of moves) {
    if (!Array.isArray(m) || !Number.isInteger(m[1]) || m[1] < 0 || m[1] >= size) return { win: false };
    m[0] === 'r' ? g.reveal(m[1]) : g.toggleFlag(m[1]);
    if (g.over) break;
  }
  return { win: g.win };
}

// ── 記憶翻牌 ──
function memoryDeck(seed) { const a = []; for (let i = 0; i < MEMORY.pairs; i++) a.push(i, i); return shuffle(a, rng(seed)); }
class Memory {
  constructor(seed) { this.deck = memoryDeck(seed); this.matched = new Uint8Array(this.deck.length); this.picks = []; this.moves = 0; this.win = false; }
  flip(i) { // 回傳 null（無效）、'wait'（等第二張）、'match' 或 'miss'
    if (this.matched[i] || this.picks.includes(i) || this.picks.length >= 2) return null;
    this.picks.push(i);
    if (this.picks.length < 2) return 'wait';
    const [a, b] = this.picks; this.moves++;
    const ok = this.deck[a] === this.deck[b]; if (ok) { this.matched[a] = this.matched[b] = 1; if (this.matched.every((x) => x)) this.win = true; }
    return ok ? 'match' : 'miss';
  }
  clearPicks() { this.picks = []; }
}
function verifyMemory(seed, flips) {
  if (!Array.isArray(flips) || flips.length > 400) return { win: false };
  const g = new Memory(seed);
  for (const i of flips) { if (!Number.isInteger(i) || i < 0 || i >= g.deck.length) return { win: false }; const r = g.flip(i); if (r === 'miss') g.clearPicks(); if (r === 'match') g.clearPicks(); if (g.win) break; }
  return { win: g.win && g.moves <= MEMORY.maxMoves, moves: g.moves };
}

// ── 猜數字 1A2B ──
function numSecret(seed) { return shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], rng(seed)).slice(0, NUMGAME.digits).join(''); }
function judge(secret, guess) { let a = 0, b = 0; for (let i = 0; i < secret.length; i++) { if (guess[i] === secret[i]) a++; else if (secret.includes(guess[i])) b++; } return [a, b]; }
const validGuess = (g) => typeof g === 'string' && /^\d{4}$/.test(g) && new Set(g).size === 4;
function verifyNum(seed, guesses) {
  if (!Array.isArray(guesses) || !guesses.length || guesses.length > NUMGAME.maxGuesses) return { win: false };
  const s = numSecret(seed);
  for (let i = 0; i < guesses.length; i++) { if (!validGuess(guesses[i])) return { win: false }; if (guesses[i] === s) return { win: i === guesses.length - 1, tries: i + 1 }; }
  return { win: false };
}

// ── 切水果（固定時間步長的確定性模擬：玩家的滑動紀錄會被伺服器重播驗證）──
// 場地：寬 1000、高 1400（y 向下）。水果從底部拋出，滑動線段碰到就切開；炸彈碰到就爆炸輸掉。
const FRUIT_TYPES = [
  { k: 'apple', e: '🍎', pts: 1, w: 34, vy: 1.9 }, { k: 'orange', e: '🍊', pts: 2, w: 24, vy: 1.95 }, { k: 'banana', e: '🍌', pts: 3, w: 16, vy: 2.0 },
  { k: 'grape', e: '🍇', pts: 4, w: 11, vy: 2.05 }, { k: 'melon', e: '🍉', pts: 5, w: 8, vy: 2.1 }, { k: 'pine', e: '🍍', pts: 6, w: 5, vy: 2.2 }, { k: 'mango', e: '🥭', pts: 10, w: 2, vy: 2.5 },
];
const FW = 1000, FH = 1400, FR = 62, FG = 2.4 * 1000; // 半徑與重力（單位：場地座標）
class FruitSim {
  constructor(seed, level = 'easy') { this.L = FRUIT_LEVELS[level] || FRUIT_LEVELS.easy; this.rnd = rng(seed); this.bot = this.L.botBase + Math.floor(rng(seed ^ 0x9e3779b9)() * 60); this.tick = 0; this.objs = []; this.score = 0; this.exploded = false; this.sliced = 0; this.next = 20; this.events = []; }
  get done() { return this.exploded || this.tick >= FRUIT.seconds * 1000 / FRUIT.tickMs; }
  spawn() {
    const t = this.tick * FRUIT.tickMs / 1000, bombP = 0.12 + this.L.bomb + 0.18 * (t / FRUIT.seconds), n = 1 + (this.rnd() < 0.5 + 0.3 * (t / FRUIT.seconds) ? 1 : 0) + (this.rnd() < 0.25 + this.L.extra ? 1 : 0) + (this.rnd() < this.L.extra ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const bomb = this.rnd() < bombP; let type = null;
      if (!bomb) { let r = this.rnd() * FRUIT_TYPES.reduce((a, f) => a + f.w, 0); for (const f of FRUIT_TYPES) { if ((r -= f.w) < 0) { type = f; break; } } type = type || FRUIT_TYPES[0]; }
      const x = 140 + this.rnd() * 720, vx = (this.rnd() - 0.5) * 560, vy = -(bomb ? 1.95 : type.vy) * 1000 * (0.94 + this.rnd() * 0.12);
      this.objs.push({ id: this.nid = (this.nid || 0) + 1, x, y: FH + 70, vx, vy, bomb, type });
    }
    const gap = (0.95 - 0.4 * (t / FRUIT.seconds)) / this.L.dens; this.next = this.tick + Math.max(10, Math.round((gap * (0.8 + this.rnd() * 0.5)) * 1000 / FRUIT.tickMs));
  }
  // slices：本 tick 的滑動線段 [x1,y1,x2,y2]
  step(slices = []) {
    if (this.done) return;
    const dt = FRUIT.tickMs / 1000;
    for (const sg of slices) {
      const hit = [];
      for (const o of this.objs) {
        if (o.dead) continue;
        const dx = sg[2] - sg[0], dy = sg[3] - sg[1], l2 = dx * dx + dy * dy || 1;
        let u = ((o.x - sg[0]) * dx + (o.y - sg[1]) * dy) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const cx = sg[0] + u * dx - o.x, cy = sg[1] + u * dy - o.y;
        if (cx * cx + cy * cy <= FR * FR) hit.push(o);
      }
      for (const o of hit) { o.dead = true; this.events.push({ id: o.id, x: o.x, y: o.y, bomb: o.bomb, e: o.type && o.type.e, pts: o.type ? o.type.pts : 0 }); if (o.bomb) { this.exploded = true; return; } this.score += o.type.pts; this.sliced++; }
      const fruits = hit.filter((o) => !o.bomb).length; if (fruits >= 3) this.score += fruits * 2; // 一刀連砍 3 個以上有連切加分
    }
    for (const o of this.objs) { if (o.dead) continue; o.x += o.vx * dt; o.vy += FG * dt; o.y += o.vy * dt; if (o.y > FH + 120 && o.vy > 0) o.dead = true; }
    this.objs = this.objs.filter((o) => !o.dead);
    if (this.tick >= this.next) this.spawn();
    this.tick++;
  }
  get win() { return !this.exploded && this.tick >= FRUIT.seconds * 1000 / FRUIT.tickMs && this.score > this.bot; }
}
function verifyFruit(seed, log, level = 'easy') {
  if (!Array.isArray(log) || log.length > 6000) return { win: false };
  const g = new FruitSim(seed, level), by = new Map();
  for (const e of log) { if (!Array.isArray(e) || e.length !== 5 || e.some((v) => !Number.isFinite(v))) return { win: false }; const [t, ...sg] = e; if (!by.has(t)) by.set(t, []); by.get(t).push(sg); }
  const total = FRUIT.seconds * 1000 / FRUIT.tickMs;
  while (!g.done && g.tick < total) g.step(by.get(g.tick) || []);
  return { win: g.win, score: g.score, bot: g.bot, exploded: g.exploded };
}

// ── 三格打殭屍（3 條通道；點通道攻擊最前面的殭屍；殭屍走到底部就扣一條命）──
const ZTYPES = [{ k: 'walker', e: '🧟', hp: 1, sp: 0.2, w: 60 }, { k: 'runner', e: '🏃', hp: 1, sp: 0.34, w: 24 }, { k: 'tank', e: '🧟‍♂️', hp: 3, sp: 0.13, w: 16 }];
class ZombieSim {
  constructor(seed) { this.rnd = rng(seed); this.tick = 0; this.zs = []; this.kills = 0; this.lives = ZOMBIE.lives; this.cool = 0; this.next = 10; this.nid = 0; this.events = []; }
  get done() { return this.lives <= 0 || this.tick >= ZOMBIE.seconds * 1000 / ZOMBIE.tickMs; }
  get win() { return this.lives > 0 && this.tick >= ZOMBIE.seconds * 1000 / ZOMBIE.tickMs && this.kills >= ZOMBIE.needKills; }
  step(taps = []) { // taps：本 tick 點擊的通道（0~2）
    if (this.done) return;
    const dt = ZOMBIE.tickMs / 1000, t = this.tick * ZOMBIE.tickMs / 1000;
    if (this.cool > 0) this.cool--;
    for (const lane of taps) {
      if (this.cool > 0 || lane < 0 || lane > 2) continue; this.cool = 3;
      let tgt = null; for (const z of this.zs) if (z.lane === lane && (!tgt || z.pos > tgt.pos)) tgt = z;
      if (!tgt || tgt.pos < ZOMBIE.hitFrom) { this.lives--; this.events.push({ lane, hit: false, wild: true }); continue; } // 亂點：這條通道沒有走過一半的殭屍 → 扣 1 條命
      this.events.push({ lane, hit: true, id: tgt.id });
      if (--tgt.hp <= 0) { tgt.dead = true; this.kills++; }
    }
    for (const z of this.zs) { if (z.dead) continue; z.pos += z.t.sp * (1 + 0.6 * (t / ZOMBIE.seconds)) * dt; if (z.pos >= 1) { z.dead = true; this.lives--; this.events.push({ breach: z.lane }); } }
    this.zs = this.zs.filter((z) => !z.dead);
    if (this.tick >= this.next) {
      let r = this.rnd() * ZTYPES.reduce((a, f) => a + f.w, 0), ty = ZTYPES[0]; for (const f of ZTYPES) { if ((r -= f.w) < 0) { ty = f; break; } }
      this.zs.push({ id: ++this.nid, lane: Math.floor(this.rnd() * 3), pos: 0, hp: ty.hp, t: ty });
      this.next = this.tick + Math.max(4, Math.round((0.75 - 0.4 * (t / ZOMBIE.seconds)) * (0.7 + this.rnd() * 0.6) * 1000 / ZOMBIE.tickMs));
    }
    this.tick++;
  }
}
function verifyZombie(seed, log) {
  if (!Array.isArray(log) || log.length > 1500) return { win: false };
  const g = new ZombieSim(seed), by = new Map();
  for (const e of log) { if (!Array.isArray(e) || e.length !== 2 || !Number.isInteger(e[0]) || !Number.isInteger(e[1])) return { win: false }; if (!by.has(e[0])) by.set(e[0], []); by.get(e[0]).push(e[1]); }
  while (!g.done) g.step(by.get(g.tick) || []);
  return { win: g.win, kills: g.kills, lives: g.lives };
}

const GAMES = { mine: { levels: MINE_LEVELS }, memory: MEMORY, num: NUMGAME, fruit: FRUIT, zombie: ZOMBIE };
module.exports = { rng, MINE_LEVELS, MEMORY, NUMGAME, FRUIT, FRUIT_LEVELS, ZOMBIE, FRUIT_TYPES, ZTYPES, FW, FH, FR, DAILY_CAP, GAMES, Mine, Memory, FruitSim, ZombieSim, memoryDeck, numSecret, judge, validGuess, verifyMine, verifyMemory, verifyNum, verifyFruit, verifyZombie };
