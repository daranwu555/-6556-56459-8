// 小遊戲畫面：踩地雷、記憶翻牌、猜數字（規則與驗證在 minigames.js，伺服器會重播操作來驗證輸贏）
import MG from '/js/minigames.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const COLORS = ['', '#4da6ff', '#4cb86a', '#ff6b6b', '#8a6bff', '#ff9f43', '#2ec4b6', '#f2e9c8', '#aaaaaa'];

export function playMine(host, { seed, level }, onEnd) {
  const g = new MG.Mine(seed, level), L = MG.MINE_LEVELS[level], log = []; let flagMode = false, t0 = null, timer = null, ended = false;
  host.innerHTML = '';
  const bar = el('div', 'row'), left = el('b', '', ''), time = el('span', 'mut', '⏱ 0 秒'), tog = el('button', '', '🚩 插旗模式：關'), give = el('button', '', '放棄');
  bar.append(left, time, tog, give);
  const board = el('div', 'mine'); board.style.gridTemplateColumns = `repeat(${g.w}, 1fr)`; board.style.maxWidth = `${g.w * 34}px`;
  const cells = []; for (let i = 0; i < g.w * g.h; i++) { const c = el('button', 'mc'); c.dataset.i = i; board.appendChild(c); cells.push(c); }
  host.append(bar, board, el('div', 'mut', '左鍵翻開、右鍵（或開啟插旗模式後點擊）插旗。第一次點擊與周圍一定安全。'));
  const render = () => {
    left.textContent = `💣 剩 ${g.flagsLeft()}`;
    cells.forEach((c, i) => {
      c.className = 'mc'; c.textContent = ''; c.style.color = '';
      if (g.open[i]) { c.classList.add('o'); const n = g.count(i); if (n) { c.textContent = n; c.style.color = COLORS[n]; } }
      else if (g.flag[i]) c.textContent = '🚩';
      else if (g.over && g.mine && g.mine[i]) { c.classList.add('o'); c.textContent = i === g.hit ? '💥' : '💣'; }
    });
  };
  const finish = (win) => { if (ended) return; ended = true; clearInterval(timer); render(); board.classList.add('done'); setTimeout(() => onEnd(log, win), 900); };
  const act = (i, flag) => {
    if (ended) return; if (!t0) { t0 = Date.now(); timer = setInterval(() => { time.textContent = `⏱ ${Math.floor((Date.now() - t0) / 1000)} 秒`; }, 500); }
    if (flag) { g.toggleFlag(i); log.push(['f', i]); } else { g.reveal(i); log.push(['r', i]); }
    render(); if (g.over) finish(g.win);
  };
  board.addEventListener('click', (e) => { const c = e.target.closest('.mc'); if (c) act(+c.dataset.i, flagMode); });
  board.addEventListener('contextmenu', (e) => { e.preventDefault(); const c = e.target.closest('.mc'); if (c) act(+c.dataset.i, true); });
  tog.onclick = () => { flagMode = !flagMode; tog.textContent = `🚩 插旗模式：${flagMode ? '開' : '關'}`; tog.classList.toggle('on', flagMode); };
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
export function playFruit(host, { seed }, onEnd) {
  const g = new MG.FruitSim(seed), log = [], total = MG.FRUIT.seconds * 1000 / MG.FRUIT.tickMs;
  let ended = false, raf = 0, last = 0, acc = 0, pend = [], down = false, px = 0, py = 0, trail = [], fx = [], boom = 0;
  host.innerHTML = '';
  const hud = el('div', 'row'), sc = el('b', '', ''), tm = el('span', 'mut', ''), tg = el('span', 'mut', '');
  hud.append(sc, tm, tg);
  const cv = el('canvas', ''); cv.width = MG.FW; cv.height = MG.FH; cv.style.cssText = 'width:100%;max-width:400px;aspect-ratio:1000/1400;touch-action:none;background:linear-gradient(#1c2b2d,#2d1f17);border-radius:12px;display:block;margin:6px auto;cursor:crosshair';
  host.append(hud, cv, el('div', 'mut', '按住滑動切水果！🍎1 🍊2 🍌3 🍇4 🍉5 🍍6 🥭10；一刀切 3 個以上有連切加分；千萬別切到 💣！'));
  const ctx = cv.getContext('2d');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * MG.FW), Math.round((e.clientY - r.top) / r.height * MG.FH)]; };
  cv.onpointerdown = (e) => { down = true; [px, py] = pos(e); trail = [[px, py]]; try { cv.setPointerCapture(e.pointerId); } catch (_) {} };
  cv.onpointermove = (e) => {
    if (!down || ended) return; const [x, y] = pos(e); if (x === px && y === py) return;
    if (pend.length >= 2) { const l = pend[pend.length - 1]; l[2] = x; l[3] = y; } else pend.push([px, py, x, y]);
    px = x; py = y; trail.push([x, y]); if (trail.length > 8) trail.shift();
  };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  const draw = () => {
    ctx.clearRect(0, 0, MG.FW, MG.FH); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const o of g.objs) { ctx.font = '110px serif'; ctx.fillText(o.bomb ? '💣' : o.type.e, o.x, o.y); }
    for (const f of fx) { ctx.globalAlpha = Math.max(0, f.life / 20); ctx.font = 'bold 70px sans-serif'; ctx.fillStyle = f.bomb ? '#ff5050' : '#ffe08a'; ctx.fillText(f.bomb ? '💥' : '+' + f.pts, f.x, f.y - (20 - f.life) * 3); f.life--; }
    ctx.globalAlpha = 1; fx = fx.filter((f) => f.life > 0);
    if (trail.length > 1) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(trail[0][0], trail[0][1]); trail.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.stroke(); }
    if (!down && trail.length) trail.shift();
    if (g.exploded) { ctx.fillStyle = `rgba(255,${120 - boom * 4},40,${Math.min(.8, boom / 10)})`; ctx.fillRect(0, 0, MG.FW, MG.FH); boom++; }
    sc.textContent = `🍉 ${g.score} 分`; tm.textContent = `⏱ ${Math.max(0, Math.ceil((total - g.tick) * MG.FRUIT.tickMs / 1000))} 秒`; tg.textContent = `對手目標 ${g.bot} 分（要超過才贏）`;
  };
  const finish = () => { ended = true; cancelAnimationFrame(raf); draw(); setTimeout(() => onEnd(log, g.win), g.exploded ? 1200 : 600); };
  const loop = (now) => {
    if (ended) return; if (!last) last = now; acc += Math.min(200, now - last); last = now;
    while (acc >= MG.FRUIT.tickMs && !g.done) {
      acc -= MG.FRUIT.tickMs; const tk = g.tick; for (const s of pend) log.push([tk, ...s]); const ev0 = g.events.length; g.step(pend); pend = [];
      for (const ev of g.events.slice(ev0)) fx.push({ x: ev.x, y: ev.y, pts: ev.pts, bomb: ev.bomb, life: 20 });
    }
    draw(); if (g.done) { finish(); return; } raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { ended = true; cancelAnimationFrame(raf); };
}

// ───── 三格打殭屍（手機常見的 3 通道玩法：點通道攻擊最前面的殭屍，不要讓牠們走到底）─────
export function playZombie(host, { seed }, onEnd) {
  const g = new MG.ZombieSim(seed), log = [], total = MG.ZOMBIE.seconds * 1000 / MG.ZOMBIE.tickMs, W = 600, H = 800;
  let ended = false, raf = 0, last = 0, acc = 0, pend = [], flash = [0, 0, 0], shake = 0;
  host.innerHTML = '';
  const hud = el('div', 'row'), kl = el('b', '', ''), lv = el('span', '', ''), tm = el('span', 'mut', '');
  hud.append(kl, lv, tm);
  const cv = el('canvas', ''); cv.width = W; cv.height = H; cv.style.cssText = 'width:100%;max-width:360px;aspect-ratio:3/4;touch-action:none;background:#1f2a22;border-radius:12px;display:block;margin:6px auto;cursor:pointer';
  host.append(hud, cv, el('div', 'mut', `點擊（或按 A／S／D、←↓→）該通道攻擊最前面的殭屍；🧟‍♂️ 壯殭屍要打 3 下。${MG.ZOMBIE.seconds} 秒內擊倒 ${MG.ZOMBIE.needKills} 隻、且至少剩 1 條命才算贏。`));
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
      acc -= MG.ZOMBIE.tickMs; for (const l of pend) log.push([g.tick, l]); const lv0 = g.lives; g.step(pend); pend = []; if (g.lives < lv0) shake = 8;
    }
    draw(); if (g.done) { finish(); return; } raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { ended = true; stop(); cancelAnimationFrame(raf); };
}
