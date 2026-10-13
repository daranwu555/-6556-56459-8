// 介面特效：背景水墨動態、粒子（金幣／彩紙／火花／煙火）、數字滾動、升級演出、對戰開場、按鈕漣漪
// 全部用 Canvas 2D 與 CSS 動畫完成，不需要額外套件；系統設定「減少動態效果」時自動降級。
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(2, window.devicePixelRatio || 1);
let layer, ctx, parts = [], running = false, bg, bgx, bgParts = [], bgOn = true;

function makeCanvas(id, z) {
  const c = document.createElement('canvas'); c.id = id;
  c.style.cssText = `position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:${z}`;
  document.body.appendChild(c); return c;
}
function fit(c) { const w = innerWidth, h = innerHeight; if (c.width !== w * DPR || c.height !== h * DPR) { c.width = w * DPR; c.height = h * DPR; } }

// ───── 粒子層 ─────
function loop() {
  if (!parts.length) { running = false; ctx.clearRect(0, 0, layer.width, layer.height); return; }
  running = true; fit(layer); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.life -= 1; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    if (p.tx !== undefined) { const k = 1 - p.life / p.max, e = k * k * (3 - 2 * k); p.x = p.sx + (p.tx - p.sx) * e + Math.sin(k * Math.PI) * p.arcX; p.y = p.sy + (p.ty - p.sy) * e - Math.sin(k * Math.PI) * p.arcY; }
    const a = Math.max(0, Math.min(1, p.life / Math.min(18, p.max)));
    ctx.save(); ctx.globalAlpha = a * (p.alpha || 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.kind === 'confetti') { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.4 + Math.abs(Math.sin(p.life / 6)))); }
    else if (p.kind === 'text') { ctx.rotate(-p.rot); ctx.font = `700 ${p.s}px "LXGW WenKai TC","Noto Serif TC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a0d04'; ctx.strokeText(p.t, 0, 0); ctx.fillStyle = p.c; ctx.fillText(p.t, 0, 0); }
    else if (p.kind === 'emoji') { ctx.font = `${p.s}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.t, 0, 0); }
    else if (p.kind === 'ring') { ctx.strokeStyle = p.c; ctx.lineWidth = 3 * a; ctx.beginPath(); ctx.arc(0, 0, p.s * (1 - p.life / p.max) + 4, 0, 7); ctx.stroke(); }
    else { const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); }
    ctx.restore();
    if (p.life <= 0 && p.done) { p.done(); p.done = null; }
  }
  parts = parts.filter((p) => p.life > 0);
  requestAnimationFrame(loop);
}
function add(p) { parts.push({ vx: 0, vy: 0, g: 0, drag: 1, rot: 0, vr: 0, s: 6, c: '#ffd76a', kind: 'spark', life: 40, ...p, max: p.life || 40 }); if (parts.length > 900) parts.splice(0, parts.length - 900); if (!running) requestAnimationFrame(loop); }
const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const GOLD = ['#ffe9a8', '#f0c24a', '#d9ae4e', '#fff6d8'];
const FEST = ['#f0c24a', '#c0392b', '#e8d9b0', '#4f9a86', '#ff8a5c', '#fff3c4'];

export function burst(x, y, { n = 26, colors = GOLD, speed = 6, kind = 'spark', size = 7, g = 0.12, life = 44 } = {}) {
  if (RM) n = Math.min(n, 8);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.35 + Math.random()); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25, g, drag: 0.96, c: colors[i % colors.length], s: size * (0.5 + Math.random()), kind, vr: (Math.random() - 0.5) * 0.4, life: life * (0.6 + Math.random() * 0.6) }); }
  add({ x, y, kind: 'ring', c: colors[0], s: 60 + speed * 6, life: 22 });
}
export const burstAt = (el, o) => { if (el) { const [x, y] = center(el); burst(x, y, o); } };
export function confetti(n = 160) {
  if (RM) n = 30;
  for (let i = 0; i < n; i++) { const fromLeft = i % 2 === 0; add({ x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * (0.55 + Math.random() * 0.3), vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 9), vy: -(9 + Math.random() * 9), g: 0.28, drag: 0.985, kind: 'confetti', c: FEST[i % FEST.length], s: 10 + Math.random() * 8, vr: (Math.random() - 0.5) * 0.5, life: 150 + Math.random() * 60 }); }
}
export function fireworks(times = 5) {
  for (let k = 0; k < times; k++) setTimeout(() => {
    const x = innerWidth * (0.15 + Math.random() * 0.7), y = innerHeight * (0.15 + Math.random() * 0.3), col = [FEST[k % FEST.length], '#fff3c4'];
    add({ x, y: innerHeight, vy: -(innerHeight - y) / 34, vx: 0, life: 34, s: 5, c: '#ffe9a8', done: () => burst(x, y, { n: 60, colors: col, speed: 7, g: 0.07, life: 70, size: 6 }) });
  }, k * 380);
}
export function floatText(x, y, t, c = '#ffe08a', s = 22) { add({ x, y, vy: -1.3, drag: 0.99, kind: 'text', t, c, s, life: 60 }); }
export const floatAt = (el, t, c, s) => { if (el) { const [x, y] = center(el); floatText(x, y - 10, t, c, s); } };
// 金幣飛向目標（例如頂部的金錢）
export function coinsTo(from, toEl, n = 10, emoji = '🪙') {
  if (!toEl) return; const [tx, ty] = center(toEl); const [sx, sy] = Array.isArray(from) ? from : center(from);
  n = RM ? 2 : n;
  for (let i = 0; i < n; i++) setTimeout(() => add({ x: sx, y: sy, sx: sx + (Math.random() - 0.5) * 60, sy: sy + (Math.random() - 0.5) * 40, tx, ty, arcX: (Math.random() - 0.5) * 160, arcY: 80 + Math.random() * 120, kind: 'emoji', t: emoji, s: 22, life: 46, done: i === n - 1 ? () => pop(toEl) : null }), i * 40);
}
export function pop(el, cls = 'fx-pop') { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 700); }
export const shake = (el) => pop(el, 'fx-shake');
// 數字滾動
export function countUp(el, from, to, ms = 700) {
  if (!el) return; if (RM || from === to) { el.textContent = to.toLocaleString(); return; }
  const t0 = performance.now(); cancelAnimationFrame(el.__cu);
  const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e).toLocaleString(); if (k < 1) el.__cu = requestAnimationFrame(step); };
  el.__cu = requestAnimationFrame(step);
}
// 全螢幕演出（升級、對戰開場、勝利）
export function stage(html, ms = 2200, cls = '') {
  const d = document.createElement('div'); d.className = 'fx-stage ' + cls; d.innerHTML = html; document.body.appendChild(d);
  d.onclick = () => d.remove(); setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, ms); return d;
}
export function levelUp(lv) {
  stage(`<div class="fx-rays"></div><div class="fx-lv"><div class="fx-lv-t">境界突破</div><div class="fx-lv-n">Lv.${lv}</div><div class="fx-lv-s">修為大增・繼續精進</div></div>`, 2600, 'lv');
  fireworks(6); setTimeout(() => confetti(120), 300);
}
export function versus(me, opp) {
  stage(`<div class="fx-vs"><div class="fx-vs-l">${me}</div><div class="fx-vs-m">對決</div><div class="fx-vs-r">${opp}</div></div>`, 1700, 'vs');
}

// ───── 背景：水墨遠山＋飄落花瓣／金色光點（很輕量；分頁看不見時停止）─────
function drawBg(t) {
  if (!bgOn) return; fit(bg); const w = innerWidth, h = innerHeight, x = bgx; x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, w, h);
  const sy = scrollY * 0.15;
  const hill = (base, amp, col, ph, sp) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let px = 0; px <= w + 20; px += 20) { const q = px / w * 6.283; x.lineTo(px, base + sy * sp - amp * (0.55 + 0.45 * Math.sin(q * 1.3 + ph + t * 0.00003 * sp)) - amp * 0.3 * Math.sin(q * 3.1 + ph * 2)); } x.lineTo(w, h); x.fill(); };
  hill(h * 0.78, h * 0.22, 'rgba(120,104,80,.10)', 0.4, 0.4); hill(h * 0.86, h * 0.2, 'rgba(90,76,58,.14)', 2.1, 0.8); hill(h * 0.95, h * 0.16, 'rgba(40,32,24,.35)', 4.0, 1.2);
  if (!RM) for (const p of bgParts) {
    p.x += p.vx + Math.sin(t / 1400 + p.ph) * 0.25; p.y += p.vy; p.r += p.vr;
    if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; } if (p.x > w + 20) p.x = -20; if (p.x < -20) p.x = w + 20;
    x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = p.a;
    if (p.k) { x.fillStyle = '#e8a0a0'; x.beginPath(); x.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 7); x.fill(); x.fillStyle = '#f6c9c9'; x.beginPath(); x.ellipse(-p.s * 0.2, 0, p.s * 0.5, p.s * 0.25, 0, 0, 7); x.fill(); }
    else { const g = x.createRadialGradient(0, 0, 0, 0, 0, p.s * 2); g.addColorStop(0, 'rgba(255,220,140,.9)'); g.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, p.s * 2, 0, 7); x.fill(); }
    x.restore();
  }
  requestAnimationFrame(drawBg);
}

// 按鈕漣漪
function ripple(e) {
  const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), s = document.createElement('span'); s.className = 'fx-ripple';
  const d = Math.max(r.width, r.height) * 2; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 600);
}

export function init() {
  layer = makeCanvas('fxLayer', 80); ctx = layer.getContext('2d');
  bg = makeCanvas('bgLayer', 0); bg.style.zIndex = '-1'; bgx = bg.getContext('2d');
  const n = RM ? 0 : innerWidth < 600 ? 14 : 26;
  for (let i = 0; i < n; i++) bgParts.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: 0.15 + Math.random() * 0.3, vy: 0.25 + Math.random() * 0.45, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02, s: 3 + Math.random() * 4, a: 0.25 + Math.random() * 0.4, k: i % 3 !== 0, ph: Math.random() * 6 });
  document.addEventListener('visibilitychange', () => { const on = !document.hidden; if (on && !bgOn) { bgOn = true; requestAnimationFrame(drawBg); } else bgOn = on; });
  requestAnimationFrame(drawBg);
  document.addEventListener('pointerdown', ripple, true);
}
export const reducedMotion = RM;
