# 免費部署說明

兩種方式，依需求選一種（或兩種都做）。

## A. GitHub Pages：免費、永久、免伺服器（單機版）
適合：自己玩、給朋友試玩。每個人的存檔放在自己的瀏覽器裡，沒有線上配對／好友對戰。

1. 到 GitHub 的這個 repo → **Settings → Pages**
2. **Source** 選 *Deploy from a branch*；**Branch** 選要發布的分支（合併到 `main` 後選 `main`，或直接選目前的開發分支），**Folder** 選 `/docs`，按 Save
3. 等 1～2 分鐘，網址會是 `https://<你的帳號>.github.io/<repo 名稱>/`
4. 之後更新遊戲：執行 `npm run build`（會重新產生 `docs/index.html`），commit 並 push 即可

## B. Render 免費方案：可多人連線（線上配對、好友對戰、排行榜）
適合：真的要讓朋友一起連線玩。需要兩個免費服務：**Render**（跑伺服器）＋ **Neon**（存玩家資料；Render 免費主機的磁碟重啟後會清空，所以存檔一定要放外部資料庫）。

### 1. 建立免費資料庫（Neon）
1. 到 https://neon.tech 註冊 → Create project
2. 複製 **Connection string**（長得像 `postgresql://user:pass@xxx.neon.tech/neondb?sslmode=require`）

### 2. 部署到 Render
1. 到 https://render.com 註冊並連結你的 GitHub
2. **New → Blueprint** → 選這個 repo（它會讀取 `render.yaml`）
3. 出現 `DATABASE_URL` 欄位時，貼上剛剛的 Neon 連線字串，按 Apply
4. 部署完成後會得到 `https://xxxx.onrender.com`，用瀏覽器開就能玩；把網址給朋友即可連線對戰

### 注意
- Render 免費方案閒置 15 分鐘會休眠，第一位進站的人要等約 30～60 秒喚醒；頁面會自動重新連線。
- 玩家資料每秒寫回資料庫；伺服器重啟不會掉帳號、金錢、房屋、城市。
- 進行到一半的對戰在伺服器休眠或重啟時會中斷。
- 免費方案的額度與政策會變動，請以 Render / Neon 官方網站為準。
- 本專案的資料庫存取已用 `npm run test:pg`（以 pg-mem 模擬 Postgres）驗證「寫入 → 重啟 → 讀回」；實際雲端部署我沒有辦法在開發環境測試（環境擋住外部網路）。

## 其他環境
- 任何能跑 Node.js 18+ 且支援 WebSocket 的主機（VPS、Railway、Koyeb、Fly.io…）：`npm install --omit=dev && node server.js`，環境變數 `PORT`、`DATABASE_URL`（選用）。
- Docker：`docker build -t hq . && docker run -p 3000:3000 -e DATABASE_URL=... hq`
- 沒有設定 `DATABASE_URL` 時，會在 `data/` 資料夾用 SQLite 或 JSON 檔存檔（本機測試用）。
