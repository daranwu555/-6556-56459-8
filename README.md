# 小屋大亨 — 問答賺錢蓋房子（3D 版）

答題賺錢 → 買建材擴建房屋 → 買服飾與家具 → 在 **3D 房間**自由擺放 → 更衣室試穿 → 拜訪/按讚/排行。

## 執行
```bash
npm install
npm start          # 預設 http://localhost:3000（PORT 可改）
```
需要 Node 22+（內建 `node:sqlite`）。存檔在 `data/game.db`（`DATA_DIR` 可改）。
測試用：`START_MONEY=30000 npm start` 可調整初始金額。

## 3D 素材（檔案都在 repo 裡）
| 位置 | 內容 |
|---|---|
| `public/models/furniture/*.glb` | 家具 42 件（桌椅、床板、床墊、電腦、電視、衣櫃、擺飾） |
| `public/models/wear/*.glb` | 服飾 30 件（頭飾、套裝、上衣、下裝、鞋子），與角色本體共用座標，可疊穿 |
| `public/models/material/*.glb` | 建材 5 種 |
| `public/models/body_m.glb`、`body_f.glb` | 男／女角色本體 |
| `public/textures/*.png` | 牆壁、地毯材質（128×128，可重複貼圖） |
| `/models.html` | 模型庫：預覽所有模型並下載 `.glb` |

全部是 glTF 2.0（.glb），Blender / Unity / Godot / Three.js 都能直接開。
這些模型由 `tools/make-assets.js` 程式生成（`npm run assets` 重新產生）；若你有美術，可直接用同名 `.glb` 檔覆蓋，遊戲不用改程式（模型原點在底部中心、面向 +Z、單位公尺）。

## 玩法重點
- 帳號登入（密碼 scrypt 雜湊），資料存在伺服器。
- 問答：10 題、參加費 50。**所有問答題都會自動變成四選一**（`questions.js`）。
- **新手（Lv ≤ 15）連答倍率 ×1.6（+60%），老手 ×1.2（+20%）**；新手可和任何人對戰。
- 倉庫放建材 50 格，每升級 +5；房屋擴建要金錢 + 建材。賣出價 35%。
- **每件商品有持有上限**：服飾 1、牆壁/地毯 2、家具 3、擺飾 5、建材 30。
- 房屋風格 ≥80% 且 ≥6 件，答題金錢 +5%。
- **排行榜按讚：被按讚的玩家 +5 元**（每人只能讚一次）。
- 房屋是 3D 自由擺放（0.25 公尺對齊、可旋轉 90°、不可重疊、不可超出牆）。

## 題庫
- `questions.js`：手寫選擇題 + 程式生成題；`qbank_open.js`：只有「題目＋答案」的問答題。
- 沒有選項的題目，系統用同類答案自動出干擾選項（人物配人物、年份配相近年份、數字配相近數字…）。
- 匯入大量題庫：放進 `data/questions/`
  - JSON：`[{"c":"歷史","t":"人物","q":"題目","a":"答案"}]`
  - CSV：`分類|標籤,題目,答案[,錯1,錯2,錯3]`（錯誤選項可省略）

## 其他
- `Dockerfile`：部署用（掛載 `/data`，主機需支援 WebSocket）。
- Three.js 是複製進 `public/vendor/three`（MIT 授權）。
