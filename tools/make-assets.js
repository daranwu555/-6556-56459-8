// 產生所有 3D 模型（.glb）與牆壁/地毯材質（.png）→ public/models、public/textures
// 執行：node tools/make-assets.js
const path = require('path');
const { Model, box, cyl, sphere, torus, png, hexRgb } = require('./glb');
const CH = require('./character');
const CITY = require('./buildings');
const OUT = path.join(__dirname, '..', 'public');
const PI = Math.PI;

// ── 配色（三種風格）──
const PAL = {
  cool: { main: '#2f3542', alt: '#596378', acc: '#00e5ff', metal: '#a3adbf', dark: '#14161d', wood: '#3a3330', light: '#d9dee8' },
  cute: { main: '#ffb3d1', alt: '#fff0f6', acc: '#ff6fa5', metal: '#f3dbe5', dark: '#a85a7c', wood: '#f4d9b8', light: '#ffffff' },
  fun: { main: '#ffcf3d', alt: '#4da6ff', acc: '#ff5a5f', metal: '#6bd36b', dark: '#7a4cff', wood: '#e89a3c', light: '#fff6c9' },
};
const RAINBOW = ['#ff4d4d', '#ff9f43', '#ffd93d', '#4cd137', '#4da6ff', '#a55eea'];
const SKIN = '#f2c9a0';

// ── 簡寫：bx 盒子(底部y) / cy 圓柱(底部y) / sp 橢球(中心) / to 圓環 ──
const bx = (m, c, w, h, d, x, y, z, r, o) => m.add(box(w, h, d), m.mat(c, o), { p: [x, y + h / 2, z], r });
const cy = (m, c, rt, rb, h, x, y, z, r, o, seg = 18) => m.add(cyl(rt, rb, h, seg), m.mat(c, o), { p: [x, y + h / 2, z], r });
const sp = (m, c, rx, ry, rz, x, y, z, o) => m.add(sphere(1, 18, 12), m.mat(c, o), { p: [x, y, z], s: [rx, ry, rz] });
const to = (m, c, R, r, x, y, z, rot, s, o) => m.add(torus(R, r), m.mat(c, o), { p: [x, y, z], r: rot, s });
const glow = (c) => ({ e: c, r: 0.4 });
const shiny = { m: 0.6, r: 0.3 };
const matte = { m: 0, r: 0.95 };

// ═════════ 家具 ═════════
const F = {};
function legs4(m, c, w, d, h, r, x0 = 0, z0 = 0, o) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(m, c, r, r, h, x0 + sx * w / 2, 0, z0 + sz * d / 2, 0, o, 10); }

// 桌椅：0 = 椅子類  1 = 沙發
F.table_cool_0 = (m, p) => { cy(m, p.alt, 0.24, 0.24, 0.06, 0, 0.72, 0, 0, shiny); cy(m, p.dark, 0.2, 0.2, 0.03, 0, 0.69, 0, 0); for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; cy(m, p.metal, 0.018, 0.018, 0.72, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18, 0, shiny, 8); } to(m, p.metal, 0.17, 0.012, 0, 0.3, 0, 0, [1, 1, 1], shiny); to(m, p.acc, 0.245, 0.01, 0, 0.72, 0, 0, [1, 1, 1], glow(p.acc)); };
F.table_cute_0 = (m, p) => { bx(m, p.wood, 0.46, 0.06, 0.46, 0, 0.42, 0); legs4(m, p.wood, 0.4, 0.4, 0.42, 0.03); bx(m, p.wood, 0.46, 0.4, 0.05, 0, 0.48, -0.21); bx(m, p.main, 0.38, 0.05, 0.38, 0, 0.48, 0); sp(m, p.acc, 0.035, 0.035, 0.015, -0.12, 0.72, -0.18); sp(m, p.acc, 0.035, 0.035, 0.015, 0.12, 0.72, -0.18); };
F.table_fun_0 = (m, p) => { sp(m, p.main, 0.4, 0.3, 0.4, 0, 0.28, 0); sp(m, p.alt, 0.26, 0.22, 0.26, 0, 0.46, 0.04); sp(m, p.acc, 0.14, 0.1, 0.14, -0.1, 0.62, -0.1); to(m, p.dark, 0.4, 0.02, 0, 0.06, 0, 0, [1, 1, 1]); };
function sofa(m, p, o) {
  const base = o.base, cush = o.cush;
  bx(m, base, 1.8, 0.28, 0.85, 0, 0.1, 0, 0, matte); bx(m, base, 1.8, 0.55, 0.2, 0, 0.3, -0.33, 0, matte);
  cush.forEach((c, i) => { bx(m, c, 0.56, 0.16, 0.62, -0.58 + i * 0.58, 0.38, 0.08, 0, matte); bx(m, c, 0.54, 0.34, 0.12, -0.58 + i * 0.58, 0.54, -0.2, [-0.15, 0, 0], matte); });
  if (o.round) for (const s of [-1, 1]) cy(m, base, 0.14, 0.14, 0.85, s * 0.93, 0.3, 0, [PI / 2, 0, 0], matte, 14);
  else for (const s of [-1, 1]) bx(m, base, 0.18, 0.28, 0.85, s * 0.9, 0.38, 0, 0, matte);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(m, o.leg, 0.03, 0.025, 0.1, sx * 0.8, 0, sz * 0.34, 0, shiny, 8);
}
F.table_cool_1 = (m, p) => sofa(m, p, { base: p.dark, cush: [p.main, p.main, p.main], leg: p.metal });
F.table_cute_1 = (m, p) => sofa(m, p, { base: p.alt, cush: [p.main, p.acc, p.main], leg: p.wood, round: true });
F.table_fun_1 = (m, p) => sofa(m, p, { base: p.dark, cush: [p.main, p.acc, p.alt], leg: p.wood, round: true });

// 床板 (1.6 x 2.1)
function bedBase(m, c, h = 0.3, o) { bx(m, c, 1.6, h, 2.1, 0, 0.08, 0, 0, o); legs4(m, c, 1.5, 2.0, 0.08, 0.05); }
F.bed_cool_0 = (m, p) => { bedBase(m, p.dark, 0.22, shiny); bx(m, p.metal, 1.62, 0.9, 0.06, 0, 0.1, -1.04, 0, shiny); for (const s of [-1, 1]) cy(m, p.metal, 0.03, 0.03, 0.9, s * 0.78, 0, -1.04, 0, shiny, 10); bx(m, p.acc, 1.5, 0.03, 0.02, 0, 0.16, 1.06, 0, glow(p.acc)); };
F.bed_cool_1 = (m, p) => { bedBase(m, p.wood, 0.3, matte); bx(m, p.wood, 1.7, 1.15, 0.12, 0, 0.1, -1.05, 0, matte); bx(m, p.acc, 1.5, 0.04, 0.02, 0, 1.05, -0.98, 0, glow(p.acc)); bx(m, p.alt, 1.62, 0.06, 0.1, 0, 0.3, 1.02); };
F.bed_cute_0 = (m, p) => { bedBase(m, p.main, 0.28, matte); bx(m, p.main, 1.62, 0.7, 0.08, 0, 0.1, -1.04, 0, matte); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(m, p.alt, 0.03, 0.03, 1.5, sx * 0.78, 0, sz * 1.02, 0, matte, 10); bx(m, p.alt, 1.68, 0.03, 2.16, 0, 1.5, 0, 0, matte); for (let i = 0; i < 4; i++) sp(m, p.acc, 0.07, 0.07, 0.07, -0.6 + i * 0.4, 1.5, 1.08); };
F.bed_cute_1 = (m, p) => { bedBase(m, p.alt, 0.28, matte); for (let i = 0; i < 5; i++) sp(m, i % 2 ? p.main : p.alt, 0.28, 0.3, 0.14, -0.62 + i * 0.31, 0.6 + (i % 2) * 0.12, -1.04, matte); sp(m, p.acc, 0.1, 0.1, 0.1, 0, 1.0, -1.04); };
F.bed_fun_0 = (m, p) => { bedBase(m, p.main, 0.3, matte); for (const s of [-1, 1]) { cy(m, p.alt, 0.17, 0.17, 1.1, s * 0.78, 0, -1.0, 0, matte); cy(m, p.acc, 0, 0.22, 0.4, s * 0.78, 1.1, -1.0, 0, matte); } cy(m, p.dark, 0.01, 0.01, 0.3, 0.78, 1.5, -1.0, 0); bx(m, p.acc, 0.2, 0.12, 0.01, 0.88, 1.65, -1.0); bx(m, p.alt, 1.4, 0.7, 0.08, 0, 0.1, -1.05); };
F.bed_fun_1 = (m, p) => { bedBase(m, p.wood, 0.25, matte); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(m, p.alt, 0.04, 0.04, 1.65, sx * 0.78, 0, sz * 1.02, 0, matte, 10); bx(m, p.wood, 1.6, 0.1, 2.1, 0, 1.15, 0); bx(m, p.main, 1.6, 0.35, 0.05, 0, 1.25, 1.05); bx(m, p.main, 1.6, 0.35, 0.05, 0, 1.25, -1.05); for (let i = 0; i < 5; i++) bx(m, p.acc, 0.3, 0.04, 0.05, 0.9, 0.2 + i * 0.25, 0.8 - i * 0.02); for (const z of [0.7, 0.9]) cy(m, p.acc, 0.02, 0.02, 1.2, 0.9, 0.1, z, 0, matte, 8); };

// 床墊 (1.5 x 2.0)，原點在底部
function mattress(m, o) {
  bx(m, o.base, 1.5, 0.2, 2.0, 0, 0, 0, 0, matte); bx(m, o.top, 1.52, 0.04, 2.02, 0, 0.2, 0, 0, matte);
  bx(m, o.pillow, 0.6, 0.12, 0.35, -0.35, 0.24, -0.7, [-0.15, 0, 0], matte); bx(m, o.pillow, 0.6, 0.12, 0.35, 0.35, 0.24, -0.7, [-0.15, 0, 0], matte);
  bx(m, o.blanket, 1.52, 0.07, 1.1, 0, 0.22, 0.45, 0, matte); o.extra && o.extra(m);
}
F.mattress_cool_0 = (m, p) => mattress(m, { base: p.alt, top: p.main, pillow: p.light, blanket: p.dark, extra: (mm) => bx(mm, p.acc, 1.52, 0.02, 0.06, 0, 0.3, -0.12, 0, glow(p.acc)) });
F.mattress_cool_1 = (m, p) => mattress(m, { base: p.light, top: p.metal, pillow: p.alt, blanket: p.main });
F.mattress_cute_0 = (m, p) => mattress(m, { base: p.alt, top: p.main, pillow: p.alt, blanket: p.main, extra: (mm) => { sp(mm, p.acc, 0.07, 0.07, 0.02, -0.06, 0.34, 0.45); sp(mm, p.acc, 0.07, 0.07, 0.02, 0.06, 0.34, 0.45); cy(mm, p.acc, 0.12, 0, 0.1, 0, 0.27, 0.43, [PI, 0, 0], matte, 4); } });
F.mattress_cute_1 = (m, p) => mattress(m, { base: '#d9c9ff', top: '#f0e8ff', pillow: p.alt, blanket: '#b99cff', extra: (mm) => { for (const [x, z] of [[-0.4, 0.2], [0.3, 0.5], [0.0, 0.85], [-0.45, 0.8]]) sp(mm, '#ffe66d', 0.07, 0.03, 0.07, x, 0.3, z); } });
F.mattress_fun_0 = (m, p) => mattress(m, { base: p.alt, top: p.main, pillow: p.light, blanket: p.main, extra: (mm) => { for (let i = 0; i < 5; i++) bx(mm, i % 2 ? p.acc : p.alt, 1.53, 0.075, 0.2, 0, 0.22, -0.1 + i * 0.4, 0, matte); } });
F.mattress_fun_1 = (m, p) => { cy(m, '#3d8bff', 0.1, 0.1, 0.22, -0.65, 0, 0.9, [0, 0, 0], { m: 0, r: 0.2 }); bx(m, '#4da6ff', 1.5, 0.22, 2.0, 0, 0, 0, 0, { m: 0, r: 0.2 }); bx(m, '#8fd0ff', 1.3, 0.04, 1.8, 0, 0.22, 0, 0, { m: 0, r: 0.15 }); bx(m, p.light, 0.6, 0.12, 0.35, 0, 0.26, -0.7, [-0.15, 0, 0], matte); };

// 電腦桌組 (1.1 x 0.65)
function desk(m, c, o) { bx(m, c, 1.1, 0.05, 0.62, 0, 0.72, 0, 0, o); legs4(m, c, 1.04, 0.56, 0.72, 0.025, 0, 0, o); }
function laptop(m, base, screen, key, x = 0, z = 0.05) { bx(m, base, 0.38, 0.02, 0.26, x, 0.77, z); bx(m, key, 0.32, 0.005, 0.18, x, 0.795, z + 0.02, 0, matte); bx(m, base, 0.38, 0.25, 0.015, x, 0.78, z - 0.12, [-0.18, 0, 0]); bx(m, screen, 0.34, 0.2, 0.005, x, 0.795, z - 0.108, [-0.18, 0, 0], glow(screen)); }
F.pc_cool_0 = (m, p) => { desk(m, p.dark, shiny); bx(m, p.dark, 0.62, 0.36, 0.04, -0.12, 0.88, -0.12); bx(m, '#0aa7c2', 0.58, 0.32, 0.01, -0.12, 0.9, -0.098, 0, glow('#0aa7c2')); bx(m, p.dark, 0.05, 0.14, 0.05, -0.12, 0.77, -0.12); bx(m, p.alt, 0.22, 0.45, 0.42, 0.42, 0.77, -0.02, 0, shiny); bx(m, p.acc, 0.01, 0.4, 0.3, 0.531, 0.8, -0.02, 0, glow(p.acc)); bx(m, p.dark, 0.45, 0.015, 0.14, -0.12, 0.77, 0.15); bx(m, p.acc, 0.4, 0.005, 0.02, -0.12, 0.785, 0.15, 0, glow(p.acc)); };
F.pc_cool_1 = (m, p) => { desk(m, p.dark, shiny); laptop(m, p.dark, '#0aa7c2', p.alt, 0); bx(m, p.acc, 0.1, 0.01, 0.01, 0, 0.775, 0.2, 0, glow(p.acc)); cy(m, p.metal, 0.03, 0.03, 0.1, 0.4, 0.77, 0, 0, shiny); };
F.pc_cute_0 = (m, p) => { desk(m, p.alt, matte); laptop(m, p.main, '#ffd6ea', p.alt); sp(m, p.acc, 0.03, 0.03, 0.03, 0.15, 0.8, 0.12); cy(m, p.main, 0.05, 0.05, 0.08, 0.42, 0.77, -0.05, 0, matte); };
F.pc_cute_1 = (m, p) => { desk(m, p.alt, matte); bx(m, p.main, 0.6, 0.4, 0.05, 0, 0.8, -0.1, 0, matte); bx(m, '#ffd6ea', 0.54, 0.32, 0.01, 0, 0.84, -0.072, 0, glow('#ffd6ea')); for (const s of [-1, 1]) cy(m, p.main, 0, 0.07, 0.12, s * 0.22, 1.2, -0.1, [0, 0, -s * 0.2], matte, 4); bx(m, p.main, 0.1, 0.08, 0.05, 0, 0.75, -0.1, 0, matte); bx(m, p.alt, 0.4, 0.015, 0.14, 0, 0.77, 0.15, 0, matte); sp(m, p.acc, 0.025, 0.025, 0.02, 0, 1.0, -0.07); };
F.pc_fun_0 = (m, p) => { desk(m, p.wood, matte); bx(m, '#e8dcb0', 0.5, 0.42, 0.45, 0, 0.77, -0.1, 0, matte); bx(m, '#1e3a2f', 0.38, 0.3, 0.02, 0, 0.84, 0.13, 0, glow('#2fa56a')); bx(m, '#e8dcb0', 0.44, 0.02, 0.18, 0, 0.77, 0.2, 0, matte); for (let i = 0; i < 3; i++) sp(m, [p.acc, p.alt, p.metal][i], 0.02, 0.02, 0.02, -0.15 + i * 0.05, 0.9 - 0.1, 0.13); };
F.pc_fun_1 = (m, p) => { desk(m, p.wood, matte); laptop(m, p.dark, p.alt, '#222'); RAINBOW.forEach((c, i) => bx(m, c, 0.045, 0.012, 0.05, -0.12 + i * 0.05, 0.795, 0.08, 0, matte)); sp(m, p.acc, 0.05, 0.05, 0.05, 0.4, 0.8, 0.05); };

// 電視 (1.3 x 0.5)
function tvStand(m, c, o) { bx(m, c, 1.2, 0.4, 0.42, 0, 0, 0, 0, o); bx(m, '#000', 1.0, 0.18, 0.01, 0, 0.12, 0.215, 0, matte); }
F.tv_cool_0 = (m, p) => { tvStand(m, p.dark, shiny); bx(m, '#05070b', 1.15, 0.66, 0.05, 0, 0.58, 0, 0, shiny); bx(m, '#10243a', 1.1, 0.6, 0.01, 0, 0.61, 0.027, 0, glow('#1a6a9a')); bx(m, p.metal, 0.3, 0.02, 0.15, 0, 0.4, 0, 0, shiny); bx(m, p.acc, 0.5, 0.01, 0.01, 0, 0.57, 0.03, 0, glow(p.acc)); };
F.tv_cool_1 = (m, p) => { tvStand(m, p.main, shiny); bx(m, '#05070b', 0.8, 0.5, 0.05, 0, 0.45, 0, 0, shiny); bx(m, '#14233a', 0.76, 0.46, 0.01, 0, 0.47, 0.027, 0, glow('#285d8f')); bx(m, p.metal, 0.2, 0.05, 0.12, 0, 0.4, 0); };
F.tv_cute_0 = (m, p) => { tvStand(m, p.alt, matte); bx(m, p.main, 0.8, 0.52, 0.06, 0, 0.45, 0, 0, matte); bx(m, '#ffe6f0', 0.7, 0.42, 0.01, 0, 0.5, 0.032, 0, glow('#ffd1e6')); sp(m, p.acc, 0.03, 0.03, 0.03, 0.34, 0.5, 0.04); };
F.tv_cute_1 = (m, p) => { tvStand(m, p.main, matte); bx(m, p.alt, 0.9, 0.55, 0.06, 0, 0.45, 0, 0, matte); bx(m, '#ffe6f0', 0.8, 0.45, 0.01, 0, 0.5, 0.032, 0, glow('#ffd1e6')); sp(m, '#ff3d6e', 0.07, 0.07, 0.04, -0.06, 1.05, 0); sp(m, '#ff3d6e', 0.07, 0.07, 0.04, 0.06, 1.05, 0); cy(m, '#ff3d6e', 0.13, 0, 0.14, 0, 0.9, 0, [PI, 0, 0], matte, 4); };
F.tv_fun_0 = (m, p) => { tvStand(m, p.wood, matte); bx(m, '#b08040', 0.8, 0.6, 0.5, 0, 0.4, 0, 0, matte); bx(m, '#142014', 0.55, 0.44, 0.02, -0.07, 0.48, 0.255, 0, glow('#2f8a4a')); cy(m, '#222', 0.025, 0.025, 0.09, 0.3, 0.55, 0.255, [PI / 2, 0, 0], matte, 10); cy(m, '#222', 0.025, 0.025, 0.09, 0.3, 0.45, 0.255, [PI / 2, 0, 0], matte, 10); for (const s of [-1, 1]) cy(m, p.metal, 0.008, 0.008, 0.5, s * 0.15, 1.0, 0, [0, 0, -s * 0.5], shiny, 6); };
F.tv_fun_1 = (m, p) => { tvStand(m, p.main, matte); bx(m, p.alt, 1.2, 0.75, 0.06, 0, 0.55, 0, 0, matte); bx(m, '#1b2a45', 1.1, 0.65, 0.01, 0, 0.6, 0.033, 0, glow('#3a64b5')); RAINBOW.forEach((c, i) => bx(m, c, 0.18, 0.04, 0.01, -0.45 + i * 0.18, 0.62, 0.04, 0, glow(c))); };

// 衣櫃 (1.0 x 0.55)
function wardrobe(m, o) {
  bx(m, o.body, 1.0, 2.0, 0.55, 0, 0, 0, 0, o.mat); bx(m, o.base, 1.04, 0.08, 0.58, 0, 0, 0); bx(m, o.base, 1.04, 0.06, 0.58, 0, 2.0, 0);
  for (const s of [-1, 1]) { bx(m, o.door(s), 0.47, 1.8, 0.03, s * 0.245, 0.1, 0.28, 0, o.mat); o.handle(m, s); }
}
F.wardrobe_cool_0 = (m, p) => wardrobe(m, { body: p.alt, base: p.dark, mat: shiny, door: () => p.main, handle: (mm, s) => { cy(mm, p.metal, 0.012, 0.012, 0.3, s * 0.06, 0.9, 0.3, 0, shiny, 8); for (let i = 0; i < 4; i++) sp(mm, p.metal, 0.012, 0.012, 0.012, s * 0.42, 0.3 + i * 0.4, 0.3); } });
F.wardrobe_cool_1 = (m, p) => wardrobe(m, { body: p.dark, base: '#000', mat: matte, door: () => p.wood, handle: (mm, s) => { bx(mm, p.acc, 0.02, 0.3, 0.02, s * 0.06, 0.9, 0.3, 0, glow(p.acc)); } });
F.wardrobe_cute_0 = (m, p) => wardrobe(m, { body: p.main, base: p.alt, mat: matte, door: () => p.alt, handle: (mm, s) => { sp(mm, p.acc, 0.04, 0.04, 0.015, s * 0.07, 1.0, 0.3); sp(mm, p.acc, 0.04, 0.04, 0.015, s * 0.11, 1.0, 0.3); } });
F.wardrobe_cute_1 = (m, p) => wardrobe(m, { body: p.alt, base: p.acc, mat: matte, door: (s) => (s < 0 ? p.main : p.alt), handle: (mm, s) => { sp(mm, '#ff3d6e', 0.045, 0.045, 0.045, s * 0.07, 1.0, 0.32); for (let i = 0; i < 6; i++) bx(mm, p.acc, 0.47, 0.06, 0.005, s * 0.245, 0.3 + i * 0.3, 0.296, 0, matte); } });
F.wardrobe_fun_0 = (m, p) => wardrobe(m, { body: p.dark, base: p.wood, mat: matte, door: (s) => (s < 0 ? p.main : p.alt), handle: (mm, s) => { cy(mm, p.acc, 0.03, 0.03, 0.04, s * 0.07, 1.0, 0.3, [PI / 2, 0, 0], matte, 10); bx(mm, s < 0 ? p.acc : p.metal, 0.3, 0.3, 0.005, s * 0.245, 1.2, 0.296, 0, matte); bx(mm, s < 0 ? p.metal : p.acc, 0.3, 0.3, 0.005, s * 0.245, 0.5, 0.296, 0, matte); } });
F.wardrobe_fun_1 = (m, p) => { wardrobe(m, { body: p.dark, base: '#2b1b66', mat: matte, door: () => '#5a34c8', handle: (mm, s) => { sp(mm, '#ffd93d', 0.04, 0.04, 0.02, s * 0.07, 1.0, 0.3, glow('#8a6d00')); for (const [x, y] of [[0.2, 0.5], [0.15, 1.3], [0.3, 1.6]]) sp(mm, '#ffd93d', 0.03, 0.03, 0.01, s * x, y, 0.3, glow('#8a6d00')); } }); cy(m, '#14102b', 0.2, 0.28, 0.4, 0, 2.06, 0, 0, matte); cy(m, '#14102b', 0.38, 0.38, 0.03, 0, 2.06, 0, 0, matte); to(m, '#ff5a5f', 0.215, 0.015, 0, 2.2, 0, 0, [1, 1, 1]); };

// 擺飾 (0.5 x 0.5)
F.decor_cool_0 = (m, p) => { cy(m, p.dark, 0.14, 0.16, 0.03, 0, 0, 0, 0, shiny); cy(m, p.metal, 0.015, 0.015, 1.3, 0, 0.03, 0, 0, shiny, 8); cy(m, '#bff9ff', 0.09, 0.07, 0.2, 0, 1.3, 0, 0, glow('#00e5ff')); cy(m, p.dark, 0.1, 0.1, 0.03, 0, 1.5, 0); };
F.decor_cool_1 = (m, p) => { cy(m, p.dark, 0.2, 0.2, 0.06, 0, 0, 0); sp(m, '#e8e4d8', 0.16, 0.17, 0.15, 0, 0.3, 0, matte); bx(m, '#e8e4d8', 0.14, 0.09, 0.12, 0, 0.1 + 0.06, 0.02, 0, matte); sp(m, '#111', 0.04, 0.05, 0.02, -0.06, 0.32, 0.13); sp(m, '#111', 0.04, 0.05, 0.02, 0.06, 0.32, 0.13); bx(m, '#111', 0.03, 0.04, 0.02, 0, 0.24, 0.14); };
F.decor_cute_0 = (m, p) => { const c = '#c98f5a'; sp(m, c, 0.17, 0.2, 0.15, 0, 0.3, 0, matte); sp(m, c, 0.13, 0.13, 0.12, 0, 0.62, 0.02, matte); for (const s of [-1, 1]) { sp(m, c, 0.06, 0.06, 0.04, s * 0.1, 0.72, 0, matte); sp(m, c, 0.07, 0.07, 0.07, s * 0.15, 0.14, 0.05, matte); sp(m, c, 0.06, 0.12, 0.06, s * 0.2, 0.34, 0.03, matte); sp(m, '#111', 0.015, 0.015, 0.015, s * 0.05, 0.65, 0.13); } sp(m, '#f3d9b8', 0.05, 0.04, 0.04, 0, 0.6, 0.13, matte); sp(m, '#111', 0.015, 0.012, 0.012, 0, 0.62, 0.17); sp(m, p.acc, 0.05, 0.02, 0.02, 0, 0.5, 0.1); };
F.decor_cute_1 = (m, p) => { cy(m, '#e0905a', 0.17, 0.12, 0.25, 0, 0, 0, 0, matte); for (const [x, y, z, r] of [[0, 0.5, 0, 0.2], [-0.12, 0.4, 0.05, 0.14], [0.13, 0.42, -0.03, 0.14], [0.02, 0.68, 0.02, 0.13]]) sp(m, '#4cb86a', r, r, r, x, y, z, matte); sp(m, p.acc, 0.04, 0.04, 0.04, 0.1, 0.62, 0.12); sp(m, p.acc, 0.04, 0.04, 0.04, -0.1, 0.5, 0.14); };
F.decor_fun_0 = (m, p) => { bx(m, '#e8e8f0', 0.38, 0.07, 0.26, 0, 0, 0, 0, matte); bx(m, '#2a2f55', 0.38, 0.06, 0.26, 0, 0.07, 0); bx(m, '#7fe0ff', 0.2, 0.012, 0.14, 0, 0.13, 0, 0, glow('#7fe0ff')); sp(m, p.acc, 0.02, 0.02, 0.02, 0.1, 0.14, 0.05); sp(m, p.metal, 0.02, 0.02, 0.02, 0.14, 0.14, 0); bx(m, '#2a2f55', 0.06, 0.012, 0.02, -0.14, 0.13, 0); bx(m, '#2a2f55', 0.02, 0.012, 0.06, -0.14, 0.13, 0); };
F.decor_fun_1 = (m, p) => { cy(m, '#555', 0.14, 0.15, 0.05, 0, 0, 0, 0, matte); [[0, 1.2, '#ff4d4d'], [-0.12, 0.95, '#ffd93d'], [0.12, 0.85, '#4da6ff']].forEach(([x, y, c], i) => { sp(m, c, 0.13, 0.16, 0.13, x * 1.0, y, 0, { m: 0.1, r: 0.2 }); cy(m, '#ddd', 0.004, 0.004, y - 0.16 - 0.05, x * 0.5, 0.05, 0, 0, matte, 4); }); };

// ═════════ 建材 ═════════
const MAT = {
  material_wood: (m) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) bx(m, '#b9824a', 0.5, 0.1, 0.2, 0, 0.1 * i, -0.1 + j * 0.2 + (i % 2) * 0.02, 0, matte); bx(m, '#d3a266', 0.5, 0.01, 0.4, 0, 0.3, 0); },
  material_brick: (m) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bx(m, '#b5523b', 0.22, 0.1, 0.1, -0.12 + ((i + j) % 2) * 0.1 + (j % 2) * 0.12, 0.1 * i, -0.12 + j * 0.12, 0, matte); },
  material_cement: (m) => { bx(m, '#c9c9c0', 0.4, 0.14, 0.26, 0, 0, 0, 0, matte); bx(m, '#c9c9c0', 0.4, 0.14, 0.26, 0, 0.14, 0, [0, 0.4, 0], matte); bx(m, '#2b6cb0', 0.2, 0.06, 0.002, 0, 0.05, 0.131, 0, matte); },
  material_glass: (m) => { for (let i = 0; i < 3; i++) bx(m, '#a6dcf0', 0.5, 0.45, 0.02, 0, 0, -0.1 + i * 0.1, [0, 0, 0], { m: 0.1, r: 0.05 }); bx(m, '#6b4a2a', 0.54, 0.04, 0.4, 0, 0, 0, 0, matte); },
  material_steel: (m) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cy(m, '#8e97a6', 0.02, 0.02, 0.6, -0.08 + i * 0.08, 0, -0.08 + j * 0.08, [PI / 2, 0, 0], shiny, 8); to(m, '#555', 0.14, 0.01, 0, 0.1, 0, [PI / 2, 0, 0], [1, 1, 1]); },
};

// ═════════ 服飾（身體座標：腳底 y=0，面向 +z，身高約 1.75）═════════
const W = {};
function torso(m, c, o, opt = {}) {
  const geo = cyl(0.185, 0.17, opt.h || 0.62, 20);
  m.add(geo, m.mat(c, o), { p: [0, 0.84 + (opt.h || 0.62) / 2, 0], s: [1, 1, 0.68] });
  for (const s of [-1, 1]) {
    sp(m, c, 0.075, 0.075, 0.075, s * 0.205, 1.4, 0, o);
    const L = opt.sleeve ?? 0.42;
    if (L > 0) m.add(cyl(0.062, 0.056, L, 14), m.mat(c, o), { p: [s * 0.255 + s * 0.02 * (L / 0.42), 1.39 - L / 2, 0], r: [0, 0, s * 0.07] });
  }
}
function pants(m, c, o, len = 0.78, wr = 0.09) {
  m.add(cyl(0.18, 0.185, 0.14, 20), m.mat(c, o), { p: [0, 0.85, 0], s: [1, 1, 0.68] });
  for (const s of [-1, 1]) cy(m, c, wr, wr * 0.82, len, s * 0.095, 0.86 - len, 0, 0, o, 14);
}
const feet = (m, fn) => { for (const s of [-1, 1]) fn(s * 0.095); };

// 頭飾
W.head_cool_0 = (m, p) => { sp(m, p.main, 0.135, 0.095, 0.14, 0, 1.65, -0.005, matte); bx(m, p.main, 0.2, 0.014, 0.13, 0, 1.635, 0.15, [0.12, 0, 0], matte); bx(m, p.acc, 0.2, 0.012, 0.012, 0, 1.64, 0.1, 0, glow(p.acc)); };
W.head_cool_1 = (m, p) => { for (const s of [-1, 1]) { bx(m, '#05070b', 0.075, 0.05, 0.012, s * 0.052, 1.585, 0.118, 0, shiny); bx(m, p.metal, 0.11, 0.008, 0.008, s * 0.115, 1.6, 0.06, [0, 1.5, 0], shiny); } bx(m, p.metal, 0.04, 0.01, 0.01, 0, 1.6, 0.12, 0, shiny); };
W.head_cute_0 = (m, p) => { to(m, '#4cb86a', 0.125, 0.012, 0, 1.68, 0, 0, [1, 1, 1], matte); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; sp(m, [p.acc, '#fff', '#ffd93d', p.main][i % 4], 0.03, 0.03, 0.03, Math.cos(a) * 0.125, 1.69, Math.sin(a) * 0.125, matte); } };
W.head_cute_1 = (m, p) => { for (const s of [-1, 1]) sp(m, p.acc, 0.055, 0.04, 0.02, 0.12 + s * 0.05, 1.66, 0.05, matte); sp(m, p.dark, 0.022, 0.022, 0.022, 0.12, 1.66, 0.06, matte); };
W.head_fun_0 = (m, p) => { cy(m, p.acc, 0, 0.1, 0.3, 0, 1.68, 0, [0, 0, 0.15], matte, 14); for (const [y, r] of [[1.74, 0.075], [1.82, 0.05]]) to(m, p.alt, r, 0.01, 0.0 + (y - 1.74) * 0.5, y, 0, [0, 0, 0.15], [1, 1, 1]); sp(m, '#ffd93d', 0.035, 0.035, 0.035, 0.045, 1.99, 0, matte); };
W.head_fun_1 = (m, p) => { RAINBOW.forEach((c, i) => { const a = (i / 6) * PI * 2; sp(m, c, 0.07, 0.07, 0.07, Math.cos(a) * 0.12, 1.68 + (i % 2) * 0.03, Math.sin(a) * 0.12 - 0.02, matte); }); sp(m, RAINBOW[2], 0.09, 0.08, 0.09, 0, 1.76, -0.02, matte); sp(m, '#ff2d2d', 0.035, 0.035, 0.035, 0, 1.565, 0.13, matte); };

// 上衣
W.top_cool_0 = (m, p) => { torso(m, '#1c1c22', { m: 0.2, r: 0.5 }); bx(m, p.metal, 0.012, 0.58, 0.01, 0, 0.86, 0.128, 0, shiny); bx(m, '#1c1c22', 0.22, 0.05, 0.14, 0, 1.42, 0.02, 0, matte); };
W.top_cool_1 = (m, p) => { torso(m, p.dark, matte, { sleeve: 0.18 }); bx(m, p.acc, 0.14, 0.04, 0.004, 0, 1.25, 0.128, 0, glow(p.acc)); };
W.top_cute_0 = (m, p) => { torso(m, '#fffafc', matte, { sleeve: 0.16 }); to(m, '#fff', 0.178, 0.03, 0, 0.86, 0, 0, [1, 1, 0.68], matte); to(m, '#fff', 0.15, 0.015, 0, 1.38, 0, 0, [1, 1, 0.68], matte); };
W.top_cute_1 = (m, p) => { torso(m, p.main, matte); sp(m, '#ff3d6e', 0.032, 0.032, 0.012, -0.028, 1.26, 0.13, matte); sp(m, '#ff3d6e', 0.032, 0.032, 0.012, 0.028, 1.26, 0.13, matte); cy(m, '#ff3d6e', 0.055, 0, 0.065, 0, 1.2, 0.13, [PI / 2 + PI / 2, 0, 0], matte, 4); };
W.top_fun_0 = (m, p) => { torso(m, p.main, matte); to(m, '#16161c', 0.178, 0.025, 0, 0.9, 0, 0, [1, 1, 0.68], matte); bx(m, '#16161c', 0.06, 0.1, 0.02, 0.03, 0.8, 0.125, [0, 0, 0.3], matte); bx(m, p.acc, 0.1, 0.01, 0.01, 0, 1.36, 0.128, [0, 0, 0.5], matte); };
W.top_fun_1 = (m, p) => { torso(m, '#ffffff', matte, { sleeve: 0.2 }); [0.92, 1.1, 1.28].forEach((y) => cy(m, p.alt, 0.188, 0.186, 0.07, 0, y, 0, 0, matte, 20)); for (const s of [-1, 1]) cy(m, p.alt, 0.064, 0.064, 0.04, s * 0.265, 1.2, 0, [0, 0, s * 0.07], matte, 14); bx(m, p.acc, 0.08, 0.1, 0.004, 0, 1.15, 0.133, 0, matte); };

// 下裝
W.bottom_cool_0 = (m, p) => pants(m, '#1a1d24', matte);
W.bottom_cool_1 = (m, p) => { pants(m, '#27324d', matte); bx(m, SKIN, 0.07, 0.07, 0.01, -0.095, 0.5, 0.08, 0, matte); bx(m, SKIN, 0.06, 0.05, 0.01, 0.1, 0.35, 0.07, 0, matte); bx(m, p.metal, 0.05, 0.035, 0.01, 0, 0.9, 0.125, 0, shiny); };
W.bottom_cute_0 = (m, p) => pants(m, p.main, matte, 0.28, 0.095);
W.bottom_cute_1 = (m, p) => { m.add(cyl(0.18, 0.185, 0.1, 20), m.mat(p.acc, matte), { p: [0, 0.87, 0], s: [1, 1, 0.68] }); cy(m, p.main, 0.19, 0.4, 0.34, 0, 0.55, 0, 0, matte, 28); to(m, p.alt, 0.4, 0.02, 0, 0.56, 0, 0, [1, 1, 1], matte); };
W.bottom_fun_0 = (m, p) => { pants(m, p.main, matte, 0.36, 0.1); for (const s of [-1, 1]) { to(m, p.acc, 0.085, 0.012, s * 0.095, 0.62, 0, 0, [1, 1, 1], matte); to(m, p.acc, 0.095, 0.012, s * 0.095, 0.78, 0, 0, [1, 1, 1], matte); } };
W.bottom_fun_1 = (m, p) => { m.add(cyl(0.18, 0.185, 0.14, 20), m.mat(RAINBOW[0], matte), { p: [0, 0.85, 0], s: [1, 1, 0.68] }); for (const s of [-1, 1]) for (let i = 0; i < 6; i++) cy(m, RAINBOW[i], 0.09 - i * 0.002, 0.09 - (i + 1) * 0.002, 0.13, s * 0.095, 0.86 - (i + 1) * 0.13, 0, 0, matte, 14); };

// 鞋子
const shoe = (m, x, o) => { // o: {c, sole, h, toe}
  bx(m, o.sole, 0.125, 0.04, 0.27, x, 0, 0.04, 0, matte); m.add(sphere(1, 14, 10), m.mat(o.c, o.mat || matte), { p: [x, 0.07, 0.15], s: [0.062, 0.05, 0.075] });
  cy(m, o.c, 0.07, 0.065, o.h, x, 0.04, -0.005, 0, o.mat || matte, 14); bx(m, o.c, 0.12, 0.07, 0.17, x, 0.04, 0.07, 0, o.mat || matte);
};
W.shoes_cool_0 = (m, p) => feet(m, (x) => { shoe(m, x, { c: '#2a2a2e', sole: '#111', h: 0.2 }); to(m, p.metal, 0.07, 0.01, x, 0.2, -0.005, 0, [1, 1, 1], shiny); });
W.shoes_cool_1 = (m, p) => feet(m, (x) => { shoe(m, x, { c: '#0e0e12', sole: '#222', h: 0.42, mat: shiny }); bx(m, p.metal, 0.03, 0.03, 0.01, x, 0.3, 0.07, 0, shiny); });
W.shoes_cute_0 = (m, p) => feet(m, (x) => { shoe(m, x, { c: '#ffffff', sole: p.main, h: 0.1 }); bx(m, p.acc, 0.1, 0.01, 0.1, x, 0.1, 0.08, 0, matte); });
W.shoes_cute_1 = (m, p) => feet(m, (x) => { shoe(m, x, { c: p.main, sole: p.acc, h: 0.06 }); sp(m, p.acc, 0.03, 0.02, 0.01, x - 0.015, 0.1, 0.17, matte); sp(m, p.acc, 0.03, 0.02, 0.01, x + 0.015, 0.1, 0.17, matte); });
W.shoes_fun_0 = (m, p) => feet(m, (x) => { bx(m, p.alt, 0.12, 0.03, 0.27, x, 0, 0.04, 0, matte); bx(m, p.acc, 0.014, 0.05, 0.05, x - 0.03, 0.03, 0.16, [0, 0, -0.4], matte); bx(m, p.acc, 0.014, 0.05, 0.05, x + 0.03, 0.03, 0.16, [0, 0, 0.4], matte); });
W.shoes_fun_1 = (m, p) => feet(m, (x) => { shoe(m, x, { c: p.acc, sole: '#ffffff', h: 0.09 }); bx(m, p.alt, 0.13, 0.025, 0.08, x, 0.07, 0.1, 0, matte); });

// 套裝（含上衣+下裝，穿上時隱藏上衣/下裝）
W.suit_cool_0 = (m, p) => { torso(m, '#17171c', matte); pants(m, '#17171c', matte); bx(m, '#fff', 0.12, 0.34, 0.01, 0, 1.08, 0.13, 0, matte); for (const s of [-1, 1]) bx(m, '#17171c', 0.06, 0.3, 0.01, s * 0.09, 1.1, 0.128, [0, 0, -s * 0.35], matte); bx(m, p.acc, 0.06, 0.03, 0.012, 0, 1.36, 0.135, 0, matte); bx(m, '#17171c', 0.045, 0.045, 0.01, 0, 1.36, 0.14, 0, matte); };
W.suit_cool_1 = (m, p) => { torso(m, '#1b2036', matte); pants(m, '#1b2036', matte); sp(m, '#1b2036', 0.15, 0.15, 0.15, 0, 1.6, -0.035, matte); bx(m, '#1b2036', 0.2, 0.09, 0.02, 0, 1.54, 0.075, 0, matte); bx(m, SKIN, 0.16, 0.035, 0.012, 0, 1.6, 0.113, 0, matte); to(m, '#d63031', 0.07, 0.025, 0, 1.45, 0, 0, [1.4, 1, 1.2], matte); to(m, '#d63031', 0.18, 0.02, 0, 0.88, 0, 0, [1, 1, 0.68], matte); bx(m, '#d63031', 0.05, 0.28, 0.02, 0.1, 1.1, -0.13, [0, 0, 0.1], matte); };
W.suit_cute_0 = (m, p) => { torso(m, p.main, matte, { sleeve: 0.12 }); for (const s of [-1, 1]) sp(m, p.main, 0.075, 0.075, 0.075, s * 0.255, 1.35, 0, matte); cy(m, p.main, 0.18, 0.46, 0.7, 0, 0.14, 0, 0, matte, 30); to(m, '#fff', 0.46, 0.025, 0, 0.16, 0, 0, [1, 1, 1], matte); to(m, '#fff', 0.2, 0.02, 0, 0.86, 0, 0, [1, 1, 0.68], matte); sp(m, p.acc, 0.05, 0.035, 0.02, -0.04, 0.9, 0.14, matte); sp(m, p.acc, 0.05, 0.035, 0.02, 0.04, 0.9, 0.14, matte); };
W.suit_cute_1 = (m, p) => { const b = '#a8743f'; torso(m, b, matte); pants(m, b, matte); sp(m, b, 0.15, 0.15, 0.15, 0, 1.6, -0.035, matte); for (const s of [-1, 1]) { sp(m, b, 0.05, 0.05, 0.03, s * 0.1, 1.72, -0.03, matte); sp(m, '#f5d9b5', 0.03, 0.03, 0.015, s * 0.1, 1.72, -0.012, matte); sp(m, '#f5d9b5', 0.055, 0.045, 0.05, s * 0.255, 0.92, 0, matte); } sp(m, '#f5d9b5', 0.12, 0.17, 0.03, 0, 1.12, 0.12, matte); sp(m, b, 0.06, 0.06, 0.06, 0, 0.82, -0.14, matte); };
W.suit_fun_0 = (m, p) => { const g = '#3fae55'; torso(m, g, matte); pants(m, g, matte); sp(m, g, 0.15, 0.15, 0.15, 0, 1.6, -0.035, matte); bx(m, g, 0.14, 0.07, 0.1, 0, 1.58, 0.12, 0, matte); for (const s of [-1, 1]) { sp(m, '#fff', 0.025, 0.025, 0.02, s * 0.07, 1.68, 0.08, matte); sp(m, '#111', 0.012, 0.012, 0.01, s * 0.07, 1.68, 0.1, matte); } for (let i = 0; i < 5; i++) cy(m, p.acc, 0, 0.04, 0.09, 0, 1.4 - i * 0.12, -0.14 - (i === 0 ? 0 : 0), [-0.5, 0, 0], matte, 4); cy(m, g, 0, 0.09, 0.5, 0, 0.7, -0.35, [-1.2, 0, 0], matte, 10); };
W.suit_fun_1 = (m, p) => { torso(m, '#fff', matte); pants(m, '#fff', matte); sp(m, '#fff', 0.15, 0.15, 0.15, 0, 1.6, -0.035, matte); cy(m, '#ffd93d', 0, 0.025, 0.2, 0, 1.73, 0.06, [0.2, 0, 0], shiny, 10); for (const s of [-1, 1]) cy(m, '#fff', 0, 0.04, 0.1, s * 0.09, 1.73, -0.02, [0, 0, -s * 0.3], matte, 6); RAINBOW.forEach((c, i) => { sp(m, c, 0.045, 0.045, 0.045, 0, 1.68 - i * 0.1, -0.14, matte); }); RAINBOW.forEach((c, i) => sp(m, c, 0.06, 0.06, 0.06, 0, 0.9 - i * 0.04, -0.2 - i * 0.04, matte)); };

// ═════════ 材質 PNG（牆壁、地毯）═════════
const rnd = (x, y, s = 0) => { const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453; return n - Math.floor(n); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const TEX = {
  wall_cool_0: (x, y) => mix(hexRgb('#3a3f4b'), hexRgb('#4a505e'), rnd(x >> 1, y >> 1) * 0.6),
  wall_cool_1: (x, y) => (x % 32 < 2 ? hexRgb('#00e5ff') : (x >> 5) % 2 ? hexRgb('#14141f') : hexRgb('#1d1d33')),
  wall_cute_0: (x, y) => mix(hexRgb('#ffd1e3'), hexRgb('#ffe3ee'), (Math.sin((x + y) / 6) + 1) / 2 * 0.5),
  wall_cute_1: (x, y) => { const dx = (x % 64) - 32, dy = (y % 64) - 32; return dx * dx + dy * dy < 90 ? hexRgb('#ffffff') : mix(hexRgb('#bfe6ff'), hexRgb('#d6f0ff'), y / 128); },
  wall_fun_0: (x) => ((x >> 4) % 2 ? hexRgb('#ffb347') : hexRgb('#ffd580')),
  wall_fun_1: (x, y) => { const dx = (x % 32) - 16, dy = (y % 32) - 16; return dx * dx + dy * dy < 40 ? hexRgb('#ffffff') : hexRgb('#7ad0ff'); },
  carpet_cool_0: (x, y) => mix(hexRgb('#4a5060'), hexRgb('#5a6070'), rnd(x, y) * 0.5),
  carpet_cool_1: (x, y) => (x < 6 || y < 6 || x > 121 || y > 121 ? hexRgb('#c9a227') : mix(hexRgb('#1c1c1c'), hexRgb('#2a2a2a'), rnd(x, y))),
  carpet_cute_0: (x, y) => mix(hexRgb('#ffc2d9'), hexRgb('#ffd1e3'), rnd(x >> 2, y >> 2)),
  carpet_cute_1: (x, y) => { const dx = (x % 32) - 16, dy = (y % 32) - 16; return dx * dx + dy * dy < 30 ? hexRgb('#ff5d7a') : hexRgb('#ffd9e3'); },
  carpet_fun_0: (x, y) => mix(hexRgb('#ffe66d'), hexRgb('#fff2a0'), rnd(x >> 2, y >> 2) * 0.7),
  carpet_fun_1: (x) => hexRgb(RAINBOW[((x >> 4) % 6)]),
};

// ═════════ 輸出 ═════════
function run() {
  let n = 0;
  for (const [id, fn] of Object.entries(F)) { const style = id.split('_')[1]; const m = new Model(); fn(m, PAL[style]); m.save(path.join(OUT, 'models/furniture', id + '.glb')); n++; }
  for (const [id, fn] of Object.entries(W)) { const style = id.split('_')[1]; const m = new Model(); fn(m, PAL[style]); m.save(path.join(OUT, 'models/wear', id + '.glb'), CH.chibi); n++; }
  for (const [id, fn] of Object.entries(MAT)) { const m = new Model(); fn(m); m.save(path.join(OUT, 'models/material', id + '.glb')); n++; }
  for (const [id, fn] of Object.entries(CITY.B)) { const m = new Model(); fn(m); m.save(path.join(OUT, 'models/city', id + '.glb')); n++; }
  for (const g of ['m', 'f']) {
    CH.body(g).save(path.join(OUT, `models/body_${g}.glb`), CH.chibi); CH.hairBase(g).save(path.join(OUT, `models/hair_${g}.glb`), CH.chibi); CH.hairTop(g).save(path.join(OUT, `models/hairtop_${g}.glb`), CH.chibi); n += 3;
  }
  for (const [f, fn] of [['suit_start_m', CH.robeM], ['suit_start_f', CH.robeF], ['shoes_start_m', CH.bootsM], ['shoes_start_f', CH.shoesF]]) fn().save(path.join(OUT, `models/wear/${f}.glb`), CH.chibi);
  n += 4;
  for (const [id, fn] of Object.entries(TEX)) { png(path.join(OUT, 'textures', id + '.png'), 128, fn); n++; }
  console.log('產生檔案數：', n);
}
if (require.main === module) run();
module.exports = { F, W, MAT, TEX };
