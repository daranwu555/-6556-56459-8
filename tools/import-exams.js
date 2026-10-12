// 把「考古題」文字檔轉成題庫 JSON（放進 data/questions/ 即可被遊戲載入）
// 用法：
//   pdftotext -layout 試題.pdf 試題.txt ; pdftotext -layout 答案.pdf 答案.txt
//   node tools/import-exams.js 試題.txt 答案.txt --cat 國文 --src "112學測國文" [--out data/questions/112-chinese.json]
// 支援：題號「1.」「1、」「１．」；選項「(A)」「A.」「Ａ」；答案「1 A 2 C…」或「題號 1 2 3 / 答案 A B C」兩種格式。
const fs = require('fs'), path = require('path');
const FW = { 'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E' };
const norm = (t) => t.replace(/[Ａ-Ｅ]/g, (c) => FW[c]).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/\r/g, '');

function parseAnswers(txt) {
  const key = {};
  txt = norm(txt);
  // 格式一：成對 "12 B"
  for (const m of txt.matchAll(/(?:^|\s)(\d{1,3})\s*[:：.)、-]?\s*([A-E])(?=\s|$)/g)) key[+m[1]] = m[2];
  // 格式二：表格兩列（題號列 + 答案列）
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const nums = lines[i].match(/\b\d{1,3}\b/g), ans = lines[i + 1].match(/\b[A-E]\b/g);
    if (nums && ans && (nums.length >= 3 || /題號/.test(lines[i])) && nums.length === ans.length && /題號|^\s*\d/.test(lines[i])) nums.forEach((n, k) => { key[+n] = ans[k]; });
  }
  return key;
}
function parseQuestions(txt) {
  txt = norm(txt);
  const parts = txt.split(/\n\s*(?=\d{1,3}\s*[.、．])/);
  const out = [];
  for (const part of parts) {
    const m = part.match(/^\s*(\d{1,3})\s*[.、．]\s*([\s\S]*)$/);
    if (!m) continue;
    const body = m[2].replace(/\s*\n\s*/g, ' ').trim();
    const opts = body.split(/\s*[\(（]?([A-E])[\)）.．、]\s*/);
    if (opts.length < 9) continue; // 至少要有 A~D 四個選項：['題幹','A','xx','B','xx','C','xx','D','xx']
    const stem = opts[0].trim(), choice = {};
    for (let i = 1; i + 1 < opts.length; i += 2) choice[opts[i]] = opts[i + 1].trim();
    if (stem && ['A', 'B', 'C', 'D'].every((k) => choice[k])) out.push({ n: +m[1], stem, choice });
  }
  return out;
}
function main() {
  const args = process.argv.slice(2);
  const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const [qf, af] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  if (!qf || !af) { console.error('用法：node tools/import-exams.js 試題.txt 答案.txt --cat 分類 --src 來源'); process.exit(1); }
  const cat = get('--cat') || '考古題', src = get('--src') || '考古題';
  const qs = parseQuestions(fs.readFileSync(qf, 'utf8')), key = parseAnswers(fs.readFileSync(af, 'utf8'));
  const rows = [];
  for (const q of qs) {
    const k = key[q.n]; if (!k || !q.choice[k]) continue;
    rows.push({ c: cat, q: q.stem, a: q.choice[k], w: ['A', 'B', 'C', 'D'].filter((x) => x !== k).map((x) => q.choice[x]), src });
  }
  const out = get('--out') || path.join('data', 'questions', path.basename(qf, path.extname(qf)) + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`解析 ${qs.length} 題、答案 ${Object.keys(key).length} 筆 → 輸出 ${rows.length} 題：${out}`);
}
if (require.main === module) main();
module.exports = { parseQuestions, parseAnswers };
