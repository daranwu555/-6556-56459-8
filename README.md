# 小屋大亨 — 問答賺錢蓋房子

答題賺錢 → 建倉庫/商店 → 買服飾與家具 → 佈置房屋。

## 執行
```bash
npm install
npm start          # 預設 http://localhost:3000（PORT 可用環境變數改）
```
多人連線：同一個網址開兩個瀏覽器分頁/裝置即可「線上配對」；10 秒內沒有真人就由電腦頂替。

## 檔案
- `server.js` 伺服器（WebSocket），數值參數在最上方 `CFG`
- `questions.js` 題庫（手寫題 + 程式生成題 + 匯入 `data/questions/*.json`）
- `catalog.js` 商品目錄（服飾/家具 × 冷酷/可愛/逗趣）
- `public/index.html` 前端
- 玩家存檔：`data/players.json`

## 匯入大量題庫
放 JSON 到 `data/questions/`，格式：
`[{"c":"地理","q":"題目","a":"正解","w":["錯1","錯2","錯3"]}]`
