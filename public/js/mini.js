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
