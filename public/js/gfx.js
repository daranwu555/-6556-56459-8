// 3D 場景：房屋（可擺放家具）、更衣室、模型縮圖
import * as THREE from 'three';
import { GLTFLoader } from 'three/jsm/GLTFLoader.js';
import { OrbitControls } from 'three/jsm/OrbitControls.js';

const loader = new GLTFLoader();
const cache = new Map();
const loadScene = (url) => { if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => g.scene)); return cache.get(url); };
export async function instance(url) {
  const c = (await loadScene(url)).clone(true);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
}
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function texture(url, rx, ry) {
  if (!texCache.has(url)) { const t = texLoader.load('/' + url); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; texCache.set(url, t); }
  const t = texCache.get(url).clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t;
}

function addLights(scene, shadows) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f78, 1.15));
  const d = new THREE.DirectionalLight(0xfff4e0, 1.6);
  d.position.set(6, 11, 7);
  if (shadows) { d.castShadow = true; d.shadow.mapSize.set(2048, 2048); const c = d.shadow.camera; c.left = -9; c.right = 9; c.top = 9; c.bottom = -9; c.near = 1; c.far = 40; d.shadow.bias = -0.0004; d.shadow.normalBias = 0.03; }
  scene.add(d);
}

// ───── 舞台基底 ─────
const stages = new Set();
(function loop() { requestAnimationFrame(loop); stages.forEach((s) => s.tick()); })();

class Stage {
  constructor(el, { shadows = false } = {}) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (shadows) { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.enablePan = false;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    addLights(this.scene, shadows);
    this.w = 0; this.h = 0;
    stages.add(this);
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  tick() {
    if (!this.el.offsetParent) return;
    if (this.el.clientWidth !== this.w || this.el.clientHeight !== this.h) this.resize();
    if (!this.w) return;
    this.controls.update();
    this.onTick && this.onTick();
    this.renderer.render(this.scene, this.camera);
  }
}

// ───── 角色 ─────
export async function buildAvatar(gender, worn, items) {
  const g = new THREE.Group();
  const urls = [`/models/body_${gender}.glb`];
  const w = worn || {};
  if (w.suit && items[w.suit]) urls.push('/' + items[w.suit].model);
  else for (const k of ['top', 'bottom']) if (w[k] && items[w[k]]) urls.push('/' + items[w[k]].model);
  for (const k of ['shoes', 'head']) if (w[k] && items[w[k]]) urls.push('/' + items[w[k]].model);
  const parts = await Promise.all(urls.map((u) => instance(u).catch(() => null)));
  parts.forEach((p) => p && g.add(p));
  return g;
}

// ───── 更衣室 ─────
export class DressView extends Stage {
  constructor(el) {
    super(el, { shadows: true });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x4a4f7a, roughness: 0.6 }));
    floor.position.y = -0.06; floor.receiveShadow = true; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.025, 8, 64), new THREE.MeshStandardMaterial({ color: 0xffcd75, emissive: 0x6a4a00 }));
    ring.rotation.x = Math.PI / 2; this.scene.add(ring);
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.controls.autoRotate = true; this.controls.autoRotateSpeed = 1.6;
    this.controls.minPolarAngle = 0.6; this.controls.maxPolarAngle = 1.6; this.controls.minDistance = 1.2; this.controls.maxDistance = 6;
    this.focus('full'); this.token = 0;
  }
  focus(mode) {
    const T = { full: [0.92, 4.6, 0.9], upper: [1.15, 2.6, 0.9], head: [1.6, 1.4, 0.8], feet: [0.2, 1.8, 0.9] }[mode] || [0.92, 4.6, 0.9];
    this.controls.target.set(0, T[0], 0);
    const az = this.controls.getAzimuthalAngle();
    this.camera.position.set(Math.sin(az) * T[1], T[0] + T[2] * 0.4, Math.cos(az) * T[1]);
  }
  async setLook(gender, worn, items) {
    const tk = ++this.token;
    const av = await buildAvatar(gender, worn, items);
    if (tk !== this.token) return;
    this.holder.clear(); this.holder.add(av);
  }
}

// ───── 房屋 ─────
const WALL_H = 2.8;
export class HouseView extends Stage {
  constructor(el, opt = {}) {
    super(el, { shadows: true });
    this.opt = opt; this.items = {}; this.data = null;
    this.room = new THREE.Group(); this.furn = new THREE.Group(); this.scene.add(this.room, this.furn);
    this.avatar = new THREE.Group(); this.scene.add(this.avatar);
    this.ghost = null; this.hold = null; this.token = 0; this.sizeKey = '';
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this.controls.minAzimuthAngle = 0.05; this.controls.maxAzimuthAngle = Math.PI / 2 - 0.05;
    this.controls.minPolarAngle = 0.25; this.controls.maxPolarAngle = 1.38; this.controls.minDistance = 3;
    const dom = this.renderer.domElement;
    if (opt.interactive) {
      let down = null;
      dom.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
      dom.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) this.click(e); down = null; });
      dom.addEventListener('pointermove', (e) => this.hover(e));
    }
  }
  setItems(items) { this.items = items; }
  async setData(d) { // d: {cols, rows, house, worn, gender}
    this.data = d;
    const tk = ++this.token;
    this.buildRoom(d);
    // 家具
    const loaded = await Promise.all(d.house.placed.map(async (p, i) => {
      const it = this.items[p.id]; const o = await instance('/' + it.model).catch(() => null); return o && { p, i, o, it };
    }));
    if (tk !== this.token) return;
    this.furn.clear();
    const beds = d.house.placed.filter((p) => this.items[p.id].cat === 'bed');
    for (const x of loaded) {
      if (!x) continue;
      const root = new THREE.Group(); root.add(x.o); root.userData.index = x.i;
      root.position.set(x.p.x, this.elev(x.p, beds), x.p.z); root.rotation.y = x.p.rot * Math.PI / 2;
      this.furn.add(root);
    }
    // 角色（站在房間前方角落）
    const av = await buildAvatar(d.gender, d.worn, this.items);
    if (tk !== this.token) return;
    this.avatar.clear(); av.position.set(d.cols / 2 - 0.6, 0, d.rows / 2 - 0.6); av.rotation.y = -0.5; this.avatar.add(av);
  }
  elev(p, beds) { // 床墊疊在床板上
    if (this.items[p.id].cat !== 'mattress') return 0;
    return beds.some((b) => Math.abs(b.x - p.x) < 0.9 && Math.abs(b.z - p.z) < 1.1) ? 0.3 : 0;
  }
  buildRoom(d) {
    const key = [d.cols, d.rows, d.house.wall, d.house.carpet].join('|');
    if (key === this.sizeKey) return;
    const resize = this.sizeKey.split('|').slice(0, 2).join('|') !== key.split('|').slice(0, 2).join('|');
    this.sizeKey = key;
    this.room.clear();
    const W = d.cols, D = d.rows, H = WALL_H;
    const wallTex = d.house.wall ? this.items[d.house.wall].tex : null, carpTex = d.house.carpet ? this.items[d.house.carpet].tex : null;
    const wm = (rx, ry) => (wallTex ? new THREE.MeshStandardMaterial({ map: texture(wallTex, rx, ry), roughness: 0.9 }) : new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.95 }));
    const floorMat = carpTex ? new THREE.MeshStandardMaterial({ map: texture(carpTex, W / 1.2, D / 1.2), roughness: 1 }) : new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; this.room.add(floor);
    if (!carpTex) { // 木地板線條
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(Array.from({ length: Math.floor(D / 0.3) + 1 }, (_, i) => [new THREE.Vector3(-W / 2, 0.002, -D / 2 + i * 0.3), new THREE.Vector3(W / 2, 0.002, -D / 2 + i * 0.3)]).flat()), new THREE.LineBasicMaterial({ color: 0x8c6a4c })); this.room.add(lines);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.25, D + 0.5), new THREE.MeshStandardMaterial({ color: 0x2b2d42 })); slab.position.y = -0.126; slab.receiveShadow = true; this.room.add(slab);
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, H, 0.14), wm(W / 1.2, H / 1.2)); back.position.set(-0.07 * 0, H / 2, -D / 2 - 0.07); back.receiveShadow = true; back.castShadow = true; this.room.add(back);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.14, H, D), wm(D / 1.2, H / 1.2)); left.position.set(-W / 2 - 0.07, H / 2, 0); left.receiveShadow = true; left.castShadow = true; this.room.add(left);
    const trimM = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.03), trimM); t1.position.set(0, 0.05, -D / 2 + 0.015); this.room.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, D), trimM); t2.position.set(-W / 2 + 0.015, 0.05, 0); this.room.add(t2);
    // 窗戶（後牆）
    const win = new THREE.Group(); const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.06), trimM); const glass = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.96, 0.07), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6fb7e8, emissiveIntensity: 0.5, roughness: 0.2 }));
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.96, 0.08), trimM), cross2 = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 0.08), trimM);
    win.add(frame, glass, cross1, cross2); win.position.set(W * 0.22, 1.6, -D / 2 + 0.03); this.room.add(win);
    if (resize) {
      const target = new THREE.Vector3(0, 0.8, 0), dist = Math.max(W, D) * 1.35 + 2.5;
      this.controls.target.copy(target); this.controls.maxDistance = dist * 2.2;
      this.camera.position.copy(target).add(new THREE.Vector3(0.62, 0.78, 1.0).normalize().multiplyScalar(dist));
    }
  }
  // ── 擺放互動 ──
  setHold(id, rot) { this.hold = id ? { id, rot: rot || 0 } : null; this.setGhost(); }
  async setGhost() {
    if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
    if (!this.hold) return;
    const tk = ++this.ghostTok; const id = this.hold.id;
    const o = await instance('/' + this.items[id].model);
    if (!this.hold || this.hold.id !== id || tk !== this.ghostTok) return;
    o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.72; m.castShadow = false; } });
    this.ghost = new THREE.Group(); this.ghost.add(o); this.ghost.visible = false; this.ghost.userData.mats = o; this.scene.add(this.ghost);
  }
  ghostTok = 0;
  pointer(e) { const r = this.renderer.domElement.getBoundingClientRect(); this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.mouse, this.camera); }
  floorPoint(e) { this.pointer(e); const floor = this.room.getObjectByName('floor'); if (!floor) return null; const h = this.ray.intersectObject(floor)[0]; return h ? h.point : null; }
  footprint(it, rot) { return rot % 2 ? [it.fp[1], it.fp[0]] : it.fp; }
  snap(pt, it, rot) {
    const [w, d] = this.footprint(it, rot), { cols, rows } = this.data;
    const q = (v) => Math.round(v / 0.25) * 0.25;
    return { x: Math.max(-cols / 2 + w / 2, Math.min(cols / 2 - w / 2, q(pt.x))), z: Math.max(-rows / 2 + d / 2, Math.min(rows / 2 - d / 2, q(pt.z))) };
  }
  valid(id, x, z, rot) {
    const it = this.items[id], [w, d] = this.footprint(it, rot);
    return !this.data.house.placed.some((o) => { const oi = this.items[o.id]; if (oi.layer !== it.layer) return false; const [ow, od] = this.footprint(oi, o.rot); return Math.abs(x - o.x) < (w + ow) / 2 - 1e-6 && Math.abs(z - o.z) < (d + od) / 2 - 1e-6; });
  }
  hover(e) {
    if (!this.hold || !this.ghost || !this.data) return;
    const pt = this.floorPoint(e); if (!pt) { this.ghost.visible = false; return; }
    const it = this.items[this.hold.id], s = this.snap(pt, it, this.hold.rot), ok = this.valid(this.hold.id, s.x, s.z, this.hold.rot);
    const beds = this.data.house.placed.filter((p) => this.items[p.id].cat === 'bed');
    this.ghost.position.set(s.x, this.elev({ id: this.hold.id, ...s }, beds), s.z); this.ghost.rotation.y = this.hold.rot * Math.PI / 2; this.ghost.visible = true;
    this.ghost.userData.mats.traverse((m) => { if (m.isMesh) { m.material.emissive = new THREE.Color(ok ? 0x0a5a1a : 0x7a1010); m.material.emissiveIntensity = 0.6; } });
    this.ghost.userData.ok = ok; this.ghost.userData.pos = s;
  }
  click(e) {
    if (!this.data) return;
    if (this.hold) {
      this.hover(e);
      if (this.ghost && this.ghost.visible && this.ghost.userData.ok) this.opt.onPlace && this.opt.onPlace({ id: this.hold.id, ...this.ghost.userData.pos, rot: this.hold.rot });
      else this.opt.onInvalid && this.opt.onInvalid();
      return;
    }
    this.pointer(e);
    const hits = this.ray.intersectObjects(this.furn.children, true);
    if (hits.length) { let o = hits[0].object; while (o && o.userData.index === undefined) o = o.parent; if (o) this.opt.onPick && this.opt.onPick(o.userData.index); }
  }
}

// ───── 縮圖 ─────
let thumbR, thumbScene, thumbCam;
const thumbCache = new Map(); let chain = Promise.resolve();
async function renderThumb(url) {
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); thumbR.setSize(176, 176); thumbR.setPixelRatio(1);
    thumbScene = new THREE.Scene(); addLights(thumbScene, false); thumbCam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  }
  const o = await instance(url); thumbScene.add(o);
  const box = new THREE.Box3().setFromObject(o), sph = box.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(0.75, 0.55, 1).normalize(), dist = (sph.radius / Math.sin((32 * Math.PI) / 360)) * 1.02;
  thumbCam.position.copy(sph.center).addScaledVector(dir, dist); thumbCam.lookAt(sph.center);
  thumbR.render(thumbScene, thumbCam);
  const data = thumbR.domElement.toDataURL('image/png');
  thumbScene.remove(o);
  return data;
}
export function thumb(it) {
  if (it.tex) return Promise.resolve('/' + it.tex);
  if (!thumbCache.has(it.id)) { const p = (chain = chain.then(() => renderThumb('/' + it.model)).catch(() => '')); thumbCache.set(it.id, p); }
  return thumbCache.get(it.id);
}
export function hydrateThumbs(root, items) {
  root.querySelectorAll('img[data-thumb]').forEach((img) => { const it = items[img.dataset.thumb]; if (it) thumb(it).then((src) => { if (src) img.src = src; }); });
}
