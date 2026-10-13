// 小遊戲畫面：踩地雷、記憶翻牌、猜數字（規則與驗證在 minigames.js，伺服器會重播操作來驗證輸贏）
import MG from '/js/minigames.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const COLORS = ['', '#4da6ff', '#4cb86a', '#ff6b6b', '#8a6bff', '#ff9f43', '#2ec4b6', '#f2e9c8', '#aaaaaa'];

export function playMine(host, { seed, level }, onEnd) {
  const g = new MG.Mine(seed, level), L = MG.MINE_LEVELS[level], log = []; let t0 = null, timer = null, ended = false;
  host.innerHTML = '';
  const bar = el('div', 'row'), left = el('b', '', ''), time = el('span', 'mut', '⏱ 0 秒'), give = el('button', '', '放棄');
  bar.append(left, time, give);
  const board = el('div', 'mine'); board.style.gridTemplateColumns = `repeat(${g.w}, 1fr)`; board.style.maxWidth = `${g.w * 34}px`;
  const cells = []; for (let i = 0; i < g.w * g.h; i++) { const c = el('button', 'mc'); c.dataset.i = i; board.appendChild(c); cells.push(c); }
  host.append(bar, board, el('div', 'mut', '左鍵翻開、右鍵直接插旗／取消旗子（手機：長按插旗）。第一次點擊與周圍一定安全。'));
  const render = () => {
    left.textContent = `💣 剩 ${g.flagsLeft()}`;
    cells.forEach((c, i) => {
      c.className = 'mc'; c.textContent = ''; c.style.color = '';
      if (g.open[i]) { c.classList.add('o'); const n = g.count(i); if (n) { c.textContent = n; c.style.color = COLORS[n]; } }
      else if (g.flag[i]) c.textContent = '🚩';
      else if (g.over && g.mine && g.mine[i]) { c.classList.add('o'); c.textContent = i === g.hit ? '💥' : '💣'; }
    });
  };
  const finish = (win) => { if (ended) return; ended = true; clearInterval(timer); render(); board.classList.add('done', win ? 'won' : 'lost'); setTimeout(() => onEnd(log, win), 900); };
  const act = (i, flag) => {
    if (ended) return; if (!t0) { t0 = Date.now(); timer = setInterval(() => { time.textContent = `⏱ ${Math.floor((Date.now() - t0) / 1000)} 秒`; }, 500); }
    if (flag) { g.toggleFlag(i); log.push(['f', i]); } else { g.reveal(i); log.push(['r', i]); }
    render(); if (g.over) finish(g.win);
  };
  let lp = null, lpDone = false; // 手機長按插旗
  board.addEventListener('pointerdown', (e) => { lpDone = false; if (e.pointerType !== 'touch') return; const c = e.target.closest('.mc'); if (c) lp = setTimeout(() => { lpDone = true; act(+c.dataset.i, true); }, 450); });
  const lpCancel = () => clearTimeout(lp); board.addEventListener('pointerup', lpCancel); board.addEventListener('pointermove', lpCancel); board.addEventListener('pointercancel', lpCancel);
  board.addEventListener('click', (e) => { if (lpDone) { lpDone = false; return; } const c = e.target.closest('.mc'); if (c) act(+c.dataset.i, false); });
  board.addEventListener('contextmenu', (e) => { e.preventDefault(); const c = e.target.closest('.mc'); if (c) act(+c.dataset.i, true); });
  give.onclick = () => finish(false);
  render();
  return () => { ended = true; clearInterval(timer); };
}

const SYMS = ['🐉', '🐯', '🏮', '🎋', '🍵', '🪭', '🗡️', '🔔'];
export function playMemory(host, { seed }, onEnd) {
  const g = new MG.Memory(seed), log = []; let lock = false, ended = false;
  host.innerHTML = '';
  const info = el('div', 'row', ''), moves = el('b', '', ''), board = el('div', 'mem');
  info.append(moves, el('span', 'mut', `${MG.MEMORY.maxMoves} 步內翻完全部 ${MG.MEMORY.pairs} 對才有獎勵`));
  const cards = g.deck.map((_, i) => { const c = el('button', 'mcard', '<span class="back">🀄</span><span class="front"></span>'); c.dataset.i = i; board.appendChild(c); return c; });
  host.append(info, board);
  const paint = () => { moves.textContent = `步數 ${g.moves} / ${MG.MEMORY.maxMoves}`; };
  board.addEventListener('click', (e) => {
    const c = e.target.closest('.mcard'); if (!c || lock || ended) return; const i = +c.dataset.i;
    const r = g.flip(i); if (r === null) return; log.push(i);
    c.querySelector('.front').textContent = SYMS[g.deck[i]]; c.classList.add('up');
    if (r === 'wait') return;
    lock = true; paint();
    setTimeout(() => {
      if (r === 'match') { g.picks.forEach((k) => cards[k].classList.add('ok')); }
      else g.picks.forEach((k) => { cards[k].classList.remove('up'); });
      g.clearPicks(); lock = false;
      if (g.win) { ended = true; setTimeout(() => onEnd(log, g.moves <= MG.MEMORY.maxMoves), 700); }
    }, r === 'match' ? 300 : 800);
  });
  paint();
  return () => { ended = true; };
}

export function playNum(host, { seed }, onEnd) {
  const secret = MG.numSecret(seed), guesses = []; let ended = false;
  host.innerHTML = '';
  const row = el('div', 'row'), inp = el('input', ''), ok = el('button', 'pri', '猜！'), give = el('button', '', '放棄'), hist = el('div', 'numhist');
  inp.maxLength = 4; inp.placeholder = '輸入 4 個不重複的數字'; inp.inputMode = 'numeric'; inp.style.maxWidth = '220px'; inp.style.margin = '0';
  row.append(inp, ok, give);
  host.append(el('div', 'mut', `密碼是 4 個「不重複」的數字（0~9）。nA = 數字和位置都對；nB = 數字對但位置不對。${MG.NUMGAME.maxGuesses} 次內猜中才有獎勵。`), row, hist);
  const finish = (win) => { if (ended) return; ended = true; setTimeout(() => onEnd(guesses.slice(), win, secret), 600); };
  const submit = () => {
    if (ended) return; const g = inp.value.trim();
    if (!MG.validGuess(g)) { inp.classList.add('bad'); setTimeout(() => inp.classList.remove('bad'), 400); return; }
    guesses.push(g); const [a, b] = MG.judge(secret, g);
    hist.prepend(el('div', 'nh', `<span>#${guesses.length}</span><b>${g}</b><span class="${a === 4 ? 'have' : ''}">${a}A${b}B</span>`));
    inp.value = ''; if (g === secret) finish(true); else if (guesses.length >= MG.NUMGAME.maxGuesses) finish(false);
  };
  ok.onclick = submit; inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  give.onclick = () => finish(false);
  inp.focus();
  return () => { ended = true; };
}

// ───── 切水果（固定 20ms 一個 tick，滑動線段記錄成 [tick,x1,y1,x2,y2]，伺服器重播驗證）─────
const FRUIT_GLOW = { '🍎': '#ff4d4d', '🍊': '#ff9f43', '🍌': '#ffe14d', '🍇': '#b06bff', '🍉': '#4cd37a', '🍍': '#ffd23f', '🥭': '#ffb347' };
let fruitBg = null;
function makeFruitBg() { // 夜色竹林・遠山・月亮（只畫一次）
  const c = document.createElement('canvas'); c.width = MG.FW; c.height = MG.FH; const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, MG.FH); sky.addColorStop(0, '#0d1b2e'); sky.addColorStop(0.45, '#27304f'); sky.addColorStop(0.75, '#5b3a4a'); sky.addColorStop(1, '#2a1a1a'); x.fillStyle = sky; x.fillRect(0, 0, MG.FW, MG.FH);
  const moon = x.createRadialGradient(760, 260, 10, 760, 260, 300); moon.addColorStop(0, 'rgba(255,248,220,.95)'); moon.addColorStop(0.18, 'rgba(255,240,200,.9)'); moon.addColorStop(0.2, 'rgba(255,230,170,.25)'); moon.addColorStop(1, 'rgba(255,230,170,0)'); x.fillStyle = moon; x.fillRect(0, 0, MG.FW, 700);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + (i * 37 % 10) / 20})`; x.fillRect((i * 193) % MG.FW, (i * 71) % 600, 3, 3); }
  const hill = (base, amp, col, ph) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, MG.FH); for (let px = 0; px <= MG.FW; px += 20) x.lineTo(px, base - amp * (0.5 + 0.5 * Math.sin(px / 140 + ph)) - amp * 0.4 * Math.sin(px / 53 + ph * 2)); x.lineTo(MG.FW, MG.FH); x.fill(); };
  hill(900, 220, 'rgba(36,44,74,.85)', 0.3); hill(1030, 190, 'rgba(26,32,56,.92)', 1.7); hill(1180, 150, 'rgba(18,22,38,.96)', 3.1);
  for (let i = 0; i < 9; i++) { const bx = 40 + i * 120 + (i % 2) * 30, h = 500 + (i * 83 % 300); x.fillStyle = 'rgba(14,34,28,.9)'; x.fillRect(bx, MG.FH - h, 18, h); for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(40,90,60,.9)'; x.fillRect(bx - 2, MG.FH - h + k * (h / 6), 22, 5); } x.fillStyle = 'rgba(40,120,70,.55)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(bx + (k % 2 ? 40 : -26), MG.FH - h + 70 + k * 90, 46, 11, k % 2 ? 0.5 : -0.5, 0, 7); x.fill(); } }
  const fg = x.createLinearGradient(0, MG.FH - 180, 0, MG.FH); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = fg; x.fillRect(0, MG.FH - 180, MG.FW, 180);
  return c;
}
export function playFruit(host, { seed, level }, onEnd) {
  const g = new MG.FruitSim(seed, level), LV = MG.FRUIT_LEVELS[level] || MG.FRUIT_LEVELS.easy, log = [], total = MG.FRUIT.seconds * 1000 / MG.FRUIT.tickMs;
  let ended = false, raf = 0, last = 0, acc = 0, pend = [], down = false, px = 0, py = 0, trail = [], fx = [], halves = [], parts = [], rings = [], flash = 0, shake = 0, boom = 0, fr = 0, popT = 0, combo = null;
  host.innerHTML = ''; fruitBg = fruitBg || makeFruitBg();
  const hud = el('div', 'row'), sc = el('b', '', ''), tm = el('span', 'mut', ''), tg = el('span', 'mut', '');
  hud.append(el('span', '', `🍉 ${LV.name}`), sc, tm, tg);
  const cv = el('canvas', ''); cv.width = MG.FW; cv.height = MG.FH; cv.style.cssText = 'width:100%;max-width:420px;aspect-ratio:1000/1400;touch-action:none;border-radius:14px;display:block;margin:6px auto;cursor:crosshair;box-shadow:0 0 0 3px #c9a227,0 8px 30px rgba(0,0,0,.5)';
  host.append(hud, cv, el('div', 'mut', '按住滑動切水果！🍎1 🍊2 🍌3 🍇4 🍉5 🍍6 🥭10；一刀切 3 個以上有連切加分；千萬別切到 💣！'));
  const ctx = cv.getContext('2d');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * MG.FW), Math.round((e.clientY - r.top) / r.height * MG.FH)]; };
  cv.onpointerdown = (e) => { down = true; [px, py] = pos(e); trail.push({ x: px, y: py, t: fr, brk: true }); try { cv.setPointerCapture(e.pointerId); } catch (_) {} };
  cv.onpointermove = (e) => {
    if (!down || ended) return; const [x, y] = pos(e); if (x === px && y === py) return;
    if (pend.length >= 2) { const l = pend[pend.length - 1]; l[2] = x; l[3] = y; } else pend.push([px, py, x, y]);
    px = x; py = y; trail.push({ x, y, t: fr }); if (trail.length > 40) trail.shift();
  };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  const burst = (x, y, col, n, bomb) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (bomb ? 500 : 220) + Math.random() * (bomb ? 900 : 520); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 28 + Math.random() * 20, max: 48, r: (bomb ? 10 : 6) + Math.random() * 10, col: bomb ? ['#ffb000', '#ff4d00', '#fff2a8', '#555'][i % 4] : col }); } };
  const onEv = (ev) => {
    if (ev.bomb) { shake = 28; flash = 14; burst(ev.x, ev.y, '#ff6600', 70, true); rings.push({ x: ev.x, y: ev.y, r: 20, life: 24 }, { x: ev.x, y: ev.y, r: 5, life: 18 }); return; }
    const col = FRUIT_GLOW[ev.e] || '#fff'; burst(ev.x, ev.y, col, 16); rings.push({ x: ev.x, y: ev.y, r: 20, life: 12, col });
    halves.push({ x: ev.x, y: ev.y, vx: -260, vy: -120, rot: 0, vr: -5, e: ev.e, side: 0, life: 50 }, { x: ev.x, y: ev.y, vx: 260, vy: -120, rot: 0, vr: 5, e: ev.e, side: 1, life: 50 });
    fx.push({ x: ev.x, y: ev.y - 40, txt: '+' + ev.pts, col, life: 28 }); popT = 10;
  };
  const draw = () => {
    fr++; const dt = 1 / 60;
    ctx.save(); if (shake > 0) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake--; }
    ctx.drawImage(fruitBg, 0, 0);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(255,230,160,.35)'; const t = fr / 140 + i * 1.7; ctx.beginPath(); ctx.arc(((i * 211 + Math.sin(t) * 40 + fr * 0.4) % MG.FW + MG.FW) % MG.FW, ((i * 137 - fr * (0.6 + i % 3 * 0.3)) % MG.FH + MG.FH) % MG.FH, 3 + i % 3, 0, 7); ctx.fill(); } // 螢火蟲
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const o of g.objs) {
      ctx.save(); ctx.translate(o.x, o.y); const spin = o.id * 1.7 + fr * 0.035 * (o.id % 2 ? 1 : -1); ctx.rotate(spin);
      if (o.bomb) { ctx.shadowColor = '#ff2d2d'; ctx.shadowBlur = 36 + 14 * Math.sin(fr / 4); ctx.font = '124px serif'; ctx.fillText('💣', 0, 0); ctx.rotate(-spin); ctx.shadowBlur = 0; ctx.fillStyle = `rgba(255,${160 + 80 * Math.sin(fr / 2) | 0},40,.95)`; ctx.beginPath(); ctx.arc(34, -70, 11 + 4 * Math.sin(fr), 0, 7); ctx.fill(); }
      else { ctx.shadowColor = FRUIT_GLOW[o.type.e] || '#fff'; ctx.shadowBlur = 30; ctx.font = `${100 + o.type.pts * 2}px serif`; ctx.fillText(o.type.e, 0, 0); }
      ctx.restore();
    }
    for (const h of halves) { h.x += h.vx * dt; h.vy += 1800 * dt; h.y += h.vy * dt; h.rot += h.vr * dt; h.life--; ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.globalAlpha = Math.max(0, h.life / 50); ctx.beginPath(); ctx.rect(h.side ? 0 : -90, -90, 90, 180); ctx.clip(); ctx.font = '110px serif'; ctx.fillText(h.e, 0, 0); ctx.restore(); }
    halves = halves.filter((h) => h.life > 0 && h.y < MG.FH + 200);
    for (const p of parts) { p.x += p.vx * dt; p.vy += 1500 * dt; p.y += p.vy * dt; p.life--; ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.max(0.3, p.life / p.max), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1; parts = parts.filter((p) => p.life > 0);
    for (const r of rings) { r.r += 26; r.life--; ctx.globalAlpha = Math.max(0, r.life / 24); ctx.strokeStyle = r.col || '#ffd27a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1; rings = rings.filter((r) => r.life > 0);
    // 刀光：越新越亮的漸層線條
    const now = fr; trail = trail.filter((p) => now - p.t < 12);
    if (trail.length > 1) for (let i = 1; i < trail.length; i++) { if (trail[i].brk) continue; const a = 1 - (now - trail[i].t) / 12; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(110,200,255,${a * 0.35})`; ctx.lineWidth = 30 * a + 4; ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 11 * a + 2; ctx.stroke(); }
    for (const f of fx) { f.life--; ctx.globalAlpha = Math.min(1, f.life / 14); ctx.font = `bold ${70 + (28 - f.life)}px sans-serif`; ctx.lineWidth = 8; ctx.strokeStyle = '#2a1500'; ctx.strokeText(f.txt, f.x, f.y - (28 - f.life) * 4); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y - (28 - f.life) * 4); }
    ctx.globalAlpha = 1; fx = fx.filter((f) => f.life > 0);
    if (combo && combo.life > 0) { combo.life--; ctx.globalAlpha = Math.min(1, combo.life / 20); ctx.font = 'bold 120px sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#4a0e0e'; ctx.strokeText(combo.txt, MG.FW / 2, 520); ctx.fillStyle = '#ffd24a'; ctx.fillText(combo.txt, MG.FW / 2, 520); ctx.globalAlpha = 1; }
    if (flash > 0) { ctx.fillStyle = `rgba(255,240,200,${flash / 14})`; ctx.fillRect(0, 0, MG.FW, MG.FH); flash--; }
    if (g.exploded) { ctx.fillStyle = `rgba(255,70,20,${Math.min(.55, boom / 14)})`; ctx.fillRect(0, 0, MG.FW, MG.FH); ctx.font = 'bold 150px sans-serif'; ctx.fillStyle = '#fff'; ctx.lineWidth = 12; ctx.strokeStyle = '#7a0000'; ctx.strokeText('💥 爆炸！', MG.FW / 2, 640); ctx.fillText('💥 爆炸！', MG.FW / 2, 640); boom++; }
    ctx.restore();
    sc.textContent = `${g.score} 分`; sc.style.transform = popT > 0 ? `scale(${1 + popT * 0.04})` : ''; sc.style.display = 'inline-block'; if (popT > 0) popT--;
    tm.textContent = `⏱ ${Math.max(0, Math.ceil((total - g.tick) * MG.FRUIT.tickMs / 1000))} 秒`; tg.textContent = `目標：超過 ${g.bot} 分`;
  };
  const finish = () => { ended = true; cancelAnimationFrame(raf); setTimeout(() => onEnd(log, g.win), g.exploded ? 1400 : 700); const tail = () => { if (!cv.isConnected) return; draw(); if (fr < 400) requestAnimationFrame(tail); }; tail(); };
  const loop = (now) => {
    if (ended) return; if (!last) last = now; acc += Math.min(200, now - last); last = now;
    while (acc >= MG.FRUIT.tickMs && !g.done) {
      acc -= MG.FRUIT.tickMs; const tk = g.tick; for (const s of pend) log.push([tk, ...s]); const ev0 = g.events.length, sc0 = g.score; g.step(pend); pend = [];
      const evs = g.events.slice(ev0); evs.forEach(onEv); const nf = evs.filter((e) => !e.bomb).length; if (nf >= 3) combo = { txt: `連切 ×${nf}！`, life: 40 };
    }
    draw(); if (g.done) { finish(); return; } raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { ended = true; cancelAnimationFrame(raf); };
}

// ───── 三格打殭屍（手機常見的 3 通道玩法：點通道攻擊最前面的殭屍，不要讓牠們走到底）─────
export function playZombie(host, { seed }, onEnd) {
  const g = new MG.ZombieSim(seed), log = [], total = MG.ZOMBIE.seconds * 1000 / MG.ZOMBIE.tickMs, W = 600, H = 800;
  let ended = false, raf = 0, last = 0, acc = 0, pend = [], flash = [0, 0, 0], shake = 0, wild = 0;
  host.innerHTML = '';
  const hud = el('div', 'row'), kl = el('b', '', ''), lv = el('span', '', ''), tm = el('span', 'mut', '');
  hud.append(kl, lv, tm);
  const cv = el('canvas', ''); cv.width = W; cv.height = H; cv.style.cssText = 'width:100%;max-width:360px;aspect-ratio:3/4;touch-action:none;background:#1f2a22;border-radius:12px;display:block;margin:6px auto;cursor:pointer';
  host.append(hud, cv, el('div', 'mut', `殭屍要走過一半（虛線）才能點擊；點擊（或按 A／S／D、←↓→）該通道攻擊最前面的殭屍，🧟‍♂️ 壯殭屍要打 3 下。⚠️ 通道上沒有過半的殭屍卻亂點，會扣 1 條命！${MG.ZOMBIE.seconds} 秒內擊倒 ${MG.ZOMBIE.needKills} 隻、且至少剩 1 條命才算贏。`));
  const ctx = cv.getContext('2d');
  const tap = (lane) => { if (ended || g.cool > 0 || pend.length) return; pend.push(lane); flash[lane] = 4; };
  cv.onpointerdown = (e) => { const r = cv.getBoundingClientRect(); tap(Math.min(2, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 3)))); };
  const key = (e) => { const k = { a: 0, s: 1, d: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2, 1: 0, 2: 1, 3: 2 }[e.key]; if (k !== undefined) { e.preventDefault(); tap(k); } };
  document.addEventListener('keydown', key);
  const draw = () => {
    ctx.clearRect(0, 0, W, H); ctx.save(); if (shake > 0) { ctx.translate((Math.random() - .5) * 16, 0); shake--; }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? '#26352b' : '#2d3d32'; ctx.fillRect(i * W / 3, 0, W / 3, H);
      if (flash[i] > 0) { ctx.fillStyle = 'rgba(255,230,150,.35)'; ctx.fillRect(i * W / 3, 0, W / 3, H); flash[i]--; }
    }
    ctx.fillStyle = '#c0392b'; ctx.fillRect(0, H - 40, W, 6);
    ctx.setLineDash([14, 10]); ctx.strokeStyle = 'rgba(255,230,150,.7)'; ctx.lineWidth = 3; const hy = 50 + MG.ZOMBIE.hitFrom * (H - 100); ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,230,150,.8)'; ctx.font = '22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('↓ 過線才能打', 8, hy - 12); ctx.textAlign = 'center';
    if (wild > 0) { ctx.fillStyle = `rgba(255,40,40,${wild / 20})`; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif'; ctx.fillText('亂點！−1 ❤️', W / 2, H / 2); wild--; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const z of g.zs) { ctx.font = '90px serif'; ctx.fillText(z.t.e, z.lane * W / 3 + W / 6, 50 + z.pos * (H - 100)); if (z.t.hp > 1) { ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('♥'.repeat(z.hp), z.lane * W / 3 + W / 6, 50 + z.pos * (H - 100) - 60); } }
    ctx.font = '60px serif'; for (let i = 0; i < 3; i++) ctx.fillText('🗡️', i * W / 3 + W / 6, H - 14);
    ctx.restore();
    kl.textContent = `⚔️ ${g.kills} / ${MG.ZOMBIE.needKills}`; lv.textContent = '❤️'.repeat(Math.max(0, g.lives)) + '🖤'.repeat(Math.max(0, MG.ZOMBIE.lives - g.lives));
    tm.textContent = `⏱ ${Math.max(0, Math.ceil((total - g.tick) * MG.ZOMBIE.tickMs / 1000))} 秒`;
  };
  const stop = () => document.removeEventListener('keydown', key);
  const finish = () => { ended = true; stop(); cancelAnimationFrame(raf); draw(); setTimeout(() => onEnd(log, g.win), 700); };
  const loop = (now) => {
    if (ended) return; if (!last) last = now; acc += Math.min(200, now - last); last = now;
    while (acc >= MG.ZOMBIE.tickMs && !g.done) {
      acc -= MG.ZOMBIE.tickMs; for (const l of pend) log.push([g.tick, l]); const lv0 = g.lives, e0 = g.events.length; g.step(pend); pend = []; if (g.lives < lv0) shake = 8; if (g.events.slice(e0).some((e) => e.wild)) wild = 20;
    }
    draw(); if (g.done) { finish(); return; } raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { ended = true; stop(); cancelAnimationFrame(raf); };
}
