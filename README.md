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
| `public/models/wear/*.glb` | 服飾 30 件＋初始服裝 4 件（頭飾、套裝、上衣、下裝、鞋子），與角色本體共用座標，可疊穿 |
| `public/models/material/*.glb` | 建材 5 種 |
| `public/models/body_*.glb`、`hair_*.glb`、`hairtop_*.glb` | 男／女角色本體（五官、手指）、髮型（武俠風）、髮髻（戴頭飾時隱藏） |
| `public/models/wear/*_start_*.glb` | 初始服裝：武俠長袍、布靴、襦裙、繡花鞋 |
| `public/textures/*.png` | 牆壁、地毯材質（128×128，可重複貼圖） |
| `/models.html` | 模型庫：預覽所有模型並下載 `.glb` |

全部是 glTF 2.0（.glb），Blender / Unity / Godot / Three.js 都能直接開。
這些模型由 `tools/make-assets.js` 程式生成（`npm run assets` 重新產生）；若你有美術，可直接用同名 `.glb` 檔覆蓋，遊戲不用改程式（模型原點在底部中心、面向 +Z、單位公尺）。

## 玩法重點
- 帳號登入（密碼 scrypt 雜湊），資料存在伺服器。註冊時取名免費，**改名要 100,000 元**（更衣室頁面）。
- 角色有**初始服裝**（武俠長袍＋布靴／襦裙＋繡花鞋），註冊時免費配發，可隨時換回。
- 問答：10 題、參加費 50。**所有問答題都會自動變成四選一**，**錯誤選項有 60% 機率換成搞笑選項**（`FUNNY_RATE` 環境變數可調，0 = 不搞笑）。
- **連答倍率**：預設 ×1.2。**新手（Lv ≤ 15）遇到老手（Lv ≥ 16）時，新手的倍率才變 ×1.6**；雙方都是新手、或對戰電腦，一律 ×1.2。
- **按讚**：按讚的人 +5 元（每人只能讚同一玩家一次；每天最多領 20 次獎勵）。
- 倉庫放建材 50 格，每升級 +5；房屋擴建要金錢 + 建材。賣出價 35%。
- 每件商品有持有上限：服飾 1、牆壁/地毯 2、家具 3、擺飾 5、建材 30。
- 房屋風格 ≥80% 且 ≥6 件，答題金錢 +5%。

## 題庫（1,076 題）
- 手寫選擇題與問答題 754 題（地理、天文、歷史、會計、護理、科學、生物、生活常識、體育、文學藝術、科技、國文、社會、英文），程式生成的數學計算題 322 題（答案由程式計算，保證正確）。
- **這些題目不是從網路抓來的考古題**（開發環境的網路政策擋住了考試單位網站）。要匯入真正的考古題請看下一節。
- 全部題庫可下載：`downloads/question-bank.csv`、`question-bank.json`（`node tools/export-bank.js` 重新匯出）。
- 沒有選項的題目，系統用同類答案自動出干擾選項，並混入搞笑選項。

### 匯入考古題
1. 從考試單位下載試題與答案 PDF，轉成文字：`pdftotext -layout 試題.pdf 試題.txt`、`pdftotext -layout 答案.pdf 答案.txt`
2. `node tools/import-exams.js 試題.txt 答案.txt --cat 國文 --src "112學測國文"` → 產生 `data/questions/*.json`，重啟伺服器即載入。
3. 另可直接放 JSON/CSV 到 `data/questions/`（CSV 欄位：`分類|標籤,題目,答案[,錯1,錯2,錯3]`）。
> 各單位對試題轉載的授權規定不同，營運前請自行確認。

## 其他
- `Dockerfile`：部署用（掛載 `/data`，主機需支援 WebSocket）。
- Three.js 是複製進 `public/vendor/three`（MIT 授權）。
- 重新產生 3D 模型：`npm run assets`（角色在 `tools/character.js`，家具與服飾在 `tools/make-assets.js`）。
