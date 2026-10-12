// 瀏覽器版用不到檔案系統：給 questions.js 一個空殼
module.exports = { readdirSync() { throw new Error('no fs'); }, readFileSync() { throw new Error('no fs'); } };
