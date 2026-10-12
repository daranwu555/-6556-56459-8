# 產生 downloads/house-quiz-game.zip（含 ws，不需 npm install）
import os, zipfile
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
root = os.path.abspath(root)
out = os.path.join(root, 'downloads', 'house-quiz-game.zip')
os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.exists(out): os.remove(out)
top = 'house-quiz-game'
files = ['server.js', 'catalog.js', 'questions.js', 'funny.js', 'qbank_open.js', 'qbank_more.js', 'qbank_vocab.js', 'qbank_brain.js', 'qbank_phil.js', 'core.js', 'storage.js', 'minigames.js', 'qgroups.js', 'qbank_wrong.js', 'qbank_lyrics.js', 'qbank_songs.js', 'render.yaml', 'DEPLOY.md', 'package.json', 'package-lock.json', 'README.md', 'Dockerfile', '.dockerignore']
dirs = ['public', 'qdata', 'src', 'tools', 'templates', 'downloads/question-bank.csv']

BAT_HEAD = '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\ntitle 小屋大亨\r\nwhere node >nul 2>nul\r\nif errorlevel 1 (\r\n  echo [錯誤] 找不到 Node.js。\r\n  echo 請先安裝 Node.js（LTS 版）：https://nodejs.org ，安裝完成後重新雙擊本檔案。\r\n  start https://nodejs.org\r\n  pause\r\n  exit /b 1\r\n)\r\necho 目前的 Node.js 版本：\r\nnode -v\r\n'
BAT_TAIL = 'set OPEN_BROWSER=1\r\nnode server.js\r\necho.\r\necho 伺服器已停止。如果一開始就停止，請把上面的紅字錯誤訊息截圖給我。\r\npause\r\n'
scripts = {
    'start.bat': BAT_HEAD + BAT_TAIL,
    'start-test.bat': BAT_HEAD + 'set START_MONEY=500000\r\necho 測試模式：新帳號起始金額 500,000 元\r\n' + BAT_TAIL,
    'start.sh': '#!/bin/bash\ncd "$(dirname "$0")"\nif ! command -v node >/dev/null; then echo "找不到 Node.js，請先安裝：https://nodejs.org"; exit 1; fi\nnode -v\nOPEN_BROWSER=1 node server.js\n',
    'start-test.sh': '#!/bin/bash\ncd "$(dirname "$0")"\nif ! command -v node >/dev/null; then echo "找不到 Node.js，請先安裝：https://nodejs.org"; exit 1; fi\nexport START_MONEY=500000\necho "測試模式：新帳號起始金額 500,000 元"\nOPEN_BROWSER=1 node server.js\n',
    'start.command': '#!/bin/bash\ncd "$(dirname "$0")"\nif ! command -v node >/dev/null; then echo "找不到 Node.js，請先安裝：https://nodejs.org"; read -p "按 Enter 結束"; exit 1; fi\nnode -v\nOPEN_BROWSER=1 node server.js\nread -p "伺服器已停止，按 Enter 結束"\n',
}
readme = '''小屋大亨 — 測試版（古代武俠 Q 版・3D 房屋・答題問答）
================================================

【最簡單：單機版】不用安裝任何東西
  雙擊「小屋大亨(單機版).html」，用 Chrome / Edge 開啟即可遊玩（對戰電腦、換裝、蓋房、排行榜皆可；存檔在瀏覽器裡）。
  單機版沒有「線上配對／好友對戰」。要多人連線才需要下面的 Node.js 伺服器版。

【伺服器版（可多人連線，需要安裝 Node.js）】

【需要】Node.js 18 以上（https://nodejs.org 下載 LTS 版）。不需要另外安裝套件（已附 ws）。
        Node 22 以上用內建 SQLite 存檔；較舊版本會自動改用 JSON 檔存檔，功能相同。

【啟動】
  Windows：雙擊 start.bat（測試模式：start-test.bat，新帳號有 50 萬元）
  Mac：    雙擊 start.command（第一次可能要在終端機執行 chmod +x start.command）
  Linux：  ./start.sh
  啟動成功時視窗會顯示「遊戲已啟動」和網址，瀏覽器會自動開啟；沒開的話手動輸入視窗裡顯示的網址。

【如果連不上】
  1. 看啟動視窗有沒有「遊戲已啟動」。沒有的話，視窗上的錯誤訊息就是原因（請截圖給我）。
  2. 視窗一閃就消失：請改用「命令提示字元」進入這個資料夾，輸入 node server.js 看錯誤。
  3. 視窗顯示的網址埠號不一定是 3000（3000 被占用時會自動改成 3001…），請以視窗顯示的為準。
  4. 瀏覽器請用 Chrome / Edge / Firefox 最新版（需要 WebGL 才能顯示 3D）。
  5. Windows 防火牆跳出詢問時，選「允許」（只有要讓別台電腦連進來時才需要）。

【測試重點】
  1. 註冊帳號 → 選男/女、取名 → 看到 Q 版角色與初始服裝（更衣室可 360° 旋轉）
  2. 商店：買家具、牆壁、地毯、建材（每件有持有上限）→ 回「自宅」用滑鼠擺放；服飾只在「更衣室」販售
  2.5 城市：先買一塊地（300 元）→ 蓋住宅（收租）或商業建築（商店、餐廳、學校、按摩店、KTV、診所、公司、百貨）
      → 商業建築要到「人才市場」雇用管理者才有產值 → 定時回來「收取」。想快速測試，勾選「測試加速」（1 分鐘＝1 小時）
  2.6 遊樂場：問答對戰、猜歌詞對戰、踩地雷、記憶翻牌、猜數字
  3. 連線問答：
     - 單人測試：按「對戰電腦」
     - 雙人測試：用兩個瀏覽器分頁（或同一個 Wi-Fi 的兩台電腦，網址用視窗裡的「區網」那一行）各註冊一個帳號，
       輸入相同「邀請碼」按「好友對戰」，或都按「線上配對」
     - 新手（Lv≤15）遇到老手（Lv≥16）才會有 ×1.6；要測這個請用兩個等級不同的帳號
       （測試用：先設定環境變數 START_LEVEL=20 啟動並建立一個老手帳號，之後再正常啟動建立新手帳號）
  4. 排行榜：兩個帳號互相按讚（按讚的人 +5 元，每天最多 5 次）
  5. 更衣室：試穿未購買的服飾、改名（需要 10 萬元，測試模式才有足夠金錢）

【檔案】
  public/models/、public/textures/   3D 模型與材質（.glb / .png）
  downloads/question-bank.csv        題庫（共 1,042 題，可用 Excel 開）
  存檔：data/ 資料夾（刪掉整個 data 資料夾即可重置所有帳號）

【可調整】見 server.js 最上方 CFG（金額、倍率、倉庫、擴建…），搞笑選項比例用環境變數 FUNNY_RATE（0~1）。
'''
z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
for f in files: z.write(os.path.join(root, f), f'{top}/{f}')
for d in dirs:
    full = os.path.join(root, d)
    if os.path.isfile(full): z.write(full, f'{top}/{d}'); continue
    for dp, _, fs in os.walk(full):
        for f in fs:
            p = os.path.join(dp, f); z.write(p, f'{top}/' + os.path.relpath(p, root))
for dp, _, fs in os.walk(os.path.join(root, 'node_modules', 'ws')):
    for f in fs:
        p = os.path.join(dp, f); z.write(p, f'{top}/' + os.path.relpath(p, root))
for name, txt in scripts.items():
    zi = zipfile.ZipInfo(f'{top}/{name}'); zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = (0o755 | 0o100000) << 16
    z.writestr(zi, txt.encode('utf8'))
z.writestr(f'{top}/測試說明.txt', readme.encode('utf8'))
sa = os.path.join(root, 'dist', '小屋大亨.html')
if os.path.exists(sa): z.write(sa, f'{top}/小屋大亨(單機版).html')
z.close()
print(os.path.getsize(out) // 1024, 'KB')
