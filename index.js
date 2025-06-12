// 只在本地開發時載入 .env
if (process.env.VERCEL !== '1') {
  require('dotenv').config();
}

const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');
const axios = require('axios');

// 判斷是否在 Vercel 環境中運行
const isVercel = process.env.VERCEL === '1';
console.log('運行環境：', isVercel ? 'Vercel' : '本地');

// 輸出環境變數用於調試
console.log('環境變數 CLIENT_ID:', process.env.CLIENT_ID ? '已設定 (長度: ' + process.env.CLIENT_ID.length + ')' : '未設定');
console.log('環境變數 CLIENT_SECRET:', process.env.CLIENT_SECRET ? '已設定 (長度: ' + process.env.CLIENT_SECRET.length + ')' : '未設定');
console.log('環境變數 REDIRECT_URI:', process.env.REDIRECT_URI || '未設定');

// 配置
const config = {
  clientId: process.env.CLIENT_ID || 'your_client_id_here',
  clientSecret: process.env.CLIENT_SECRET || 'your_client_secret_here',
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback',
  port: process.env.PORT || 3000
};

// Microsoft Graph API 主機映射
const region = process.env.REGION || 'global';
const onedriveHostMap = {
  global: {
    oauth: 'https://login.microsoftonline.com',
    api: 'https://graph.microsoft.com'
  },
  cn: {
    oauth: 'https://login.chinacloudapi.cn',
    api: 'https://microsoftgraph.chinacloudapi.cn'
  },
  us: {
    oauth: 'https://login.microsoftonline.us',
    api: 'https://graph.microsoft.us'
  }
};

// OAuth 權限範圍
const scopes = [
  'offline_access',
  'Files.Read',
  'Files.Read.All',
  'Files.ReadWrite',
  'Files.ReadWrite.All'
];

// 建立 HTTP 伺服器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`收到請求: ${pathname}`);

  try {
    // 路由處理
    if (pathname === '/' || pathname === '/index.html') {
      // 首頁
      serveStaticFile(res, 'public/index.html');

    } else if (pathname === '/auth/login') {
      // 標準 OAuth 2.0 登入
      handleAuthLogin(req, res);

    } else if (pathname === '/auth/callback') {
      // 標準 OAuth 2.0 回調
      await handleAuthCallback(req, res);

    } else if (pathname.startsWith('/public/')) {
      // 靜態檔案
      serveStaticFile(res, pathname.substring(1));

    } else {
      // 404 頁面
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 找不到頁面');
    }
  } catch (error) {
    console.error('處理請求時發生錯誤:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('伺服器內部錯誤');
  }
});

// 標準 OAuth 2.0 登入
function handleAuthLogin(req, res) {
  const authEndpoint = `${onedriveHostMap[region].oauth}/common/oauth2/v2.0/authorize`;
  const authParams = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: scopes.join(' '),
    response_mode: 'query'
  });
  const authUrl = `${authEndpoint}?${authParams.toString()}`;
  console.log('授權 URL:', authUrl);
  res.writeHead(302, { Location: authUrl });
  res.end();
}

// 標準 OAuth 2.0 回調
async function handleAuthCallback(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const code = parsedUrl.query.code;
  const error = parsedUrl.query.error;

  if (error) {
    console.error('授權錯誤:', error);
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`授權錯誤: ${error}`);
    return;
  }
  if (!code) {
    console.error('未提供授權碼');
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('未提供授權碼');
    return;
  }
  try {
    console.log('正在用授權碼交換 token...');
    const tokenUrl = `${onedriveHostMap[region].oauth}/common/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', config.clientId);
    tokenParams.append('client_secret', config.clientSecret);
    tokenParams.append('code', code);
    tokenParams.append('redirect_uri', config.redirectUri);
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('scope', scopes.join(' '));
    const tokenResponse = await axios.post(tokenUrl, tokenParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const data = tokenResponse.data;
    // 安全日誌
    const safeLog = { ...data };
    if (safeLog.access_token) safeLog.access_token = '已設定';
    if (safeLog.refresh_token) safeLog.refresh_token = '已設定';
    if (safeLog.id_token) safeLog.id_token = '已設定';
    console.log('Token 響應:', JSON.stringify(safeLog, null, 2));
    // 結果頁
    let url = '/public/success.html?client_id=' + encodeURIComponent(config.clientId) +
      '&redirect_uri=' + encodeURIComponent(config.redirectUri);
    if (data.refresh_token) {
      url += '&refresh_token=' + encodeURIComponent(data.refresh_token);
    } else if (data.access_token) {
      url += '&access_token=' + encodeURIComponent(data.access_token);
    }
    res.writeHead(302, { Location: url });
    res.end();
  } catch (err) {
    console.error('獲取 Token 失敗:', err.response ? err.response.data : err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('獲取 Token 失敗');
  }
}

// 提供靜態檔案
function serveStaticFile(res, filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  // 檢查文件是否存在
  try {
    if (!fs.existsSync(fullPath)) {
      console.error(`檔案不存在: ${fullPath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`檔案不存在: ${filePath}`);
      return;
    }
    
    // 讀取檔案內容
    const data = fs.readFileSync(fullPath);
    
    // 設置內容類型
    let contentType = 'text/plain';
    const ext = path.extname(filePath);
    
    switch (ext) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.json':
        contentType = 'application/json';
        break;
    }

    res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
    res.end(data);
  } catch (error) {
    console.error(`讀取檔案錯誤: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('伺服器錯誤');
  }
}

// 根據環境決定是否啟動伺服器
if (!isVercel) {
  // 本地開發環境，啟動HTTP伺服器
  const PORT = process.env.PORT || config.port;
  server.listen(PORT, () => {
    const serverUrl = `http://localhost:${PORT}`;
    console.log(`伺服器已啟動: ${serverUrl}`);
    console.log(`請開啟瀏覽器訪問: ${serverUrl}`);
  });
}

// 直接導出伺服器實例，供 API 路由使用
module.exports = server;