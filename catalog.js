// 商品目錄：服飾 + 家具，三種風格（冷酷 / 可愛 / 逗趣）
const STYLES = { cool: '冷酷', cute: '可愛', fun: '逗趣' };

const CATS = {
  head: { label: '頭飾', kind: 'wear' },
  suit: { label: '套裝', kind: 'wear' },
  top: { label: '上衣', kind: 'wear' },
  bottom: { label: '下裝', kind: 'wear' },
  shoes: { label: '鞋子', kind: 'wear' },
  wall: { label: '牆壁', kind: 'wall' },
  carpet: { label: '地毯', kind: 'floor' },
  table: { label: '桌椅', kind: 'furn' },
  bed: { label: '床板', kind: 'furn' },
  mattress: { label: '床墊', kind: 'furn' },
  pc: { label: '電腦', kind: 'furn' },
  tv: { label: '電視', kind: 'furn' },
  wardrobe: { label: '衣櫃', kind: 'furn' },
  decor: { label: '擺飾', kind: 'furn' },
  material: { label: '建材', kind: 'mat' },
};

// [名稱, emoji 或 CSS 背景, 價格]
const RAW = {
  head: {
    cool: [['黑色鴨舌帽', '🧢', 80], ['酷炫墨鏡', '🕶️', 120]],
    cute: [['小花冠', '🌸', 90], ['蝴蝶結', '🎀', 70]],
    fun: [['派對帽', '🥳', 60], ['小丑假髮', '🤡', 100]],
  },
  suit: {
    cool: [['黑色西裝', '🤵', 400], ['忍者裝', '🥷', 450]],
    cute: [['粉紅洋裝', '👗', 350], ['小熊連身裝', '🐻', 380]],
    fun: [['恐龍裝', '🦖', 420], ['獨角獸裝', '🦄', 420]],
  },
  top: {
    cool: [['皮外套', '🧥', 200], ['黑T恤', '👕', 100]],
    cute: [['蕾絲上衣', '👚', 150], ['愛心毛衣', '🧶', 180]],
    fun: [['功夫服', '🥋', 160], ['足球球衣', '🎽', 130]],
  },
  bottom: {
    cool: [['黑色牛仔褲', '👖', 140], ['破洞牛仔褲', '👖', 160]],
    cute: [['粉色短褲', '🩳', 110], ['蓬蓬裙', '👗', 130]],
    fun: [['海灘褲', '🩳', 90], ['彩虹褲', '🌈', 120]],
  },
  shoes: {
    cool: [['軍靴', '🥾', 180], ['黑色高筒靴', '👢', 220]],
    cute: [['小白鞋', '👟', 90], ['公主鞋', '🥿', 130]],
    fun: [['人字拖', '🩴', 50], ['滑板鞋', '🛹', 140]],
  },
  wall: {
    cool: [['水泥牆', 'linear-gradient(#3a3f4b,#2b2f3a)', 150], ['霓虹暗牆', 'repeating-linear-gradient(90deg,#14141f 0 30px,#1d1d33 30px 60px)', 260]],
    cute: [['粉色牆', 'linear-gradient(#ffe3ee,#ffd1e3)', 150], ['天空藍牆', 'linear-gradient(#d6f0ff,#bfe6ff)', 220]],
    fun: [['橘黃條紋牆', 'repeating-linear-gradient(90deg,#ffb347 0 30px,#ffd580 30px 60px)', 150], ['波點牆', 'radial-gradient(circle,#fff 0 6px,transparent 7px) 0 0/30px 30px,#7ad0ff', 230]],
  },
  carpet: {
    cool: [['深灰地毯', '#4a5060', 100], ['黑金地毯', 'linear-gradient(135deg,#1c1c1c,#5a4a1a)', 180]],
    cute: [['粉紅地毯', '#ffc2d9', 100], ['草莓地毯', 'repeating-radial-gradient(circle at 10px 10px,#ff8fa3 0 4px,#ffd9e3 5px 16px)', 160]],
    fun: [['黃色地毯', '#ffe66d', 90], ['彩虹條紋地毯', 'repeating-linear-gradient(90deg,#ff6b6b 0 24px,#ffd93d 24px 48px,#6bcb77 48px 72px,#4d96ff 72px 96px)', 200]],
  },
  table: {
    cool: [['鐵製高腳椅', '🪑', 150], ['皮質沙發', '🛋️', 320]],
    cute: [['小木椅', '🪑', 120], ['奶油沙發', '🛋️', 280]],
    fun: [['懶骨頭椅', '🪑', 100], ['彩色沙發', '🛋️', 260]],
  },
  bed: {
    cool: [['鋼架床板', '🛏️', 200], ['黑檀床板', '🛏️', 380]],
    cute: [['公主床板', '🛏️', 220], ['雲朵床板', '🛏️', 360]],
    fun: [['城堡床板', '🛏️', 240], ['上下鋪床板', '🛏️', 320]],
  },
  mattress: {
    cool: [['記憶床墊', '🛌', 150], ['乳膠床墊', '🛌', 280]],
    cute: [['粉紅床墊', '🛌', 140], ['星星床墊', '🛌', 260]],
    fun: [['彈簧床墊', '🛌', 130], ['水床墊', '🛌', 300]],
  },
  pc: {
    cool: [['電競主機', '🖥️', 600], ['黑色筆電', '💻', 350]],
    cute: [['粉色筆電', '💻', 330], ['貓咪電腦', '🖥️', 450]],
    fun: [['復古電腦', '🖥️', 250], ['彩虹電腦', '💻', 400]],
  },
  tv: {
    cool: [['曲面電視', '📺', 550], ['黑色電視', '📺', 300]],
    cute: [['小電視', '📺', 220], ['愛心電視', '📺', 340]],
    fun: [['復古映像管電視', '📺', 200], ['巨幕電視', '📺', 500]],
  },
  wardrobe: {
    cool: [['鐵衣櫃', '🗄️', 260], ['黑木衣櫃', '🚪', 400]],
    cute: [['粉色衣櫃', '🚪', 250], ['糖果衣櫃', '🗄️', 380]],
    fun: [['彩繪衣櫃', '🚪', 240], ['魔術衣櫃', '🗄️', 360]],
  },
  decor: {
    cool: [['霓虹燈', '💡', 120], ['骷髏擺飾', '💀', 90]],
    cute: [['泰迪熊', '🧸', 100], ['盆栽', '🪴', 70]],
    fun: [['遊戲機', '🎮', 160], ['氣球', '🎈', 50]],
  },
};

// 建材（放倉庫，用來擴建房屋）：[名稱, emoji, 價格]
const MATERIALS = [['木材', '🪵', 20], ['磚塊', '🧱', 30], ['水泥', '🪨', 25], ['玻璃', '🪟', 40], ['鋼筋', '⛓️', 60]];

// 家具佔地（公尺，寬 × 深）
const FP = { table: [[0.8, 0.8], [1.9, 0.95]], bed: [[1.7, 2.2], [1.7, 2.2]], mattress: [[1.6, 2.1], [1.6, 2.1]], pc: [[1.1, 0.7], [1.1, 0.7]], tv: [[1.3, 0.5], [1.3, 0.5]], wardrobe: [[1.05, 0.6], [1.05, 0.6]], decor: [[0.5, 0.5], [0.5, 0.5]] };
// 持有上限：同一件商品最多持有幾件（賣出後可再買）
const LIMIT = { wear: 1, wall: 2, floor: 2, furn: 3, mat: 30 };

const ITEMS = {};
MATERIALS.forEach(([name, emoji, price], i) => {
  const key = ['wood', 'brick', 'cement', 'glass', 'steel'][i];
  const id = 'material_' + key;
  ITEMS[id] = { id, cat: 'material', style: 'none', name, emoji, price, kind: 'mat', limit: LIMIT.mat, model: `models/material/${id}.glb` };
});
for (const cat of Object.keys(RAW)) {
  for (const style of Object.keys(RAW[cat])) {
    RAW[cat][style].forEach(([name, art, price], i) => {
      const id = `${cat}_${style}_${i}`;
      const kind = CATS[cat].kind;
      const it = { id, cat, style, name, price, kind, limit: cat === 'decor' ? 5 : LIMIT[kind] };
      if (kind === 'wall' || kind === 'floor') it.tex = `textures/${id}.png`;
      else it.emoji = art;
      if (kind === 'wear') it.model = `models/wear/${id}.glb`;
      if (kind === 'furn') { it.model = `models/furniture/${id}.glb`; it.fp = FP[cat][i]; it.layer = cat === 'mattress' ? 'top' : 'base'; }
      ITEMS[id] = it;
    });
  }
}

// 初始服裝（註冊時免費配發，不在商店販售）
for (const [g, name] of [['m', '武俠長袍'], ['f', '襦裙']]) {
  ITEMS[`suit_start_${g}`] = { id: `suit_start_${g}`, cat: 'suit', style: 'none', name: `初始・${name}`, price: 0, kind: 'wear', limit: 1, starter: true, gender: g, model: `models/wear/suit_start_${g}.glb`, emoji: '👘' };
  ITEMS[`shoes_start_${g}`] = { id: `shoes_start_${g}`, cat: 'shoes', style: 'none', name: g === 'm' ? '初始・武俠布靴' : '初始・繡花布鞋', price: 0, kind: 'wear', limit: 1, starter: true, gender: g, model: `models/wear/shoes_start_${g}.glb`, emoji: '🥾' };
}

module.exports = { STYLES, CATS, ITEMS };
