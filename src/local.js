// 單機版：在瀏覽器裡直接跑遊戲核心（core.js），用 LocalSocket 假裝是 WebSocket，存檔放 localStorage
import { createGame } from '../core.js';

// 同步 SHA-256（單機版只需要避免明文存密碼，不需要高強度雜湊）
function sha256(str) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const bytes = Array.from(new TextEncoder().encode(str)), l = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 0xff);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}

const KEY = 'hq_single_v1';
let mem = null, need = false, persistOk = true;
function load() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) { persistOk = false; }
  return (mem = mem || { accounts: {}, qstats: {}, reports: [] });
}
const storage = {
  accounts: () => Object.entries(load().accounts).map(([username, profile]) => ({ username, profile })),
  qstats: () => Object.entries(load().qstats).map(([id, v]) => ({ id, n: v.n, c: v.c })),
  saveAccount(u, json) { load().accounts[u] = json; need = true; },
  saveQ(id, n, c) { load().qstats[id] = { n, c }; need = true; },
  report(r) { load().reports.push(r); need = true; },
  flush() { if (!need) return; need = false; try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { persistOk = false; } },
};

const game = createGame({
  storage, offline: true, startMoney: 1000, startLevel: 1,
  hashPw: (pw, salt) => sha256(salt + ':' + pw),
  randomHex: (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join(''); },
  safeEqual: (a, b) => a === b,
});
window.addEventListener('pagehide', () => game.flush());
window.addEventListener('beforeunload', () => game.flush());

class LocalSocket {
  constructor() {
    this.readyState = 0;
    this.conn = game.connect({ out: (o) => setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(o) }), 0), alive: () => this.readyState === 1 });
    setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 0);
  }
  send(str) { const m = JSON.parse(str); setTimeout(() => this.conn.message(m), 0); }
  close() { this.readyState = 3; this.conn.close(); }
}
window.__LocalSocket = LocalSocket;
window.__persistOk = () => persistOk;
