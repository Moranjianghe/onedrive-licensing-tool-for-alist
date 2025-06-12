// 確保環境變數在 Vercel 函數中也能正確載入
require('dotenv').config();

// 在 Vercel 函數中設定環境標記
process.env.VERCEL = '1';

// 輸出環境變數以便調試
console.log('API Route - 環境變數 CLIENT_ID:', process.env.CLIENT_ID ? '已設定 (長度: ' + process.env.CLIENT_ID.length + ')' : '未設定');
console.log('API Route - 環境變數 CLIENT_SECRET:', process.env.CLIENT_SECRET ? '已設定 (長度: ' + process.env.CLIENT_SECRET.length + ')' : '未設定');
console.log('API Route - 環境變數 REDIRECT_URI:', process.env.REDIRECT_URI || '未設定');

// API 路由處理
const server = require('../index');

// 導出為 Vercel Serverless 函數
module.exports = (req, res) => {
  console.log(`API 請求: ${req.url}`);
  // 在 Vercel 環境中使用 request 事件觸發我們的伺服器處理邏輯
  server.emit('request', req, res);
};
