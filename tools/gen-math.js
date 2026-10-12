// 產生「數學／科學計算」題（答案由程式計算，保證正確）→ qdata/math.json
// 執行：node tools/gen-math.js
const fs = require('fs'), path = require('path');
let seed = 20241012;
const rnd = (n) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
const ri = (a, b) => a + rnd(b - a + 1);
const out = [], seen = new Set();
const add = (t, q, a) => { if (!seen.has(q)) { seen.add(q); out.push({ c: '數學', t, q, a: String(a) }); } };
const fmt = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));

for (let i = 0; i < 70; i++) { const a = ri(12, 99), b = ri(3, 9); add('數值', `${a} × ${b} = ？`, a * b); }
for (let i = 0; i < 40; i++) { const a = ri(120, 899), b = ri(110, 499); add('數值', i % 2 ? `${a} + ${b} = ？` : `${a + b} − ${b} = ？`, i % 2 ? a + b : a); }
for (let i = 0; i < 30; i++) { const base = ri(2, 20) * 10, p = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75][ri(0, 9)]; add('數值', `${base} 的 ${p}% 是多少？`, fmt((base * p) / 100)); }
for (let i = 0; i < 30; i++) { const w = ri(3, 25), h = ri(3, 25); add('數值', i % 2 ? `長 ${w} 公分、寬 ${h} 公分的長方形，面積是多少平方公分？` : `長 ${w} 公分、寬 ${h} 公分的長方形，周長是多少公分？`, i % 2 ? w * h : 2 * (w + h)); }
for (let i = 0; i < 30; i++) { const x = ri(2, 20), a = ri(2, 9), b = ri(1, 30); add('數值', `若 ${a}x + ${b} = ${a * x + b}，則 x = ？`, x); }
for (let i = 0; i < 20; i++) { const r = ri(2, 15); add('數值', `半徑 ${r} 公分的圓，面積約是多少平方公分？（π 取 3.14）`, fmt(3.14 * r * r)); }
for (let i = 0; i < 20; i++) { const k = ri(2, 90) / 10; add('數值', i % 2 ? `${k} 公里等於多少公尺？` : `${k} 公斤等於多少公克？`, fmt(k * 1000)); }
for (let i = 0; i < 20; i++) { const a = ri(1, 20), d = ri(2, 9), n = ri(8, 15); add('數值', `等差數列首項 ${a}、公差 ${d}，第 ${n} 項是多少？`, a + (n - 1) * d); }
for (let i = 0; i < 20; i++) { const s = ri(30, 120), t = ri(2, 6); add('數值', `汽車以時速 ${s} 公里行駛 ${t} 小時，共行駛幾公里？`, s * t); }
for (let i = 0; i < 20; i++) { const a = ri(2, 12); add('數值', `${a} 的平方是多少？`, a * a); }
for (let n = 12; n <= 96 && out.filter((o) => o.q.includes('正因數')).length < 15; n += 6) { let c = 0; for (let k = 1; k <= n; k++) if (n % k === 0) c++; add('數值', `${n} 的正因數共有幾個？`, c); }
const isPrime = (n) => { if (n < 2) return false; for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; };
for (const n of [20, 30, 40, 50, 60, 70, 80, 90, 100]) add('數值', `${n} 以內（含）的質數共有幾個？`, [...Array(n + 1).keys()].filter(isPrime).length);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
for (let i = 0; i < 12; i++) { const g = ri(2, 9), a = ri(2, 9), b = ri(2, 9); add('數值', `${g * a} 與 ${g * b} 的最大公因數是多少？`, gcd(g * a, g * b)); }
for (let i = 0; i < 20; i++) { const m = ri(5, 40), c = ri(2, 9); add('數值', `一包餅乾 ${m} 元，買 ${c} 包要付多少元？`, m * c); }
for (let i = 0; i < 10; i++) { const a = ri(30, 80), b = ri(30, 80), c = 180 - a - b; if (c > 5) add('數值', `三角形兩個內角分別是 ${a}° 與 ${b}°，第三個內角是幾度？`, c + '°'); }
fs.mkdirSync(path.join(__dirname, '..', 'qdata'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'qdata', 'math.json'), JSON.stringify(out, null, 0));
console.log('math 題數：', out.length);
