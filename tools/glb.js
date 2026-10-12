// 極簡 glTF 2.0 (GLB) 產生器：用基本幾何組合出模型，並輸出 .glb 檔
const fs = require('fs');
const path = require('path');

// ── 幾何：回傳 { pos, nor, idx } ──
function box(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2;
  const F = [
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  const g = { pos: [], nor: [], idx: [] };
  for (const [n, vs] of F) {
    const b = g.pos.length / 3;
    for (const v of vs) { g.pos.push(...v); g.nor.push(...n); }
    g.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return g;
}
function cyl(rt, rb, h, seg = 16, caps = true) {
  const g = { pos: [], nor: [], idx: [] };
  const slope = (rb - rt) / h, nl = Math.hypot(1, slope);
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    g.pos.push(rt * c, h / 2, rt * s, rb * c, -h / 2, rb * s);
    g.nor.push(c / nl, slope / nl, s / nl, c / nl, slope / nl, s / nl);
  }
  for (let i = 0; i < seg; i++) { const t0 = i * 2, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3; g.idx.push(b1, b0, t0, b1, t0, t1); }
  if (caps) for (const [y, r, ny] of [[h / 2, rt, 1], [-h / 2, rb, -1]]) {
    if (r <= 0) continue;
    const c0 = g.pos.length / 3; g.pos.push(0, y, 0); g.nor.push(0, ny, 0);
    for (let i = 0; i <= seg; i++) { const t = (i / seg) * Math.PI * 2; g.pos.push(r * Math.cos(t), y, r * Math.sin(t)); g.nor.push(0, ny, 0); }
    for (let i = 0; i < seg; i++) ny > 0 ? g.idx.push(c0, c0 + i + 2, c0 + i + 1) : g.idx.push(c0, c0 + i + 1, c0 + i + 2);
  }
  return g;
}
function sphere(r = 1, ws = 18, hs = 12) {
  const g = { pos: [], nor: [], idx: [] };
  for (let j = 0; j <= hs; j++) {
    const ph = (j / hs) * Math.PI;
    for (let i = 0; i <= ws; i++) {
      const th = (i / ws) * Math.PI * 2;
      const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
      g.pos.push(r * nx, r * ny, r * nz); g.nor.push(nx, ny, nz);
    }
  }
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
    const a = j * (ws + 1) + i, b = a + 1, c = a + ws + 1, d = c + 1; // a=RT b=LT c=RB d=LB
    g.idx.push(d, c, a, d, a, b);
  }
  return g;
}
function torus(R, r, ws = 28, hs = 10) {
  const g = { pos: [], nor: [], idx: [] };
  for (let i = 0; i <= ws; i++) for (let j = 0; j <= hs; j++) {
    const th = (i / ws) * Math.PI * 2, ph = (j / hs) * Math.PI * 2;
    const cx = Math.cos(ph) * Math.cos(th), cy = Math.sin(ph), cz = Math.cos(ph) * Math.sin(th);
    g.pos.push((R + r * Math.cos(ph)) * Math.cos(th), r * Math.sin(ph), (R + r * Math.cos(ph)) * Math.sin(th)); g.nor.push(cx, cy, cz);
  }
  for (let i = 0; i < ws; i++) for (let j = 0; j < hs; j++) {
    const a = i * (hs + 1) + j, b = (i + 1) * (hs + 1) + j, c = (i + 1) * (hs + 1) + j + 1, d = i * (hs + 1) + j + 1;
    g.idx.push(b, a, d, b, d, c);
  }
  return g;
}

// 旋轉體（車削）：profile 為 [[半徑, y], ...]，由下往上；法線用相鄰面平均（平滑）
function smoothNormals(pos, idx) {
  const n = new Array(pos.length).fill(0);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], v = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) { n[i] += f[0]; n[i + 1] += f[1]; n[i + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
function lathe(profile, seg = 24, cap = true) {
  const pos = [], idx = [], n = profile.length;
  for (let j = 0; j < n; j++) for (let i = 0; i < seg; i++) { const th = (i / seg) * Math.PI * 2; pos.push(profile[j][0] * Math.cos(th), profile[j][1], profile[j][0] * Math.sin(th)); }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * seg + i, b = j * seg + ((i + 1) % seg), c = (j + 1) * seg + i, d = (j + 1) * seg + ((i + 1) % seg);
    idx.push(b, a, c, b, c, d);
  }
  if (cap) for (const [j, up] of [[0, false], [n - 1, true]]) {
    if (profile[j][0] <= 1e-6) continue;
    const c0 = pos.length / 3; pos.push(0, profile[j][1], 0);
    for (let i = 0; i < seg; i++) { const r0 = j * seg + i, r1 = j * seg + ((i + 1) % seg); up ? idx.push(c0, r1, r0) : idx.push(c0, r0, r1); }
  }
  return { pos, nor: smoothNormals(pos, idx), idx };
}

// ── 轉換：縮放 → 旋轉(XYZ) → 平移 ──
function xform(g, t) {
  const s = t.s || [1, 1, 1], r = t.r || [0, 0, 0], p = t.p || [0, 0, 0];
  const rot = (v) => {
    let [x, y, z] = v, c = Math.cos(r[0]), sn = Math.sin(r[0]);
    [y, z] = [y * c - z * sn, y * sn + z * c];
    c = Math.cos(r[1]); sn = Math.sin(r[1]);
    [x, z] = [x * c + z * sn, -x * sn + z * c];
    c = Math.cos(r[2]); sn = Math.sin(r[2]);
    [x, y] = [x * c - y * sn, x * sn + y * c];
    return [x, y, z];
  };
  const pos = [], nor = [];
  for (let i = 0; i < g.pos.length; i += 3) {
    const v = rot([g.pos[i] * s[0], g.pos[i + 1] * s[1], g.pos[i + 2] * s[2]]);
    pos.push(v[0] + p[0], v[1] + p[1], v[2] + p[2]);
    let n = [g.nor[i] / s[0], g.nor[i + 1] / s[1], g.nor[i + 2] / s[2]];
    const l = Math.hypot(...n) || 1; n = rot(n.map((q) => q / l));
    nor.push(...n);
  }
  return { pos, nor, idx: g.idx };
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const rgb = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));

class Model {
  constructor() { this.mats = []; this.parts = []; }
  mat(color, o = {}) {
    const key = JSON.stringify([color, o]);
    let i = this.mats.findIndex((m) => m.key === key);
    if (i < 0) { this.mats.push({ key, color, ...o }); i = this.mats.length - 1; }
    return i;
  }
  add(geo, mat, t = {}) { this.parts.push({ g: xform(geo, t), mat }); return this; }
  save(file) {
    const by = new Map();
    for (const { g, mat } of this.parts) {
      if (!by.has(mat)) by.set(mat, { pos: [], nor: [], idx: [] });
      const m = by.get(mat), base = m.pos.length / 3;
      m.pos.push(...g.pos); m.nor.push(...g.nor); for (const i of g.idx) m.idx.push(i + base);
    }
    const bufs = [], accessors = [], views = [], meshes = [], nodes = [], matsOut = [];
    let off = 0;
    const push = (typed, target, type, comp, count, extra = {}) => {
      const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
      views.push({ buffer: 0, byteOffset: off, byteLength: buf.length, target });
      accessors.push({ bufferView: views.length - 1, componentType: comp, count, type, ...extra });
      bufs.push(buf); off += buf.length; return accessors.length - 1;
    };
    const used = [...by.keys()];
    used.forEach((mi, k) => {
      const d = by.get(mi), mm = this.mats[mi];
      const pos = new Float32Array(d.pos), nor = new Float32Array(d.nor), idx = new Uint32Array(d.idx);
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); }
      const aP = push(pos, 34962, 'VEC3', 5126, pos.length / 3, { min: mn, max: mx });
      const aN = push(nor, 34962, 'VEC3', 5126, nor.length / 3);
      const aI = push(idx, 34963, 'SCALAR', 5125, idx.length);
      meshes.push({ primitives: [{ attributes: { POSITION: aP, NORMAL: aN }, indices: aI, material: k }] });
      nodes.push({ mesh: k });
      const mat = { pbrMetallicRoughness: { baseColorFactor: [...rgb(mm.color), 1], metallicFactor: mm.m ?? 0.1, roughnessFactor: mm.r ?? 0.7 }, doubleSided: true };
      if (mm.e) mat.emissiveFactor = rgb(mm.e);
      matsOut.push(mat);
    });
    const bin = Buffer.concat(bufs);
    const json = { asset: { version: '2.0', generator: 'house-quiz-tycoon' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials: matsOut, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }] };
    let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
    const bn = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
    const h1 = Buffer.alloc(8); h1.writeUInt32LE(js.length, 0); h1.write('JSON', 4);
    const h2 = Buffer.alloc(8); h2.writeUInt32LE(bn.length, 0); h2.writeUInt32LE(0x004e4942, 4);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.concat([head, h1, js, h2, bn]));
  }
}

// ── PNG 材質 ──
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(file, size, fn) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; for (let x = 0; x < size; x++) { const c = fn(x, y, size); const o = y * (size * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', require('zlib').deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

module.exports = { Model, box, cyl, sphere, torus, lathe, png, hexRgb };
