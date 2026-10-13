// 精細角色：身體（旋轉體曲面）、臉部五官、手指、武俠風髮型與初始服裝
const { Model, box, cyl, sphere, torus, lathe } = require('./glb');
const PI = Math.PI;
const matte = { m: 0, r: 0.9 }, skinM = { m: 0, r: 0.62 }, silk = { m: 0.25, r: 0.4 }, shiny = { m: 0.5, r: 0.3 };

// 小工具
const LA = (m, c, prof, t = {}, o = matte, seg = 24) => m.add(lathe(prof, seg), m.mat(c, o), t);
// 有褶子的旋轉體（裙襬、衣襬）：越往下褶越深
function pleat(prof, n = 14, amp = 0.05, seg = 84) {
  const g = lathe(prof, seg), ys = prof.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], z = g.pos[i + 2], k = 1 - (g.pos[i + 1] - y0) / (y1 - y0 || 1), th = Math.atan2(z, x), w = 1 + amp * k * k * Math.sin(th * n); g.pos[i] *= w; g.pos[i + 2] *= w; }
  const { smoothNormals } = require('./glb'); g.nor = smoothNormals(g.pos, g.idx); return g;
}
const SP = (m, c, rx, ry, rz, x, y, z, o = matte, rot) => m.add(sphere(1, 20, 14), m.mat(c, o), { p: [x, y, z], s: [rx, ry, rz], r: rot });
const BX = (m, c, w, h, d, x, y, z, rot, o = matte) => m.add(box(w, h, d), m.mat(c, o), { p: [x, y, z], r: rot }); // 中心座標
const CY = (m, c, rt, rb, h, x, y, z, rot, o = matte, seg = 14) => m.add(cyl(rt, rb, h, seg), m.mat(c, o), { p: [x, y, z], r: rot }); // 中心座標
const TO = (m, c, R, r, x, y, z, rot, s, o = matte) => m.add(torus(R, r, 36, 10), m.mat(c, o), { p: [x, y, z], r: rot, s });


// ── 平滑曲線工具 ──
const catmull = (pts, n = 6) => { // 通過所有控制點的平滑曲線
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push(p1.map((_, a) => 0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))); }
  }
  out.push(pts[pts.length - 1]); return out;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const { smoothNormals } = require('./glb');
// 頭：旋轉體＋UV（u＝繞頭一圈的角度，正面在 0.5；v＝由上往下），前端會貼上臉部貼圖
const HEAD_TOP = 0.152, HEAD_BOT = -0.136;
function headGeo(profile, seg = 64) {
  const prof = catmull(profile, 5), pos = [], uv = [], idx = [], cols = seg + 1;
  for (let j = 0; j < prof.length; j++) for (let i = 0; i <= seg; i++) {
    const a = -Math.PI + (i / seg) * Math.PI * 2, [r, y] = prof[j];
    pos.push(r * Math.sin(a), y, r * Math.cos(a)); uv.push(i / seg, (HEAD_TOP - y) / (HEAD_TOP - HEAD_BOT));
  }
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, d, a, d, c); }
  return { pos, nor: smoothNormals(pos, idx), idx, uv };
}
// 髮束：沿著曲線的扁平錐形管（寬 w、厚 t，從根部漸細到尖端）；side 決定扁平方向
function strand(ctrl, { w = 0.03, t = 0.012, tip = 0.08, side = [1, 0, 0], ring = 8, n = 6, twist = 0 } = {}) {
  const P = catmull(ctrl, n), pos = [], idx = [], L = P.length;
  for (let k = 0; k < L; k++) {
    const T = nrm(sub(P[Math.min(L - 1, k + 1)], P[Math.max(0, k - 1)])); let B = nrm(crs(T, crs(side, T))); if (!isFinite(B[0])) B = [1, 0, 0];
    const N = nrm(crs(T, B)), f = k / (L - 1), taper = f < 0.12 ? 0.75 + 0.25 * (f / 0.12) : Math.max(tip, Math.pow(1 - (f - 0.12) / 0.88, 0.8)), ww = w * taper, tt = t * taper, tw = twist * f;
    for (let i = 0; i < ring; i++) { const a = (i / ring) * Math.PI * 2 + tw, cx = Math.cos(a) * ww, cy = Math.sin(a) * tt; pos.push(P[k][0] + B[0] * cx + N[0] * cy, P[k][1] + B[1] * cx + N[1] * cy, P[k][2] + B[2] * cx + N[2] * cy); }
  }
  for (let k = 0; k < L - 1; k++) for (let i = 0; i < ring; i++) { const a = k * ring + i, b = k * ring + ((i + 1) % ring), c = a + ring, d = b + ring; idx.push(a, c, b, b, c, d); }
  const c0 = pos.length / 3; pos.push(...P[0]); for (let i = 0; i < ring; i++) idx.push(c0, (i + 1) % ring, i);
  const c1 = pos.length / 3; pos.push(...P[L - 1]); for (let i = 0; i < ring; i++) idx.push(c1, (L - 1) * ring + i, (L - 1) * ring + ((i + 1) % ring));
  return { pos, nor: smoothNormals(pos, idx), idx };
}
// 髮蓋：貼著頭殼外側的一層頭髮；front＝前額髮際線高度、back＝後頸髮際線高度、side＝耳上高度（皆為頭部座標 y）
function hairCap(R, { front = 0.06, side = 0.0, back = -0.11, puff = 1.0, seg = 64, rows = 30, gap = 0.009 } = {}) {
  // 跟著真正的頭型（HEAD_PROF）往外推一層，不會陷進頭裡
  const top = HEAD_TOP + gap + 0.006 * puff, pos = [], idx = [], cols = seg + 1;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) {
    const a = -Math.PI + (i / seg) * Math.PI * 2, c = Math.cos(a), fr = Math.max(0, c), bk = Math.max(0, -c);
    const lim = side + (front - side) * Math.pow(fr, 1.6) + (back - side) * Math.pow(bk, 1.2);
    const k = j / rows, y = top - (top - lim) * (1 - Math.pow(1 - k, 1.6)); // 頭頂附近排得密一點
    const base = Math.min(HEAD_TOP, y), rr = j === 0 ? 0 : Math.max(headR(base), 0.02) * (R.x / 0.11) + gap * (1 + 0.6 * puff * Math.sin(k * Math.PI));
    pos.push(rr * Math.sin(a), y, rr * c * (R.z / R.x));
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, d, a, d, c); }
  return { pos, nor: smoothNormals(pos, idx), idx };
}

const SKIN = '#f8d9c2', SKIN_SHADE = '#ebbfa8';
// 頭部輪廓（半徑, y），由下巴到頭頂；headR(y) 取得某高度的頭半徑，surf() 取得頭表面外一點
const HEAD_PROF = [[0.0, HEAD_BOT], [0.03, -0.133], [0.058, -0.121], [0.08, -0.098], [0.096, -0.066], [0.105, -0.028], [0.109, 0.012], [0.11, 0.05], [0.104, 0.09], [0.087, 0.123], [0.056, 0.145], [0.0, HEAD_TOP]];
let PROF8 = null;
function headR(y) { PROF8 = PROF8 || catmull(HEAD_PROF, 8); if (y >= HEAD_TOP) return 0; for (let k = 0; k < PROF8.length - 1; k++) { const [r0, y0] = PROF8[k], [r1, y1] = PROF8[k + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0 || 1)); } return 0; }
const surf = (a, y, off = 0.012, sz = 1.02) => { const r = Math.max(headR(Math.min(y, HEAD_TOP - 0.002)), 0.03) + off; return [r * Math.sin(a), y, r * Math.cos(a) * sz]; };
const tang = (a) => [Math.cos(a), 0, -Math.sin(a)];
const mirror = (f) => { f(1); f(-1); };

// ═════════ 身體 ═════════
function body(g) {
  const f = g === 'f', m = new Model();
  const lip = f ? '#c2505e' : '#b4605a';
  // 軀幹（寬度 x，前後以 z 縮放）
  const torsoProf = f ? [[0.155, 0.85], [0.15, 0.9], [0.118, 1.0], [0.12, 1.1], [0.138, 1.2], [0.148, 1.32], [0.146, 1.385], [0.09, 1.405], [0.04, 1.412]] : [[0.148, 0.85], [0.143, 0.9], [0.133, 1.0], [0.14, 1.1], [0.158, 1.22], [0.17, 1.33], [0.164, 1.385], [0.1, 1.405], [0.045, 1.412]];
  LA(m, SKIN, torsoProf, { s: [1, 1, f ? 0.58 : 0.62] }, skinM, 28);
  if (f) mirror((s) => SP(m, SKIN, 0.05, 0.048, 0.036, s * 0.05, 1.27, 0.05, skinM));
  // 內著（貼身，剛好在一般衣服裡面）
  LA(m, f ? '#f1ece2' : '#e9e5da', [[0.158, 0.84], [0.158, 0.9], [0.14, 0.97]], { s: [1, 1, 0.64] }, matte, 24);
  if (f) LA(m, '#f1ece2', [[0.15, 1.2], [0.154, 1.26], [0.154, 1.31], [0.13, 1.35]], { s: [1, 1, 0.62] }, matte, 24);
  // 頸、喉結
  LA(m, SKIN, [[f ? 0.036 : 0.04, 1.4], [f ? 0.032 : 0.036, 1.46], [f ? 0.032 : 0.036, 1.5]], {}, skinM, 18);
  // 肩、手臂、手
  const sw = f ? 0.188 : 0.205;
  mirror((s) => {
    SP(m, SKIN, 0.055, 0.055, 0.05, s * sw, 1.395, 0, skinM);
    LA(m, SKIN, [[0.026, -0.29], [0.034, -0.2], [0.04, -0.1], [0.046, -0.04], [0.05, 0.0]], { p: [s * (sw + 0.012), 1.4, 0], r: [0, 0, s * 0.06] }, skinM, 16); // 上臂（由下往上）
    SP(m, SKIN, 0.034, 0.034, 0.034, s * (sw + 0.03), 1.11, 0, skinM);
    LA(m, SKIN, [[0.021, -0.25], [0.027, -0.2], [0.036, -0.08], [0.041, 0.0]], { p: [s * (sw + 0.034), 1.11, 0], r: [0, 0, s * 0.045] }, skinM, 16); // 前臂
    // 手：Q 版圓潤小手（手掌＋併攏的四指＋拇指）
    const hx = s * (sw + 0.062), hy = 0.87;
    SP(m, SKIN, f ? 0.03 : 0.034, 0.036, 0.018, hx, hy, 0.0, skinM, [0, 0, s * 0.05]);
    SP(m, SKIN, f ? 0.027 : 0.03, 0.03, 0.016, hx, hy - 0.04, 0.006, skinM, [0.2, 0, s * 0.05]);
    SP(m, SKIN, 0.012, 0.022, 0.011, hx - s * 0.03, hy - 0.012, 0.014, skinM, [0.3, 0, s * 0.6]);
  });
  // 腿：大腿、膝、小腿、足踝、腳
  mirror((s) => {
    const x = s * 0.092;
    LA(m, SKIN, [[0.056, -0.39], [0.066, -0.28], [0.075, -0.12], [0.08, 0.0]], { p: [x, 0.88, 0] }, skinM, 18);
    SP(m, SKIN, 0.058, 0.05, 0.056, x, 0.49, 0.004, skinM);
    LA(m, SKIN, [[0.03, -0.37], [0.037, -0.3], [0.05, -0.1], [0.056, 0.0]], { p: [x, 0.49, 0] }, skinM, 18);
    SP(m, SKIN, 0.036, 0.032, 0.038, x, 0.12, 0.0, skinM);
    BX(m, SKIN, 0.07, 0.042, 0.15, x, 0.052, 0.045, 0, skinM); SP(m, SKIN, 0.036, 0.024, 0.04, x, 0.045, 0.12, skinM);
    for (let i = 0; i < 5; i++) SP(m, SKIN_SHADE, 0.009, 0.008, 0.011, x + (i - 2) * 0.014 * s * -1, 0.028, 0.152 - Math.abs(i - 2) * 0.004, skinM);
  });
  // 內褲
  LA(m, '#586080', [[0.152, 0.84], [0.16, 0.88], [0.15, 0.95]], { s: [1, 1, 0.6] }, matte, 24);
  // ── 頭：圓潤的 Q 版頭型（額頭飽滿、臉頰柔和、下巴小巧）；五官畫在貼圖上（textures/face_m|f.png），不會凸出臉外 ──
  LA(m, SKIN, [[0.0, 1.47], [0.035, 1.452]], {}, skinM, 18); // 下巴下方與頸部銜接
  m.add(headGeo(HEAD_PROF), m.mat(SKIN, { ...skinM, name: 'FACE:' + g }), { p: [0, 1.58, 0], s: [f ? 0.97 : 1.0, 1, 1.02] });
  // 耳朵：小巧、貼著頭側，耳廓有一點內凹的陰影
  mirror((s) => { SP(m, SKIN, 0.011, 0.024, 0.017, s * (f ? 0.1045 : 0.108), 1.566, -0.006, skinM, [0, 0, s * -0.12]); SP(m, SKIN_SHADE, 0.006, 0.015, 0.01, s * (f ? 0.1095 : 0.113), 1.566, -0.002, skinM, [0, 0, s * -0.12]); });
  return m;
}

// ═════════ 髮型（古代武俠：束髮、髮髻、髮簪）═════════
const HAIR = { m: '#221d26', f: '#261b20' };
const HM = { m: 0.12, r: 0.36 };
function hairSheet() {
  const FY = (ly) => YN * K + ly * H - (YN - 1.58) * H, cols = 72, rows = 60, pos = [], idx = [], A0 = Math.PI - 1.25, A1 = Math.PI + 1.25;
  for (let i = 0; i <= cols; i++) {
    const a = A0 + (A1 - A0) * (i / cols), tipLen = 0.42 + 0.045 * Math.abs(Math.sin((i / cols) * Math.PI * 9)) - 0.06 * Math.pow(Math.abs(i / cols - 0.5) * 2, 2);
    for (let j = 0; j <= rows; j++) {
      const k = j / rows, fy = FY(0.135) + (tipLen - FY(0.135)) * k, ly = (fy - FY(0)) / H;          // 最終高度 → 頭部座標高度
      const rHead = (headR(Math.max(HEAD_BOT + 0.005, Math.min(ly, HEAD_TOP - 0.004))) + 0.016) * H, rBody = 0.21 + 0.03 * k;
      const b = sm(clamp01((-0.06 - ly) / 0.16)), r = (rHead * (1 - b) + rBody * b) * (1 + 0.025 * Math.sin(a * 16)), zc = -0.02 * b;
      pos.push(r * Math.sin(a), fy, r * Math.cos(a) * (1 - 0.15 * b) + zc);
    }
  }
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + rows + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  return { pos, nor: smoothNormals(pos, idx), idx };
}
function hairBase(g) {
  const f = g === 'f', m = new Model(), c = HAIR[g], M = m.mat(c, HM), H0 = [0, 1.58, 0];
  const add = (geo) => m.add(geo, M, { p: H0 });
  const st = (pts, o) => add(strand(pts, o));
  // 瀏海一束：沿著頭表面從頭頂往下長，尖端落在 tipY；a0→a1 是左右偏移（撥向一側）
  const bang = (a0, a1, tipY, w, off = 0.012, rootY = 0.15) => st([surf(a0, rootY, off * 0.6), surf(a0 + (a1 - a0) * 0.3, 0.12, off), surf(a0 + (a1 - a0) * 0.7, 0.08, off + 0.004), surf(a1, tipY, off + 0.006)], { w, t: 0.0095, tip: 0.05, side: tang((a0 + a1) / 2), ring: 10 });
  // 髮蓋（貼著頭型的一層頭髮）
  add(hairCap({ x: 0.112, y: 0.166, z: 0.117 }, { front: 0.09, side: -0.02, back: -0.122, puff: 1 }));
  if (f) {
    // 中分＋八字瀏海：越靠外越長，像簾子一樣往兩側撥
    mirror((s) => { for (let i = 0; i < 6; i++) { const a0 = s * (0.06 + i * 0.15), tip = 0.058 - i * 0.012; bang(a0, a0 + s * (0.1 + i * 0.03), tip, 0.036 + i * 0.002); } });
    for (const a of [-0.1, 0.1]) bang(a, a * 1.4, 0.07, 0.022, 0.014, 0.135);   // 額前空氣瀏海
    // 兩側垂到胸前的長鬢髮
    mirror((s) => { const A = s * 1.05; st([surf(A, 0.07, 0.012), surf(A + s * 0.15, 0.0, 0.016), surf(A + s * 0.2, -0.08, 0.02), [s * 0.115, -0.17, 0.05], [s * 0.11, -0.28, 0.06]], { w: 0.026, t: 0.011, tip: 0.12, side: tang(A + s * 0.15), twist: 0.4, ring: 10 }); });
    // 背後及腰長髮：一整片順著頭型垂下的髮簾（直接用 Q 版後的最終座標建立），髮尾分成一束束尖端
    m.add(hairSheet(), M, { raw: true });
  } else {
    // 側分瀏海：整排往右撥，尖端落在眉毛上方，中間兩束最長
    for (let i = 0; i < 8; i++) { const a0 = -0.95 + i * 0.26, tip = 0.04 - Math.max(0, 1.2 - Math.abs(a0 - 0.05)) * 0.018; bang(a0, a0 + 0.16, tip, 0.04); }
    // 兩縷劍客鬢髮：從太陽穴垂到下巴外側
    mirror((s) => { const A = s * 1.0; st([surf(A, 0.08, 0.012), surf(A + s * 0.12, 0.0, 0.016), surf(A + s * 0.1, -0.09, 0.02), surf(A + s * 0.05, -0.16, 0.03)], { w: 0.02, t: 0.009, tip: 0.08, side: tang(A), twist: 0.5, ring: 10 }); });
    // 後頸髮尾
    for (let i = 0; i < 7; i++) { const A = Math.PI + (i - 3) * 0.3; st([surf(A, 0.06, 0.012), surf(A, -0.06, 0.016), surf(A, -0.13, 0.022)], { w: 0.04, t: 0.011, tip: 0.2, side: tang(A), ring: 10 }); }
    // 高馬尾：從頭頂髮髻往後甩，再垂到背後（三股有層次）
    for (const [dx, len, w] of [[0, 1, 0.032], [-0.02, 0.85, 0.024], [0.02, 0.8, 0.024]]) st([[dx * 0.3, 0.172, -0.05], [dx, 0.165, -0.13], [dx * 1.2, 0.09, -0.175], [dx * 1.4, -0.08 * len, -0.18], [dx * 1.5, -0.32 * len, -0.165], [dx * 1.2, -0.55 * len, -0.15]], { w, t: 0.02, tip: 0.1, side: [1, 0, 0], twist: 0.35, ring: 10 });
    TO(m, '#2c4a5a', 0.026, 0.007, 0, 1.58 + 0.162, -0.1, [0.9 + PI / 2, 0, 0], [1, 1, 1], silk);      // 束髮帶
  }
  return m;
}
function hairTop(g) { // 髮髻、髮冠、髮簪、步搖（戴頭飾時隱藏）
  const f = g === 'f', m = new Model(), c = HAIR[g];
  if (f) {
    SP(m, c, 0.05, 0.05, 0.045, 0.075, 1.745, -0.015, HM); SP(m, c, 0.034, 0.034, 0.03, 0.05, 1.8, -0.015, HM);   // 墮馬髻
    TO(m, '#b9323f', 0.04, 0.006, 0.075, 1.705, -0.015, [PI / 2, 0, 0.3], [1, 1, 1], silk);
    // 金色髮簪＋步搖（三串珍珠）
    CY(m, '#e0b84a', 0.0045, 0.0045, 0.17, 0.0, 1.75, -0.018, [0, 0, PI / 2 - 0.25], { m: 0.7, r: 0.25 }, 8);
    for (let i = 0; i < 3; i++) { CY(m, '#e0b84a', 0.0018, 0.0018, 0.06 + i * 0.012, -0.075 + i * 0.012, 1.7, 0.03 - i * 0.003, 0, { m: 0.7, r: 0.25 }, 6); SP(m, '#f6f1e6', 0.0085, 0.0085, 0.0085, -0.075 + i * 0.012, 1.665 - i * 0.006, 0.03 - i * 0.003, { m: 0.1, r: 0.2 }); }
    // 紅色牡丹
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; SP(m, i % 2 ? '#c0392b' : '#e0584a', 0.017, 0.017, 0.008, 0.115 + Math.cos(a) * 0.02, 1.74 + Math.sin(a) * 0.02, 0.03, matte, [0, 0.3, a]); }
    SP(m, '#f0c24a', 0.009, 0.009, 0.008, 0.115, 1.74, 0.034, matte);
  } else {
    SP(m, c, 0.04, 0.055, 0.04, 0, 1.775, -0.012, HM);                                                  // 高髮髻
    CY(m, '#c8ccd2', 0.034, 0.04, 0.03, 0, 1.728, -0.012, 0, { m: 0.75, r: 0.25 }, 14);                   // 銀色髮冠底座
    BX(m, '#c8ccd2', 0.012, 0.045, 0.012, 0, 1.78, 0.03, 0, { m: 0.75, r: 0.25 });                        // 冠前飾片
    CY(m, '#d7dde3', 0.005, 0.005, 0.18, 0, 1.775, -0.012, [0, 0, PI / 2], { m: 0.75, r: 0.2 }, 8);        // 髮簪（橫穿）
    SP(m, '#8fd6bd', 0.01, 0.01, 0.01, 0.09, 1.775, -0.012, { m: 0.2, r: 0.2 }); SP(m, '#8fd6bd', 0.01, 0.01, 0.01, -0.09, 1.775, -0.012, { m: 0.2, r: 0.2 });
  }
  return m;
}

// ═════════ 初始服裝（古代武俠）═════════
const GOLD = '#d9a93b', gold = { m: 0.6, r: 0.3 }, silver = { m: 0.75, r: 0.25 };
function robeM() { // 青衫劍客：交領右衽長衫、黑腰封、玉佩、護腕、背劍
  const m = new Model(), S = [1, 1, 0.7], R = '#2d4a5b', R2 = '#25404f', CREAM = '#e8dfc8', DARK = '#1f2024';
  // 上身（領口收在頸根，不會被 Q 版變形放大）
  LA(m, R, [[0.07, 1.418], [0.15, 1.405], [0.19, 1.385], [0.188, 1.3], [0.168, 1.05], [0.172, 0.92]], { s: S }, silk, 40);
  m.add(pleat([[0.172, 0.92], [0.2, 0.72], [0.228, 0.52], [0.25, 0.37]], 16, 0.045), m.mat(R, silk), { s: S }); // 下襬（有褶）
  TO(m, CREAM, 0.198, 0.011, 0, 0.375, 0, 0, [1.27, 1, 0.7 * 1.27], silk);                     // 下襬滾邊
  LA(m, CREAM, [[0.07, 1.398], [0.054, 1.418], [0.05, 1.44], [0.047, 1.446]], {}, silk, 28);  // 立領（包住脖子）
  mirror((s) => BX(m, CREAM, 0.034, 0.42, 0.01, s * 0.045, 1.2, 0.132, [0, 0, s * -0.4], silk)); // 交領
  LA(m, DARK, [[0.17, 0.9], [0.176, 0.96], [0.172, 1.04]], { s: S }, matte, 32);               // 黑色腰封
  BX(m, '#c8ccd2', 0.05, 0.05, 0.014, 0, 0.97, 0.128, 0, silver);                              // 銀扣
  TO(m, '#8fd6bd', 0.02, 0.008, 0.11, 0.84, 0.13, [PI / 2, 0, 0], [1, 1, 1], { m: 0.2, r: 0.2 }); CY(m, '#b9323f', 0.004, 0.004, 0.1, 0.11, 0.76, 0.13, 0, silk, 6); SP(m, '#b9323f', 0.012, 0.016, 0.012, 0.11, 0.7, 0.13, silk);
  mirror((s) => {
    SP(m, R, 0.066, 0.06, 0.06, s * 0.2, 1.38, 0, silk);                                          // 肩
    LA(m, R2, [[0.07, -0.3], [0.066, -0.2], [0.062, -0.08], [0.06, 0.0]], { p: [s * 0.215, 1.39, 0], r: [0, 0, s * 0.065] }, silk, 20); // 袖子沿著手臂
    LA(m, '#3a2a20', [[0.05, -0.16], [0.056, -0.1], [0.058, -0.02], [0.062, 0.0]], { p: [s * 0.24, 1.09, 0], r: [0, 0, s * 0.045] }, matte, 18); // 皮護腕
    TO(m, '#c8ccd2', 0.058, 0.005, s * 0.243, 1.06, 0, [0, 0, s * 0.045], [1, 1, 1], silver); TO(m, '#c8ccd2', 0.053, 0.005, s * 0.25, 0.95, 0, [0, 0, s * 0.045], [1, 1, 1], silver);
    LA(m, '#3a3a45', [[0.074, 0.12], [0.085, 0.25], [0.09, 0.4]], { p: [s * 0.092, 0, 0] }, matte, 18);   // 褲管
  });
  // 背後長劍：劍鞘斜背、護手、劍柄與紅穗
  BX(m, '#2a1d18', 0.05, 0.84, 0.032, -0.02, 0.98, -0.15, [0, 0, 0.42], { m: 0.2, r: 0.55 });
  BX(m, '#c8ccd2', 0.07, 0.014, 0.05, 0.168, 1.39, -0.15, [0, 0, 0.42], silver); CY(m, '#1d1d22', 0.012, 0.012, 0.07, 0.186, 1.425, -0.15, [0, 0, 0.42], matte, 8);
  CY(m, '#b9323f', 0.003, 0.003, 0.08, 0.2, 1.38, -0.15, 0, silk, 6); SP(m, '#b9323f', 0.01, 0.014, 0.01, 0.2, 1.33, -0.15, silk);
  BX(m, '#c8ccd2', 0.05, 0.03, 0.036, -0.17, 0.62, -0.15, [0, 0, 0.42], silver);
  return m;
}
function robeF() { // 白衣俠女：交領短襦、青碧高腰長裙（有褶）、紅絲絛、垂袖、披帛、玉佩
  const m = new Model(), W = '#f7f4ec', TEAL = '#6fb3a5', SK = '#8cc5b4', ROSE = '#eaa9b8';
  LA(m, W, [[0.06, 1.418], [0.13, 1.405], [0.158, 1.385], [0.153, 1.3], [0.128, 1.2]], { s: [1, 1, 0.62] }, silk, 40);
  mirror((s) => BX(m, TEAL, 0.03, 0.24, 0.008, s * 0.032, 1.3, 0.098, [0, 0, s * -0.42], silk));
  LA(m, W, [[0.062, 1.398], [0.048, 1.418], [0.044, 1.436], [0.042, 1.442]], {}, silk, 28); TO(m, TEAL, 0.043, 0.004, 0, 1.44, 0, 0, [1, 1, 1], silk);
  LA(m, '#c0485a', [[0.128, 1.12], [0.134, 1.17], [0.13, 1.22]], { s: [1, 1, 0.62] }, silk, 32);   // 紅絲絛腰帶
  SP(m, '#c0485a', 0.03, 0.022, 0.014, 0, 1.17, 0.088, silk); BX(m, '#c0485a', 0.012, 0.22, 0.006, -0.02, 1.0, 0.09, [0, 0, 0.08], silk); BX(m, '#c0485a', 0.012, 0.26, 0.006, 0.025, 0.98, 0.09, [0, 0, -0.06], silk);
  m.add(pleat([[0.13, 1.17], [0.152, 1.0], [0.2, 0.76], [0.262, 0.46], [0.318, 0.22], [0.345, 0.1]], 22, 0.06), m.mat(SK, silk), { s: [1, 1, 0.82] }); // 長裙（百褶）
  m.add(pleat([[0.262, 0.46], [0.322, 0.2], [0.352, 0.07]], 22, 0.06), m.mat('#e9f3ee', silk), { s: [1.01, 1, 0.83] });
  TO(m, TEAL, 0.35, 0.009, 0, 0.075, 0, 0, [1, 1, 0.82], silk);
  mirror((s) => {
    SP(m, W, 0.06, 0.055, 0.056, s * 0.188, 1.385, 0, silk);
    // 垂袖：上臂合身，到手肘後慢慢放寬，袖口下垂成弧形
    LA(m, W, [[0.1, -0.44], [0.095, -0.36], [0.075, -0.2], [0.062, 0.0]], { p: [s * 0.22, 1.39, 0], r: [0, 0, s * 0.08], s: [1, 1, 0.78] }, silk, 28);
    SP(m, W, 0.075, 0.08, 0.04, s * 0.27, 0.93, -0.01, silk);                                       // 袖襬下垂
    TO(m, TEAL, 0.098, 0.008, s * 0.255, 0.955, 0, [0, 0, s * 0.08], [1, 1, 0.78], silk);
    BX(m, ROSE, 0.04, 0.6, 0.01, s * 0.205, 0.95, -0.05, [0.05, 0, s * 0.03], silk);                // 披帛垂帶
    SP(m, ROSE, 0.055, 0.025, 0.055, s * 0.19, 1.4, 0, silk);
  });
  TO(m, '#8fd6bd', 0.02, 0.008, 0.13, 0.84, 0.1, [PI / 2, 0, 0], [1, 1, 1], { m: 0.2, r: 0.2 }); CY(m, '#c0485a', 0.004, 0.004, 0.14, 0.13, 0.72, 0.1, 0, silk, 6);   // 玉佩
  return m;
}
function bootsM() { // 黑布靴＋白底（圓頭）
  const m = new Model();
  mirror((s) => { const x = s * 0.092;
    LA(m, '#1e1e24', [[0.058, 0.05], [0.062, 0.16], [0.07, 0.26], [0.076, 0.29]], { p: [x, 0, 0] }, matte, 20);
    TO(m, '#8a8f98', 0.074, 0.009, x, 0.285, 0, 0, [1, 1, 1], matte);
    SP(m, '#1e1e24', 0.055, 0.05, 0.11, x, 0.055, 0.05, matte); SP(m, '#1e1e24', 0.05, 0.045, 0.05, x, 0.06, 0.12, matte);
    SP(m, '#ebe6d6', 0.058, 0.016, 0.13, x, 0.014, 0.06, matte); });
  return m;
}
function shoesF() { // 繡花布鞋（翹頭履）：米白底、青碧鞋頭
  const m = new Model();
  mirror((s) => { const x = s * 0.092;
    SP(m, '#f3eee0', 0.05, 0.045, 0.1, x, 0.06, 0.05, silk); CY(m, '#f3eee0', 0.04, 0.044, 0.07, x, 0.12, 0.0, 0, silk, 16);
    SP(m, '#6fb3a5', 0.03, 0.03, 0.035, x, 0.08, 0.135, silk); CY(m, '#6fb3a5', 0.0, 0.02, 0.05, x, 0.11, 0.165, [-0.9, 0, 0], silk, 12); // 上翹鞋尖
    TO(m, '#c0485a', 0.042, 0.006, x, 0.148, 0.0, 0, [1, 1, 1], silk);
    SP(m, '#e6dfcc', 0.054, 0.014, 0.12, x, 0.012, 0.055, matte); });
  return m;
}

// ═════════ Q 版變形（整體套用到身體、髮型、所有服飾，使服裝都能貼合）═════════
// 頸部以下縮短變寬、頭部放大，形成大頭小身體的 Q 版比例（頭約占身高 40%）
const YN = 1.4, K = 0.52, H = 2.15, SB = 1.12, BLEND = 0.08;
const sm = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function chibi(x, y, z) {
  if (y <= YN) return { p: [x * SB, y * K, z * SB], s: [SB, K, SB] };
  // 頸部以上才放大；離軸心較遠、位置偏低的點（肩膀、手臂）維持身體比例，避免肩甲被拉成翅膀
  const r = Math.hypot(x, z), wr = 1 - sm(clamp01((r - 0.12) / 0.06)), wy = sm(clamp01((y - 1.46) / 0.1)), w = Math.max(wr, wy);
  const sh = SB + (H - SB) * sm(clamp01((y - YN) / BLEND)) * w, sv = K + (H - K) * w;
  return { p: [x * sh, YN * K + (y - YN) * sv, z * sh], s: [sh, sv, sh] };
}

// 頭髮用的變形：頸部以上整體跟著頭放大；頸部以下的長髮逐漸收回身體比例，但保持披在肩背上的寬度
function chibiHair(x, y, z) {
  if (y >= YN) { const sh = H; return { p: [x * sh, YN * K + (y - YN) * H, z * sh], s: [sh, H, sh] }; }
  const t = sm(clamp01((YN - y) / 0.14)), sx = H + (1.45 - H) * t, sz = H + (1.25 - H) * t;
  return { p: [x * sx, y * K, z * sz], s: [sx, K, sz] };
}

module.exports = { body, hairBase, hairTop, robeM, robeF, bootsM, shoesF, chibi, chibiHair };
