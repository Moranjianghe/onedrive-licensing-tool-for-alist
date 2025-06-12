require('dotenv').config();

// 在 Vercel 函數中設定環境標記
process.env.VERCEL = '1';

// 輸出環境變數以便調試
console.log('OAuth API Route - 環境變數 CLIENT_ID:', process.env.CLIENT_ID ? '已設定 (長度: ' + process.env.CLIENT_ID.length + ')' : '未設定');
console.log('OAuth API Route - 環境變數 CLIENT_SECRET:', process.env.CLIENT_SECRET ? '已設定 (長度: ' + process.env.CLIENT_SECRET.length + ')' : '未設定');
console.log('OAuth API Route - 環境變數 REDIRECT_URI:', process.env.REDIRECT_URI || '未設定');

// API 路由處理 - 使用 oauth_direct.js 直接 OAuth 流程
const server = require('../oauth_direct');

// 導出為 Vercel Serverless 函數
module.exports = (req, res) => {
  console.log(`OAuth API 請求: ${req.url}`);
  
  // 修正路徑處理，移除 /api/oauth 前綴
  const originalUrl = req.url;
  
  if (originalUrl.startsWith('/api/oauth')) {
    // 移除 /api/oauth 前綴，以便正確處理路由
    req.url = originalUrl.replace('/api/oauth', '');
    console.log(`轉換路徑: ${originalUrl} -> ${req.url}`);
  }
  
  // 在 Vercel 環境中使用 request 事件觸發我們的伺服器處理邏輯
  server.emit('request', req, res);
};
