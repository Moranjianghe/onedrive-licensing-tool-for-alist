// 直接實現 OAuth 流程以獲取 refresh token
const dotenv = require('dotenv');
const envResult = dotenv.config();

// 檢查環境變數是否成功載入
if (envResult.error) {
  console.error('環境變數載入錯誤:', envResult.error);
} else {
  console.log('環境變數載入成功，已載入的變數:', Object.keys(envResult.parsed).join(', '));
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

    } else if (pathname === '/auth/login' || pathname === '/oauth/login') {
      // 授權登入（支持兩種路徑）
      handleAuthLogin(req, res);

    } else if (pathname === '/auth/callback' || pathname === '/oauth/callback') {
      // 授權回調（支持兩種路徑）
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

// 處理授權登入 - 直接使用 OAuth 流程
function handleAuthLogin(req, res) {
  const authEndpoint = `${onedriveHostMap[config.region].oauth}/common/oauth2/v2.0/authorize`;
  
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

// 處理授權回調 - 直接使用 OAuth 流程
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
    
    // 使用 POST 請求直接獲取 token
    // 注意：為了相容 AList，我們使用 v2.0 終端點
    const tokenUrl = `${onedriveHostMap[config.region].oauth}/common/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', config.clientId);
    tokenParams.append('client_secret', config.clientSecret);
    tokenParams.append('code', code);
    tokenParams.append('redirect_uri', config.redirectUri);
    tokenParams.append('grant_type', 'authorization_code');
    
    // 詳細記錄請求內容以便調試
    console.log('Token Request URL:', tokenUrl);
    console.log('Token Request Params:', {
      client_id: config.clientId ? `已設定 (長度: ${config.clientId.length})` : '未設定',
      client_secret: '已設定但不顯示',
      code: code ? `已設定 (長度: ${code.length})` : '未設定',
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    });
    
    const tokenResponse = await axios.post(tokenUrl, tokenParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('成功獲取 Token');
      // 安全地輸出 token 響應信息，但不顯示敏感內容
    const safeResponse = { ...tokenResponse.data };
    if (safeResponse.access_token) safeResponse.access_token = `已設定 (長度: ${tokenResponse.data.access_token.length})`;
    if (safeResponse.refresh_token) safeResponse.refresh_token = `已設定 (長度: ${tokenResponse.data.refresh_token.length})`;
    if (safeResponse.id_token) safeResponse.id_token = `已設定 (長度: ${tokenResponse.data.id_token.length})`;
    
    console.log('Token 響應:', JSON.stringify(safeResponse, null, 2));
    console.log('Token 響應包含的屬性:', Object.keys(tokenResponse.data).join(', '));
    
    // 從響應中直接獲取 refresh_token
    const refreshToken = tokenResponse.data.refresh_token;
    
    if (!refreshToken) {
      console.error('響應中沒有 refresh_token');
      
      // 使用 access_token 作為備用方案
      const accessToken = tokenResponse.data.access_token;
      
      const successUrl = '/public/success.html' + 
        `?client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
        `&access_token=${encodeURIComponent(accessToken)}` +
        `&note=${encodeURIComponent('未能獲取refresh_token，使用access_token作為替代。這在AList中可能導致AADSTS9002313錯誤。')}`;
      
      res.writeHead(302, { Location: successUrl });
      res.end();
      return;
    }
    
    console.log('成功獲取 refresh_token，長度:', refreshToken.length);
    
    // AList 需要使用特定格式的 refresh token
    // 檢查是否有其他重要屬性可以保存
    const tokenExtra = {};
    const importantFields = ['token_type', 'expires_in', 'scope', 'ext_expires_in'];
    importantFields.forEach(field => {
      if (tokenResponse.data[field]) {
        tokenExtra[field] = tokenResponse.data[field];
      }
    });
    
    console.log('提取的額外 Token 資訊:', tokenExtra);
    
    // 重定向到成功頁面並傳遞 token
    const successUrl = '/public/success.html' + 
      `?client_id=${encodeURIComponent(config.clientId)}` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&refresh_token=${encodeURIComponent(refreshToken)}` +
      `&note=${encodeURIComponent('成功獲取 refresh_token，可直接用於 AList')}`;
    
    res.writeHead(302, { Location: successUrl });
    res.end();
  } catch (error) {
    console.error('獲取 Token 失敗:', error.response ? error.response.data : error.message);
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
