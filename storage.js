// 存檔後端：SQLite（Node 22+）→ JSON 檔（較舊 Node）→ Postgres（設定 DATABASE_URL，適合免費雲端主機）
const fs = require('fs');
const path = require('path');
// ───────── 存檔：優先用 Node 內建 SQLite（Node 22+）；沒有就改用 JSON 檔（Node 16+ 皆可）─────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
function jsonStorage(file) {
  let data = { accounts: {}, qstats: {}, reports: [] }, need = false;
  try { data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (e) { /* 第一次啟動 */ }
  return {
    accounts: () => Object.entries(data.accounts).map(([username, profile]) => ({ username, profile })),
    qstats: () => Object.entries(data.qstats).map(([id, v]) => ({ id, n: v.n, c: v.c })),
    saveAccount(u, json) { data.accounts[u] = json; need = true; },
    saveQ(id, n, c) { data.qstats[id] = { n, c }; need = true; },
    report(r) { data.reports.push(r); need = true; },
    flush() { if (!need) return; need = false; fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file); },
  };
}
function sqliteStorage(file) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file);
  db.exec(`
CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, profile TEXT);
CREATE TABLE IF NOT EXISTS qstats(id TEXT PRIMARY KEY, n INTEGER, c INTEGER);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT, qid TEXT, q TEXT, reason TEXT, by TEXT, ts INTEGER);
`);
  const upAcc = db.prepare('INSERT INTO accounts(username, profile) VALUES(?,?) ON CONFLICT(username) DO UPDATE SET profile=excluded.profile');
  const upQ = db.prepare('INSERT INTO qstats(id,n,c) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET n=excluded.n, c=excluded.c');
  const rep = db.prepare('INSERT INTO reports(qid,q,reason,by,ts) VALUES(?,?,?,?,?)');
  return {
    accounts: () => db.prepare('SELECT username, profile FROM accounts').all(),
    qstats: () => db.prepare('SELECT id, n, c FROM qstats').all(),
    saveAccount: (u, json) => upAcc.run(u, json), saveQ: (id, n, c) => upQ.run(id, n, c),
    report: (r) => rep.run(r.qid, r.q, r.reason, r.by, r.ts), flush() {},
  };
}
// Postgres（免費主機如 Render 的磁碟不會保留，需把存檔放在外部資料庫，例如 Neon / Supabase 的免費方案）
async function pgStorage(pool) {
  const ensure = async (sql) => { try { await pool.query(sql); } catch (e) { if (!/not supported|already exists/i.test(e.message)) throw e; } }; // 資料表已存在時忽略
  await ensure('CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, profile TEXT)');
  await ensure('CREATE TABLE IF NOT EXISTS qstats(id TEXT PRIMARY KEY, n INTEGER, c INTEGER)');
  await ensure('CREATE TABLE IF NOT EXISTS reports(id SERIAL PRIMARY KEY, qid TEXT, q TEXT, reason TEXT, by TEXT, ts BIGINT)');
  const acc = (await pool.query('SELECT username, profile FROM accounts')).rows, qs = (await pool.query('SELECT id, n, c FROM qstats')).rows;
  let pa = new Map(), pq = new Map(), pr = [], chain = Promise.resolve();
  const run = async (A, Q, R) => {
    for (const [u, json] of A) await pool.query('INSERT INTO accounts(username, profile) VALUES($1,$2) ON CONFLICT (username) DO UPDATE SET profile = EXCLUDED.profile', [u, json]);
    for (const [id, v] of Q) await pool.query('INSERT INTO qstats(id, n, c) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET n = EXCLUDED.n, c = EXCLUDED.c', [id, v.n, v.c]);
    for (const r of R) await pool.query('INSERT INTO reports(qid, q, reason, by, ts) VALUES($1,$2,$3,$4,$5)', [r.qid, r.q, r.reason, r.by, r.ts]);
  };
  return {
    accounts: () => acc, qstats: () => qs,
    saveAccount: (u, json) => pa.set(u, json), saveQ: (id, n, c) => pq.set(id, { n, c }), report: (r) => pr.push(r),
    flush() { if (!pa.size && !pq.size && !pr.length) return; const A = pa, Q = pq, R = pr; pa = new Map(); pq = new Map(); pr = []; chain = chain.then(() => run(A, Q, R)).catch((e) => console.error('資料庫寫入失敗：', e.message)); },
    drain() { this.flush(); return chain; },
  };
}
async function openStorage() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '0' ? false : { rejectUnauthorized: false } });
    console.log('存檔：使用 Postgres（DATABASE_URL）');
    return pgStorage(pool);
  }
  try { if (process.env.NO_SQLITE) throw new Error('forced'); return sqliteStorage(path.join(DATA_DIR, 'game.db')); }
  catch (e) { console.log('提示：這個 Node 版本沒有內建 SQLite，改用 JSON 檔存檔（data/game.json）。'); return jsonStorage(path.join(DATA_DIR, 'game.json')); }
}


module.exports = { openStorage, pgStorage, jsonStorage, sqliteStorage };
