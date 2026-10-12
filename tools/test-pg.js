const { newDb } = require('pg-mem');
const { pgStorage } = require('../storage.js');
const { createGame } = require('../core.js');
const crypto = require('crypto');
(async () => {
  const db = newDb(); const { Pool } = db.adapters.createPg(); const pool = new Pool();
  const mk = async () => pgStorage(pool);
  const env = (storage) => ({ storage, hashPw: (p, s) => crypto.scryptSync(p, s, 32).toString('hex'), randomHex: (n) => crypto.randomBytes(n).toString('hex'), safeEqual: (a, b) => a === b });
  // 第一次：註冊並買地
  let st = await mk(), game = createGame(env(st)); const out = [];
  let c = game.connect({ out: (o) => out.push(o), alive: () => true });
  c.message({ t: 'register', username: 'pguser', password: 'secret1', name: '資料庫', gender: 'f' });
  c.message({ t: 'cityBuyLand', i: 8 });
  await new Promise((r) => setTimeout(r, 1500)); await st.drain();
  // 第二次：模擬伺服器重啟
  st = await mk(); game = createGame(env(st)); const out2 = [];
  c = game.connect({ out: (o) => out2.push(o), alive: () => true });
  c.message({ t: 'login', username: 'pguser', password: 'secret1' });
  const w = out2.find((o) => o.t === 'welcome');
  console.log('restart login ->', w ? 'welcome' : JSON.stringify(out2[0]), '| lot 8 owned:', w && w.p.city.lots[8].owned, '| money', w && w.p.money);
  process.exit(0);
})();
