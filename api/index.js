// API 路由處理
const server = require('./index');

// 導出為 Vercel Serverless 函數
module.exports = (req, res) => {
  // 將請求轉發到我們的伺服器處理邏輯
  return server(req, res);
};
