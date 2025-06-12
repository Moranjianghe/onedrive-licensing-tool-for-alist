// API 路由處理
const server = require('../index');

// 導出為 Vercel Serverless 函數
module.exports = (req, res) => {
  // 在 Vercel 環境中使用 request 事件觸發我們的伺服器處理邏輯
  server.emit('request', req, res);
};
