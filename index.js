require('dotenv').config();
require('isomorphic-fetch');
const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');

// 判斷是否在 Vercel 環境中運行
const isVercel = process.env.VERCEL === '1';

// 配置
const config = {
  clientId: process.env.CLIENT_ID || 'your_client_id_here',
  clientSecret: process.env.CLIENT_SECRET || 'your_client_secret_here',
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback',
  port: process.env.PORT || 3000,
  region: process.env.REGION || 'global' // global, cn, us, de
};

// Microsoft Graph API 主機映射
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
  },
  de: {
    oauth: 'https://login.microsoftonline.de',
    api: 'https://graph.microsoft.de'
  }
};

// 驗證設置
const msalConfig = {
  auth: {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authority: `${onedriveHostMap[config.region].oauth}/common`,
  }
};

const scopes = [
  'offline_access',
  'Files.Read',
  'Files.Read.All',
  'Files.ReadWrite',
  'Files.ReadWrite.All'
];

// 創建 MSAL 應用實例
const msalApp = new ConfidentialClientApplication(msalConfig);

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
      // 授權登入
      handleAuthLogin(req, res);

    } else if (pathname === '/auth/callback') {
      // 授權回調
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

// 處理授權登入
function handleAuthLogin(req, res) {
  const authCodeUrlParameters = {
    scopes: scopes,
    redirectUri: config.redirectUri,
  };

  // 獲取授權 URL
  msalApp.getAuthCodeUrl(authCodeUrlParameters)
    .then((authUrl) => {
      console.log('授權 URL:', authUrl);
      res.writeHead(302, { Location: authUrl });
      res.end();
    })
    .catch((error) => {
      console.error('獲取授權 URL 失敗:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('獲取授權 URL 失敗');
    });
}

// 處理授權回調
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
    // 使用授權碼交換 token
    const tokenResponse = await msalApp.acquireTokenByCode({
      code: code,
      scopes: scopes,
      redirectUri: config.redirectUri,
    });

    console.log('成功獲取 Token');
    
    // 重定向到成功頁面並傳遞 token
    const successUrl = '/public/success.html' + 
      `?client_id=${encodeURIComponent(config.clientId)}` +
      `&client_secret=${encodeURIComponent(config.clientSecret)}` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&refresh_token=${encodeURIComponent(tokenResponse.refreshToken)}`;
    
    res.writeHead(302, { Location: successUrl });
    res.end();
  } catch (error) {
    console.error('獲取 Token 失敗:', error);
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