// 把整個題庫匯出成 CSV（Excel 可開）與 JSON → downloads/
const fs = require('fs'), path = require('path');
const { allItems } = require('../questions');
const dir = path.join(__dirname, '..', 'downloads'); fs.mkdirSync(dir, { recursive: true });
const items = allItems();
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const rows = [['分類', '標籤', '題目', '答案', '指定錯誤選項1', '指定錯誤選項2', '指定錯誤選項3', '來源'].map(esc).join(',')];
for (const it of items) rows.push([it.c, it.t, it.q, it.a, ...(it.w || ['', '', '']).slice(0, 3), it.src].map(esc).join(','));
fs.writeFileSync(path.join(dir, 'question-bank.csv'), '﻿' + rows.join('\n'));
fs.writeFileSync(path.join(dir, 'question-bank.json'), JSON.stringify(items.map(({ id, ...r }) => r), null, 1));
console.log('匯出題數：', items.length);
