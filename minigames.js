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

const GAMES = { mine: { levels: MINE_LEVELS }, memory: MEMORY, num: NUMGAME };
module.exports = { rng, MINE_LEVELS, MEMORY, NUMGAME, DAILY_CAP, GAMES, Mine, Memory, memoryDeck, numSecret, judge, validGuess, verifyMine, verifyMemory, verifyNum };
