// 英文單字（國中基礎字彙）：每筆「英文 中文」→ 題目「X 的中文意思是？」
const WORDS = `apple 蘋果|banana 香蕉|orange 柳橙|grape 葡萄|watermelon 西瓜|strawberry 草莓|pineapple 鳳梨|mango 芒果|lemon 檸檬|peach 水蜜桃|
cat 貓|dog 狗|bird 鳥|fish 魚|rabbit 兔子|tiger 老虎|lion 獅子|elephant 大象|monkey 猴子|horse 馬|
cow 乳牛|pig 豬|sheep 綿羊|duck 鴨子|chicken 雞|mouse 老鼠|snake 蛇|frog 青蛙|bear 熊|turtle 烏龜|
red 紅色|blue 藍色|green 綠色|yellow 黃色|black 黑色|white 白色|pink 粉紅色|purple 紫色|brown 棕色|gray 灰色|
father 爸爸|mother 媽媽|brother 兄弟|sister 姊妹|grandfather 祖父|grandmother 祖母|uncle 叔叔|aunt 阿姨|cousin 堂表親|baby 嬰兒|
teacher 老師|student 學生|doctor 醫生|nurse 護理師|farmer 農夫|driver 司機|police officer 警察|singer 歌手|dentist 牙醫|chef 廚師|
school 學校|hospital 醫院|library 圖書館|restaurant 餐廳|park 公園|station 車站|airport 機場|bank 銀行|market 市場|museum 博物館|
book 書|pencil 鉛筆|eraser 橡皮擦|ruler 尺|notebook 筆記本|desk 書桌|chair 椅子|bag 書包|clock 時鐘|window 窗戶|
bread 麵包|rice 米飯|noodles 麵條|milk 牛奶|egg 蛋|cheese 起司|soup 湯|salad 沙拉|cake 蛋糕|juice 果汁|
happy 快樂的|sad 悲傷的|angry 生氣的|tired 疲倦的|hungry 飢餓的|thirsty 口渴的|afraid 害怕的|excited 興奮的|bored 無聊的|sleepy 想睡的|
big 大的|small 小的|tall 高的|short 矮的|long 長的|fast 快的|slow 慢的|hot 熱的|cold 冷的|new 新的|
old 老的|young 年輕的|clean 乾淨的|dirty 髒的|heavy 重的|light 輕的|easy 容易的|difficult 困難的|beautiful 美麗的|strong 強壯的|
run 跑|walk 走|jump 跳|swim 游泳|sing 唱歌|dance 跳舞|read 閱讀|write 寫|listen 聽|speak 說|
eat 吃|drink 喝|sleep 睡覺|wash 洗|cook 煮|buy 買|sell 賣|open 打開|close 關上|study 讀書|
morning 早晨|afternoon 下午|evening 傍晚|night 夜晚|today 今天|tomorrow 明天|yesterday 昨天|week 星期|month 月|year 年|
Monday 星期一|Tuesday 星期二|Wednesday 星期三|Thursday 星期四|Friday 星期五|Saturday 星期六|Sunday 星期日|spring 春天|summer 夏天|autumn 秋天|winter 冬天|
sunny 晴朗的|rainy 下雨的|cloudy 多雲的|windy 有風的|snowy 下雪的|mountain 山|river 河|ocean 海洋|forest 森林|
computer 電腦|telephone 電話|television 電視|camera 相機|bicycle 腳踏車|train 火車|airplane 飛機|bus 公車|boat 船|taxi 計程車|
friend 朋友|family 家庭|country 國家|city 城市|village 村莊|street 街道|bridge 橋|garden 花園|kitchen 廚房|bedroom 臥室|
language 語言|question 問題|answer 答案|problem 難題|idea 想法|dream 夢想|story 故事|music 音樂|movie 電影|picture 圖片|
health 健康|medicine 藥|fever 發燒|headache 頭痛|cough 咳嗽|exercise 運動|vegetable 蔬菜|fruit 水果|money 金錢|price 價格|
environment 環境|pollution 污染|recycle 回收|energy 能源|weather 天氣|earthquake 地震|typhoon 颱風|volcano 火山|island 島嶼|desert 沙漠`;
// 依主題分組（每一行是同一主題）→ 干擾選項只會出現同主題的中文（顏色配顏色、動物配動物…）
const TAGS = ['食物水果', '動物', '動物', '顏色', '家人', '職業', '地點', '文具', '食物水果', '形容詞', '形容詞', '形容詞', '動詞', '動詞', '時間', '時間', '自然', '器具交通', '生活名詞', '生活名詞', '生活名詞', '自然'];
const rows = [];
WORDS.split('\n').forEach((line, li) => {
  line.split('|').map((x) => x.trim()).filter(Boolean).forEach((s) => {
    const sp = s.search(/ [^\x00-\x7F]/); // 第一個接中文的空白
    rows.push([`英文|${TAGS[li] || '單字'}`, `英文單字「${s.slice(0, sp)}」的中文意思是？`, s.slice(sp + 1)]);
  });
});
module.exports = rows;
