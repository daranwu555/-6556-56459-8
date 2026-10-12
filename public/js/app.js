import { HouseView, DressView, hydrateThumbs, assetUrl } from './gfx.js';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ws, P = null, CAT = null, CFG = null, gender = 'm', view = 'house', mode = 'login';
let sel = null, houseCat = 'all', shopStyle = 'all', shopCat = 'all', boardTab = 'wins', board = null, visiting = null;
let reconnectTimer;

// ───── 連線 ─────
function connect() {
  ws = window.__LocalSocket ? new window.__LocalSocket() : new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    $('#conn').textContent = '已連線 ✔';
    const tk = localStorage.getItem('hq_token');
    if (tk) ws.send(JSON.stringify({ t: 'hello', token: tk }));
  };
  ws.onclose = () => { $('#conn').textContent = '連線中斷，重試中…'; clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 2000); };
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
}
const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function onMsg(m) {
  switch (m.t) {
    case 'needLogin': localStorage.removeItem('hq_token'); break;
    case 'authErr': $('#authMsg').textContent = m.msg; break;
    case 'welcome':
      localStorage.setItem('hq_token', m.token);
      CAT = m.catalog; CFG = m.cfg; P = m.p;
      if (CFG.offline) { $('#sOnline').parentElement.innerHTML = '🏮 單機版（存檔在這個瀏覽器）<span id="sOnline" class="hidden"></span>'; ['#qOnline', '#qCodeRow'].forEach((q) => $(q).classList.add('hidden')); }
      $('#login').classList.add('hidden'); $('#game').classList.remove('hidden');
      renderAll(); break;
    case 'profile': P = m.p; renderAll(); break;
    case 'online': $('#sOnline').textContent = m.n; break;
    case 'err': toast('⚠️ ' + m.msg); break;
    case 'toast': toast(m.msg); break;
    case 'kicked': localStorage.removeItem('hq_token'); toast('此帳號已在其他地方登入'); setTimeout(() => location.reload(), 1200); break;
    case 'queue': showQuiz('wait'); $('#waitTxt').textContent = m.code ? `邀請碼：${m.code}　請把這組碼告訴朋友（${Math.round(m.ms / 1000)} 秒內有效）` : '等待其他玩家加入…'; break;
    case 'queueCancelled': showQuiz('lobby'); if (m.msg) toast(m.msg); break;
    case 'matchFound': matchStart(m); break;
    case 'q': showQuestion(m); break;
    case 'oppAns': $('#opState').textContent = '對手已作答 ✔'; break;
    case 'reveal': showReveal(m); break;
    case 'end': showEnd(m); break;
    case 'board': board = m; renderBoard(); break;
    case 'likeOk': toast(m.reward ? `👍 已按讚，你獲得 ${m.reward} 元！（今日還可領 ${m.left} 次）` : '👍 已按讚（今日按讚獎勵已領滿）'); send({ t: 'board' }); break;
    case 'visit': visiting = m.v; renderVisit(); break;
  }
}

// ───── 登入 / 註冊 ─────
function setMode(m) {
  mode = m; $('#tLogin').classList.toggle('on', m === 'login'); $('#tReg').classList.toggle('on', m === 'register');
  $('#regBox').classList.toggle('hidden', m === 'login'); $('#go').textContent = m === 'login' ? '登入' : '建立帳號並開始（初始 1000 元）';
  $('#authMsg').textContent = '';
}
$('#tLogin').onclick = () => setMode('login'); $('#tReg').onclick = () => setMode('register');
$('#gm').onclick = () => { gender = 'm'; $('#gm').classList.add('on'); $('#gf').classList.remove('on'); };
$('#gf').onclick = () => { gender = 'f'; $('#gf').classList.add('on'); $('#gm').classList.remove('on'); };
$('#go').onclick = () => send({ t: mode, username: $('#uname').value, password: $('#pw').value, name: $('#nm').value, gender });
$('#pw').onkeydown = (e) => { if (e.key === 'Enter') $('#go').click(); };

document.querySelectorAll('nav button').forEach((b) => b.onclick = () => { view = b.dataset.v; if (view === 'social') send({ t: 'board' }); renderAll(); });

function renderAll() {
  if (!P) return;
  $('#sName').textContent = (P.gender === 'm' ? '👨 ' : '👩 ') + P.name;
  $('#sMoney').textContent = P.money.toLocaleString();
  $('#sLv').textContent = P.level;
  $('#sNovice').textContent = P.novice ? '新手' : '老手';
  $('#sNovice').classList.toggle('vet', !P.novice);
  $('#expBar').style.width = Math.min(100, (P.exp / P.expNeed) * 100) + '%';
  $('#expTxt').textContent = `經驗 ${P.exp} / ${P.expNeed}（升到 Lv.${P.level + 1}）`;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== 'v-' + view));
  if (view === 'house') renderHouse();
  if (view === 'dress') renderDress();
  if (view === 'ware') renderWare();
  if (view === 'shop') renderShop();
  if (view === 'quiz') renderLobby();
  if (view === 'social') { renderBoard(); renderVisit(); }
}

// ───── 共用：物品 / 縮圖 ─────
const I = (id) => CAT.items[id];
const thumbImg = (it) => `<img data-thumb="${it.id}" class="${it.tex ? 'tx' : ''}" alt="${esc(it.name)}" ${it.tex ? `src="${assetUrl(it.tex)}"` : ''}>`;
const tag = (it) => (it.style === 'none' ? '' : `<span class="tag ${it.style}">${CAT.styles[it.style]}</span>`);
const hydrate = (el) => hydrateThumbs(el, CAT.items);
const wornN = (id) => Object.values(P.worn).filter((x) => x === id).length;
const inUse = (id) => work.placed.filter((x) => x.id === id).length + wornN(id) + (work.wall === id ? 1 : 0) + (work.carpet === id ? 1 : 0);
const placedN = (id) => work.placed.filter((x) => x.id === id).length;

function chips(el, entries, cur, cb) {
  el.innerHTML = '';
  entries.forEach(([k, label]) => {
    const b = document.createElement('button'); b.textContent = label; if (k === cur) b.classList.add('on');
    b.onclick = () => cb(k); el.appendChild(b);
  });
}
function styleLine(d) {
  const ids = [d.house.wall, d.house.carpet, ...d.house.placed.map((x) => x.id), ...Object.values(d.worn || {})].filter(Boolean);
  if (!ids.length) return '';
  const c = {}; ids.forEach((id) => { const s = I(id).style; c[s] = (c[s] || 0) + 1; });
  const [top, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  const pct = Math.round((n / ids.length) * 100), sb = CFG.styleBonus;
  return `房屋風格：${CAT.styles[top]} ${pct}%` + (pct >= sb.ratio * 100 && ids.length >= sb.minItems ? ` ✨ 風格加成：答題金錢 +${sb.rate * 100}%` : `（風格 ≥${sb.ratio * 100}% 且至少 ${sb.minItems} 件，答題金錢 +${sb.rate * 100}%）`);
}

// ───── 房屋（3D）─────
let houseStage = null, work = { wall: null, carpet: null, placed: [] }, hold = null;
const cloneHouse = (h) => JSON.parse(JSON.stringify(h));
function ensureHouseStage() {
  if (houseStage) return;
  houseStage = new HouseView($('#room3d'), { interactive: true, onPlace, onPick, onInvalid: () => toast('這裡放不下，換個位置吧') });
  houseStage.setItems(CAT.items);
  window.addEventListener('keydown', (e) => { if (view !== 'house' || !hold) return; if (e.key === 'r' || e.key === 'R') rotateHold(); if (e.key === 'Escape') cancelHold(); });
}
const sendHouse = () => send({ t: 'house', house: work });
function setHold(h) { hold = h; houseStage.setHold(h && h.id, h && h.rot); renderHouse(); }
function rotateHold() { if (hold) { hold.rot = (hold.rot + 1) % 4; houseStage.setHold(hold.id, hold.rot); } }
function cancelHold() { if (!hold) return; if (hold.orig) work = cloneHouse(P.house); setHold(null); }
function onPlace(pl) {
  work.placed.push({ id: pl.id, x: pl.x, z: pl.z, rot: pl.rot });
  const left = P.owned[pl.id] - placedN(pl.id);
  sendHouse();
  if (hold.orig || left <= 0) { hold = null; houseStage.setHold(null); } else hold.orig = null;
  renderHouse();
}
function onPick(i) { const it = work.placed.splice(i, 1)[0]; setHold({ id: it.id, rot: it.rot, orig: it }); }
$('#hRot').onclick = rotateHold; $('#hCancel').onclick = cancelHold;
$('#hRemove').onclick = () => { if (hold && hold.orig) { sendHouse(); setHold(null); } else toast('先點擊房間裡的家具，再按收回'); };

function renderHouse() {
  ensureHouseStage();
  if (!hold) work = cloneHouse(P.house);
  houseStage.setData({ cols: P.cols, rows: P.rows, house: work, worn: P.worn, gender: P.gender });
  $('#houseHint').textContent = (hold ? `拿著：${I(hold.id).name}（旋轉 ${hold.rot * 90}°）` : '房屋 Lv.' + P.houseLv + `（${P.cols}×${P.rows} 公尺）`) + '　' + styleLine({ house: work, worn: P.worn });

  const next = CFG.houseLevels[P.houseLv];
  if (!next) $('#expandBox').innerHTML = `<h3>🏗️ 房屋擴建</h3><p>房屋已是最高等級 Lv.${P.houseLv}（${P.cols}×${P.rows} 公尺）！</p>`;
  else {
    const mats = Object.entries(next.mats).map(([id, n]) => { const have = P.owned[id] || 0; return `<span class="${have >= n ? 'have' : 'need'}">${I(id).emoji}${I(id).name} ${have}/${n}</span>`; }).join('　');
    const can = P.money >= next.money && Object.entries(next.mats).every(([id, n]) => (P.owned[id] || 0) >= n);
    $('#expandBox').innerHTML = `<h3>🏗️ 房屋擴建 Lv.${P.houseLv} → Lv.${P.houseLv + 1}（${P.cols}×${P.rows} → ${next.cols}×${next.rows} 公尺）</h3>
      <p>💰 <span class="${P.money >= next.money ? 'have' : 'need'}">${P.money}/${next.money}</span>　${mats}</p>
      <p class="mut">建材到商店購買（需先蓋商店），存放在倉庫。</p><button class="pri" id="expBtn" ${can ? '' : 'disabled'}>擴建房屋</button>`;
    $('#expBtn').onclick = () => send({ t: 'expand' });
  }

  const owned = Object.keys(P.owned).filter((id) => ['furn', 'wall', 'floor'].includes(I(id).kind));
  const cats = ['all', ...Object.keys(CAT.cats).filter((k) => owned.some((id) => I(id).cat === k))];
  chips($('#houseChips'), cats.map((k) => [k, k === 'all' ? '全部' : CAT.cats[k].label]), houseCat, (k) => { houseCat = k; renderHouse(); });
  const tray = $('#houseTray'); tray.innerHTML = '';
  const ids = owned.filter((id) => houseCat === 'all' || I(id).cat === houseCat);
  if (!ids.length) tray.innerHTML = '<span class="mut">還沒有家具，去商店逛逛吧！（需先建造商店）</span>';
  ids.forEach((id) => {
    const it = I(id), kind = it.kind, d = document.createElement('div'); d.className = 'it' + (hold && hold.id === id ? ' sel' : '');
    let btn, fn;
    if (kind === 'wall') { btn = work.wall === id ? '取消' : '貼上'; fn = () => { work.wall = work.wall === id ? null : id; sendHouse(); }; }
    else if (kind === 'floor') { btn = work.carpet === id ? '取消' : '鋪上'; fn = () => { work.carpet = work.carpet === id ? null : id; sendHouse(); }; }
    else { btn = hold && hold.id === id ? '放下' : '拿起擺放'; fn = () => (hold && hold.id === id ? (cancelHold(), setHold(null)) : P.owned[id] - placedN(id) > 0 ? setHold({ id, rot: 0, orig: null }) : toast('這件家具都已擺放了')); }
    const left = kind === 'furn' ? ` 剩${P.owned[id] - placedN(id)}` : '';
    d.innerHTML = `${thumbImg(it)}<div class="nm">${esc(it.name)}${left}<br>${tag(it)}</div><button>${btn}</button>`;
    d.querySelector('button').onclick = fn;
    tray.appendChild(d);
  });
  hydrate(tray);
}


// ───── 更衣室（3D）─────
let dressStage = null, dressSlot = 'suit', dressStyle = 'all', tryOn = {};
const SLOTS = ['head', 'suit', 'top', 'bottom', 'shoes'];
function renderDress() {
  if (!dressStage) {
    dressStage = new DressView($('#dress3d'));
    chips($('#dressCam'), [['full', '全身'], ['upper', '上半身'], ['head', '頭部'], ['feet', '鞋子'], ['spin', '⏯ 旋轉']], '', (k) => { if (k === 'spin') dressStage.controls.autoRotate = !dressStage.controls.autoRotate; else dressStage.focus(k); });
  }
  const look = { ...P.worn, ...tryOn };
  dressStage.setLook(P.gender, look, CAT.items);
  chips($('#dressSlots'), SLOTS.map((k) => [k, CAT.cats[k].label]), dressSlot, (k) => { dressSlot = k; renderDress(); });
  chips($('#dressStyle'), [['all', '全部風格'], ...Object.entries(CAT.styles)], dressStyle, (k) => { dressStyle = k; renderDress(); });
  const tray = $('#dressTray'); tray.innerHTML = '';
  Object.values(CAT.items).filter((it) => it.cat === dressSlot && (!it.starter || it.gender === P.gender) && (dressStyle === 'all' || it.style === dressStyle || it.starter)).forEach((it) => {
    const own = P.owned[it.id] || 0, worn = P.worn[it.cat] === it.id, trying = tryOn[it.cat] === it.id;
    const d = document.createElement('div'); d.className = 'it' + (trying || (worn && !tryOn[it.cat]) ? ' sel' : '');
    d.innerHTML = `${thumbImg(it)}<div class="nm">${esc(it.name)}<br>${tag(it)}</div>` +
      (own ? `<div class="mut">已擁有${worn ? '・穿著中' : ''}</div><button data-a="wear">${worn ? '脫下' : '穿上'}</button>` : `<div class="pr">💰 ${it.price}</div><button data-a="try">${trying ? '試穿中' : '試穿'}</button><button data-a="buy" ${P.shop && P.money >= it.price ? '' : 'disabled'}>購買</button>`);
    d.querySelectorAll('button').forEach((b) => b.onclick = () => {
      if (b.dataset.a === 'wear') { delete tryOn[it.cat]; send({ t: 'equip', slot: it.cat, id: worn ? null : it.id }); }
      else if (b.dataset.a === 'try') { tryOn[it.cat] = trying ? undefined : it.id; if (!tryOn[it.cat]) delete tryOn[it.cat]; renderDress(); }
      else send({ t: 'buy', id: it.id });
    });
    tray.appendChild(d);
  });
  hydrate(tray);
  $('#newName').value = $('#newName').value || P.name; $('#renameBtn').textContent = `改名（${CFG.renameCost.toLocaleString()} 元）`; $('#renameBtn').disabled = P.money < CFG.renameCost; $('#renameHint').textContent = `註冊時取名免費，之後改名需要 ${CFG.renameCost.toLocaleString()} 元。`;
  $('#renameBtn').onclick = () => send({ t: 'rename', name: $('#newName').value });
  $('#dressNote').textContent = (Object.keys(tryOn).length ? '👀 目前是試穿畫面（未購買的衣服不會被保存）。' : '') + (P.shop ? '' : ' 蓋好商店後才能購買服飾。') + ' 穿套裝時，會覆蓋上衣和下裝。';
}

// ───── 倉庫 ─────
function renderWare() {
  const W = CFG.warehouse, up = W.upgradeBase * (P.warehouseLv + 1);
  $('#wareInfo').innerHTML = `<h3>📦 倉庫</h3><div class="bar"><i style="width:${(P.matCount / P.capacity) * 100}%"></i></div>
    <p>建材空間 <b>${P.matCount} / ${P.capacity}</b>　倉庫等級 ${P.warehouseLv}</p>
    <button class="pri" id="wUp">升級倉庫 +${W.upgradeCap} 格（${up} 元）</button>`;
  $('#wUp').onclick = () => send({ t: 'upgradeWarehouse' });
  const fill = (el, ids, empty) => {
    el.innerHTML = '';
    if (!ids.length) el.innerHTML = `<span class="mut">${empty}</span>`;
    ids.forEach((id) => {
      const it = I(id), d = document.createElement('div'); d.className = 'it';
      d.innerHTML = `${thumbImg(it)}<div class="nm">${esc(it.name)} ×${P.owned[id]}<br>${tag(it)}${inUse(id) ? `<br><span class="mut">使用中 ${inUse(id)}</span>` : ''}</div>` + (P.shop && !it.starter ? `<button>賣 ${Math.floor(it.price * CFG.sellRate)}</button>` : '');
      if (P.shop && !it.starter) d.querySelector('button').onclick = () => send({ t: 'sell', id });
      el.appendChild(d);
    });
    hydrate(el);
  };
  fill($('#matTray'), Object.keys(P.owned).filter((id) => I(id).kind === 'mat'), '沒有建材，去商店買吧');
  fill($('#wareTray'), Object.keys(P.owned).filter((id) => I(id).kind !== 'mat'), '沒有家具或服飾');
}

// ───── 商店 ─────
function renderShop() {
  if (!P.shop) {
    $('#shopInfo').innerHTML = `<h3>🏪 商店</h3><p>尚未建造商店。建造後即可購買建材、服飾與家具，並可賣出物品（賣出價 ${Math.round(CFG.sellRate * 100)}%）。</p><button class="pri" id="sBuild">建造商店（${CFG.shopBuild} 元）</button>`;
    $('#sBuild').onclick = () => send({ t: 'buildShop' });
    $('#shopBox').classList.add('hidden'); return;
  }
  $('#shopInfo').innerHTML = `<h3>🏪 商店</h3><p class="mut">每件商品都有「持有上限」，賣出或用掉（擴建消耗建材）後可再購買。服飾可到「更衣室」試穿。</p>`;
  $('#shopBox').classList.remove('hidden');
  chips($('#shopStyle'), [['all', '全部風格'], ...Object.entries(CAT.styles)], shopStyle, (k) => { shopStyle = k; renderShop(); });
  chips($('#shopCat'), [['all', '全部類別'], ...Object.entries(CAT.cats).map(([k, v]) => [k, v.label])], shopCat, (k) => { shopCat = k; renderShop(); });
  const tray = $('#shopTray'); tray.innerHTML = '';
  Object.values(CAT.items).filter((it) => !it.starter && (shopStyle === 'all' || it.style === shopStyle) && (shopCat === 'all' || it.cat === shopCat)).forEach((it) => {
    const own = P.owned[it.id] || 0, full = own >= it.limit;
    const d = document.createElement('div'); d.className = 'it';
    d.innerHTML = `${thumbImg(it)}<div class="nm">${esc(it.name)}<br>${tag(it)} <span class="mut">${CAT.cats[it.cat].label}</span></div><div class="pr">💰 ${it.price}</div><div class="mut">持有 ${own}/${it.limit}</div><button ${full || P.money < it.price ? 'disabled' : ''}>${full ? '已達上限' : '購買'}</button>`;
    d.querySelector('button').onclick = () => send({ t: 'buy', id: it.id });
    tray.appendChild(d);
  });
  hydrate(tray);
}

// ───── 問答 ─────
let qTimer, qEnd = 0, answered = false, curQ = null;
function renderLobby() {
  $('#myMul').textContent = P.novice ? `新手（Lv ≤ ${CFG.noviceLevel}）：連答 combo 平常 +20%，遇到老手時 +60%（×${CFG.noviceMul}）` : `老手：連答 combo +20%（×${CFG.comboMul}）`;
  $('#myMul').classList.toggle('vet', !P.novice);
  $('#mulHint').textContent = `等級 ≤ ${CFG.noviceLevel} 為新手，新手可以和任何人對戰；只有「新手遇到老手」時，新手的連答倍率才會提高。對戰電腦或雙方都是新手，一律 ×1.2。` + (P.styleBonus ? ` 你的房屋風格加成 +${P.styleBonus * 100}% ✨` : '');
  $('#qStat').textContent = `戰績：${P.stats.played} 場 / ${P.stats.wins} 勝　最高連擊 ${P.stats.bestCombo}`;
}
function showQuiz(which) { ['Lobby', 'Wait', 'Play', 'End'].forEach((n) => $('#quiz' + n).classList.toggle('hidden', n.toLowerCase() !== which)); }
$('#qOnline').onclick = () => send({ t: 'quiz', mode: 'online' });
$('#qBot').onclick = () => send({ t: 'quiz', mode: 'bot' });
$('#qCodeGo').onclick = () => send({ t: 'quiz', mode: 'code', code: $('#qCode').value });
$('#qCancel').onclick = () => send({ t: 'cancelQueue' });
$('#qReport').onclick = () => { if (curQ) { send({ t: 'report', qid: curQ, reason: '玩家回報' }); $('#qReport').classList.add('hidden'); } };

function matchStart(m) {
  view = 'quiz'; renderAll(); showQuiz('play');
  $('#meName').innerHTML = (P.gender === 'm' ? '👨 ' : '👩 ') + esc(P.name) + `（你）<br><span class="badge ${m.mul < 1.5 ? 'vet' : ''}">combo ×${m.mul}</span>`;
  $('#opName').textContent = (m.opp.gender === 'm' ? '👨 ' : '👩 ') + m.opp.name + (m.opp.bot ? ' 🤖' : ` Lv.${m.opp.level}`);
  ['#meScore', '#opScore'].forEach((s) => $(s).textContent = '0');
  ['#meCombo', '#opCombo', '#meMoney', '#opState', '#qEvents', '#qDiff'].forEach((s) => $(s).textContent = '');
  $('#qtext').textContent = '配對成功！準備開始…'; $('#opts').innerHTML = ''; $('#qNo').textContent = ''; $('#qCat').textContent = '';
  $('#timeBar').style.width = '100%'; $('#qReport').classList.add('hidden');
}
function showQuestion(m) {
  answered = false; curQ = m.id;
  $('#qNo').textContent = `第 ${m.i + 1} / ${m.total} 題`; $('#qCat').textContent = m.cat;
  $('#qDiff').textContent = ''; $('#qReport').classList.add('hidden');
  $('#qtext').textContent = m.q; $('#qEvents').textContent = ''; $('#opState').textContent = '';
  const box = $('#opts'); box.innerHTML = '';
  m.opts.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'opt'; b.textContent = ['A', 'B', 'C', 'D'][i] + '. ' + o;
    b.onclick = () => { if (answered) return; answered = true; b.classList.add('picked'); box.querySelectorAll('button').forEach((x) => x.disabled = true); send({ t: 'answer', choice: i }); };
    box.appendChild(b);
  });
  qEnd = Date.now() + m.ms; clearInterval(qTimer);
  qTimer = setInterval(() => { const r = Math.max(0, qEnd - Date.now()); $('#timeBar').style.width = (r / m.ms * 100) + '%'; if (!r) clearInterval(qTimer); }, 100);
}
function showReveal(m) {
  clearInterval(qTimer);
  $('#opts').querySelectorAll('button').forEach((b, i) => { b.disabled = true; if (i === m.correct) b.classList.add('right'); else if (i === m.you.choice) b.classList.add('wrong'); });
  $('#meScore').textContent = m.you.correct; $('#opScore').textContent = m.opp.correct;
  $('#meCombo').textContent = m.you.streak > 1 ? `🔥 ${m.you.streak} 連擊` : '';
  $('#opCombo').textContent = m.opp.streak > 1 ? `🔥 ${m.opp.streak} 連擊` : '';
  $('#meMoney').textContent = `目前可得 💰${m.you.money}　✨${m.you.exp} 經驗`;
  $('#opState').textContent = m.opp.choice === null ? '對手未作答' : m.opp.ok ? '對手答對 ✔' : '對手答錯 ✘';
  $('#qEvents').textContent = (m.you.choice === null ? '⏰ 時間到！　' : m.you.ok ? '✅ 答對！　' : '❌ 答錯　') + m.events.join('；');
  if (m.diff) $('#qDiff').textContent = `· 全站答對率 ${m.diff.rate}%（${m.diff.n} 人次）`;
  $('#qReport').classList.remove('hidden');
}
function showEnd(m) {
  clearInterval(qTimer); showQuiz('end');
  const t = { win: '🏆 你贏了！', lose: '😢 這次輸了', draw: '🤝 平手' }[m.result];
  $('#quizEnd').innerHTML = `<div class="big">${t}</div>
    <p>你答對 <b>${m.you.correct}</b> 題，對手 ${esc(m.opp.name)} 答對 <b>${m.opp.correct}</b> 題</p>
    <p>最高連擊 ${m.you.bestStreak}（combo ×${m.you.mul}）　獲得 💰 <b>${m.you.money}</b>${m.you.styleBonus ? `（含風格加成 +${m.you.styleBonus * 100}%）` : ''}　✨ <b>${m.you.exp}</b> 經驗　${m.you.levelUps ? '🎉 升級 ' + m.you.levelUps + ' 級！' : ''}</p>
    <p class="mut">扣除參加費 50 元，淨收益 <b style="color:${m.net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${m.net >= 0 ? '+' : ''}${m.net}</b> 元</p>
    <button class="pri" id="again">再來一場</button> <button id="toHouse">回到房屋</button>`;
  $('#again').onclick = () => showQuiz('lobby');
  $('#toHouse').onclick = () => { view = 'house'; showQuiz('lobby'); renderAll(); };
}

// ───── 排行 / 社交 ─────
const BOARDS = { wins: ['勝場', (r) => r.wins + ' 勝'], combo: ['最高連擊', (r) => r.bestCombo + ' 連'], likes: ['房屋人氣', (r) => '❤️ ' + r.likes], level: ['等級', (r) => 'Lv.' + r.level], active: ['最近活躍', (r) => 'Lv.' + r.level] };
function renderBoard() {
  chips($('#boardTabs'), Object.entries(BOARDS).map(([k, v]) => [k, v[0]]), boardTab, (k) => { boardTab = k; renderBoard(); });
  const rows = board ? board[boardTab] : [];
  $('#boardTbl').innerHTML = '<tr><th>#</th><th>玩家</th><th>房屋</th><th>' + BOARDS[boardTab][0] + `</th><th>按讚（你 +${CFG.likeReward} 元）</th></tr>` +
    (rows.length ? rows.map((r, i) => `<tr class="link" data-pid="${r.pid}"><td>${i + 1}</td><td>${r.gender === 'm' ? '👨' : '👩'} ${esc(r.name)}${r.self ? '（你）' : ''}</td><td>Lv.${r.houseLv}</td><td>${BOARDS[boardTab][1](r)}</td><td>${r.self ? '' : `<button data-like="${r.pid}" ${r.liked ? 'disabled' : ''}>${r.liked ? '❤️ 已讚' : '👍 讚'}</button>`}　❤️ ${r.likes}</td></tr>`).join('') : '<tr><td colspan="5" class="mut">還沒有資料</td></tr>');
  $('#boardTbl').querySelectorAll('tr.link').forEach((tr) => tr.onclick = () => send({ t: 'visit', pid: tr.dataset.pid }));
  $('#boardTbl').querySelectorAll('button[data-like]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); send({ t: 'like', pid: b.dataset.like }); });
}
let visitStage = null;
function renderVisit() {
  const box = $('#visitBox');
  if (!visiting) return box.classList.add('hidden');
  const v = visiting; box.classList.remove('hidden');
  if (!visitStage) { visitStage = new HouseView($('#visit3d'), { interactive: false }); visitStage.setItems(CAT.items); }
  $('#vTitle').textContent = `${v.gender === 'm' ? '👨' : '👩'} ${v.name} 的房子（Lv.${v.houseLv}・${v.cols}×${v.rows} 公尺）`;
  visitStage.setData({ cols: v.cols, rows: v.rows, house: v.house, worn: v.worn, gender: v.gender });
  $('#vStyle').textContent = styleLine(v);
  const like = $('#vLike'); like.textContent = (v.liked ? '❤️ 已按讚 ' : `🤍 按讚（你 +${CFG.likeReward} 元）　`) + v.likes; like.disabled = v.liked || v.pid === P.pid;
  like.onclick = () => send({ t: 'like', pid: v.pid, visit: 1 });
  $('#vClose').onclick = () => { visiting = null; renderVisit(); };
}

connect();
