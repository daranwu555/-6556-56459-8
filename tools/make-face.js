// 產生 Q 版角色的臉部貼圖（public/textures/face_m.png、face_f.png）
// 用瀏覽器的 Canvas 繪製（有抗鋸齒、漸層、貝茲曲線），需要 Playwright：node tools/make-face.js
// 貼圖對應 tools/character.js 的 headGeo()：u＝繞頭一圈的角度（正面 0.5），v＝由頭頂往下
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const W = 2048, H = 1024, R_REF = 0.108, TOP = 0.152, BOT = -0.136;

// 在瀏覽器裡執行的繪圖程式（座標單位：公尺；x＝沿頭表面的弧長，y＝頭部座標高度）
function paint({ W, H, R_REF, TOP, BOT, g }) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const SX = W / (2 * Math.PI * R_REF), SY = H / (TOP - BOT);
  const f = g === 'f';
  // 底色：膚色，下巴與頸部稍暗，臉頰略帶暖色
  x.fillStyle = '#f8d9c2'; x.fillRect(0, 0, W, H);
  const P = (ax, ay) => [W / 2 + ax * SX, (TOP - ay) * SY];
  x.setTransform(SX, 0, 0, -SY, W / 2, TOP * SY);
  const grad = (x0, y0, r, stops) => { const gr = x.createRadialGradient(x0, y0, 0, x0, y0, r); stops.forEach(([o, col]) => gr.addColorStop(o, col)); return gr; };
  const ell = (cx, cy, rx, ry, fill, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); };
  // 下巴陰影、額頭微亮
  { const gr = x.createLinearGradient(0, -0.06, 0, -0.14); gr.addColorStop(0, 'rgba(226,160,130,0)'); gr.addColorStop(1, 'rgba(226,160,130,.35)'); x.fillStyle = gr; x.fillRect(-0.4, -0.14, 0.8, 0.08); }
  ell(0, 0.07, 0.09, 0.05, grad(0, 0.07, 0.09, [[0, 'rgba(255,240,228,.35)'], [1, 'rgba(255,240,228,0)']]));
  // 腮紅：柔和的粉色＋三道斜線（動漫腮紅）
  for (const s of [-1, 1]) {
    x.save(); x.translate(s * 0.074, -0.062); x.scale(1, 0.55); ell(0, 0, 0.026, 0.026, grad(0, 0, 0.026, [[0, f ? 'rgba(245,130,140,.55)' : 'rgba(235,140,130,.32)'], [1, 'rgba(245,130,140,0)']])); x.restore();
    if (f) { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 0.0016; x.lineCap = 'round'; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(s * 0.074 + k * 0.007 - 0.003, -0.068); x.lineTo(s * 0.074 + k * 0.007 + 0.003, -0.056); x.stroke(); } }
  }
  // 眼睛
  const eye = (s) => {
    const cx = s * 0.053, cy = -0.02, ew = f ? 0.026 : 0.026, eh = f ? 0.029 : 0.025;
    const inner = [s * 0.029, cy - 0.006], outer = [s * 0.079, cy + (f ? -0.003 : 0.004)], top = [cx + s * 0.003, cy + eh * 0.95];
    // 眼白（上緣跟著眼線，下緣圓）
    x.save(); x.beginPath(); x.moveTo(...inner); x.bezierCurveTo(inner[0] + s * 0.004, top[1], outer[0] - s * 0.012, top[1] + 0.002, ...outer);
    x.bezierCurveTo(outer[0] + s * 0.001, cy - eh * 0.9, inner[0] + s * 0.006, cy - eh * 1.05, ...inner); x.closePath();
    x.fillStyle = '#fffdf8'; x.fill(); x.clip();
    // 上眼瞼投影
    { const gr = x.createLinearGradient(0, cy + eh, 0, cy + eh * 0.2); gr.addColorStop(0, 'rgba(120,80,90,.35)'); gr.addColorStop(1, 'rgba(120,80,90,0)'); x.fillStyle = gr; x.fillRect(cx - 0.04, cy + eh * 0.3, 0.08, eh); }
    // 虹膜：上深下亮的漸層＋外圈深色描邊
    const ix = cx - s * 0.001, iy = cy - 0.002, irx = f ? 0.0175 : 0.0165, iry = f ? 0.0235 : 0.021;
    const gi = x.createLinearGradient(0, iy + iry, 0, iy - iry); const C = f ? ['#2a1410', '#5a3020', '#b8703c', '#f0b070'] : ['#160d0a', '#3a2216', '#8a5530', '#d09050'];
    gi.addColorStop(0, C[0]); gi.addColorStop(0.35, C[1]); gi.addColorStop(0.75, C[2]); gi.addColorStop(1, C[3]);
    ell(ix, iy, irx, iry, gi); x.lineWidth = 0.0016; x.strokeStyle = C[0]; x.beginPath(); x.ellipse(ix, iy, irx, iry, 0, 0, 7); x.stroke();
    // 虹膜紋理（放射細線）
    x.strokeStyle = 'rgba(255,220,170,.18)'; x.lineWidth = 0.0006; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; x.beginPath(); x.moveTo(ix + Math.cos(a) * irx * 0.45, iy + Math.sin(a) * iry * 0.45); x.lineTo(ix + Math.cos(a) * irx * 0.92, iy + Math.sin(a) * iry * 0.92); x.stroke(); }
    // 瞳孔
    ell(ix, iy + 0.001, irx * 0.42, iry * 0.48, C[0]);
    // 虹膜上方陰影
    { const gr = x.createLinearGradient(0, iy + iry, 0, iy + iry * 0.1); gr.addColorStop(0, 'rgba(10,5,8,.7)'); gr.addColorStop(1, 'rgba(10,5,8,0)'); x.fillStyle = gr; x.beginPath(); x.ellipse(ix, iy, irx, iry, 0, 0, 7); x.fill(); }
    // 高光：左上大、右下小（兩眼光源一致），下緣弧形反光
    ell(ix - 0.0065, iy + 0.0095, 0.0058, 0.0072, '#ffffff', -0.3);
    ell(ix + 0.0068, iy - 0.0095, 0.0026, 0.0026, 'rgba(255,255,255,.95)');
    x.strokeStyle = 'rgba(255,240,220,.65)'; x.lineWidth = 0.0013; x.beginPath(); x.ellipse(ix, iy - 0.002, irx * 0.72, iry * 0.72, 0, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
    x.restore();
    // 上眼線（粗、尾端漸細；女生眼尾微翹＋睫毛，男生眼尾銳利上挑）
    x.fillStyle = '#1c1014'; x.beginPath();
    x.moveTo(inner[0], inner[1] + 0.001);
    x.bezierCurveTo(inner[0] + s * 0.004, top[1] + 0.0035, outer[0] - s * 0.012, top[1] + 0.0055, outer[0] + s * (f ? 0.007 : 0.006), outer[1] + (f ? 0.007 : 0.006));
    x.lineTo(outer[0] + s * (f ? 0.002 : 0.0), outer[1] - 0.0005);
    x.bezierCurveTo(outer[0] - s * 0.012, top[1] - 0.001, inner[0] + s * 0.006, top[1] - 0.003, inner[0], inner[1] - 0.0015); x.closePath(); x.fill();
    if (f) for (const [dx, dy, a] of [[-0.004, 0.0, 0.5], [0.002, -0.002, 0.8]]) { x.beginPath(); x.moveTo(outer[0] + s * dx, outer[1] + 0.004 + dy); x.quadraticCurveTo(outer[0] + s * (dx + 0.007), outer[1] + 0.011 + dy, outer[0] + s * (dx + 0.011), outer[1] + 0.012 + dy * a); x.lineTo(outer[0] + s * (dx + 0.004), outer[1] + 0.006 + dy); x.fill(); }
    // 下眼線（只畫外側一小段）
    x.strokeStyle = 'rgba(70,35,40,.75)'; x.lineWidth = 0.0013; x.beginPath(); x.moveTo(cx + s * 0.004, cy - eh * 0.98); x.quadraticCurveTo(outer[0] - s * 0.004, cy - eh * 0.85, outer[0] - s * 0.001, outer[1] - 0.004); x.stroke();
  };
  eye(-1); eye(1);
  // 眉毛：女＝細彎柳眉；男＝劍眉（外端上揚）
  for (const s of [-1, 1]) {
    x.fillStyle = f ? '#3b2420' : '#1e1416'; x.beginPath();
    if (f) { x.moveTo(s * 0.03, 0.024); x.quadraticCurveTo(s * 0.052, 0.038, s * 0.074, 0.03); x.quadraticCurveTo(s * 0.052, 0.034, s * 0.03, 0.021); }
    else { x.moveTo(s * 0.027, 0.022); x.lineTo(s * 0.03, 0.03); x.quadraticCurveTo(s * 0.055, 0.037, s * 0.081, 0.046); x.quadraticCurveTo(s * 0.056, 0.03, s * 0.027, 0.022); }
    x.closePath(); x.fill();
  }
  // 鼻子：一小筆陰影＋鼻頭高光
  x.strokeStyle = 'rgba(205,130,110,.8)'; x.lineWidth = 0.0018; x.lineCap = 'round'; x.beginPath(); x.moveTo(0.002, -0.05); x.quadraticCurveTo(0.005, -0.058, 0.0, -0.061); x.stroke();
  ell(-0.002, -0.054, 0.002, 0.0015, 'rgba(255,255,255,.6)');
  // 嘴巴
  if (f) { // 微笑、微張
    x.fillStyle = '#9b3b45'; x.beginPath(); x.moveTo(-0.011, -0.083); x.quadraticCurveTo(0, -0.086, 0.011, -0.083); x.quadraticCurveTo(0, -0.097, -0.011, -0.083); x.fill();
    ell(0, -0.0905, 0.005, 0.0025, '#f08a96');
    x.strokeStyle = '#6a2830'; x.lineWidth = 0.0014; x.beginPath(); x.moveTo(-0.014, -0.081); x.quadraticCurveTo(0, -0.086, 0.014, -0.081); x.stroke();
  } else { // 淺淺的自信微笑
    x.strokeStyle = '#6a3430'; x.lineWidth = 0.0019; x.lineCap = 'round'; x.beginPath(); x.moveTo(-0.011, -0.084); x.quadraticCurveTo(0.001, -0.089, 0.012, -0.083); x.stroke();
    x.strokeStyle = 'rgba(106,52,48,.5)'; x.lineWidth = 0.0012; x.beginPath(); x.moveTo(0.012, -0.083); x.lineTo(0.0145, -0.0815); x.stroke();
  }
  return c.toDataURL('image/png');
}

(async () => {
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined });
  const pg = await b.newPage();
  for (const g of ['m', 'f']) {
    const url = await pg.evaluate(paint, { W, H, R_REF, TOP, BOT, g });
    const out = path.join(__dirname, '..', 'public', 'textures', `face_${g}.png`);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('寫入', out);
  }
  await b.close();
})();
