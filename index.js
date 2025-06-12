// 載入環境變數
const dotenv = require('dotenv');
const envResult = dotenv.config();

// 檢查環境變數是否成功載入
if (envResult.error) {
  console.error('環境變數載入錯誤:', envResult.error);
} else {
  console.log('環境變數載入成功，已載入的變數:', Object.keys(envResult.parsed).join(', '));
}

require('isomorphic-fetch');
const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');

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

// 驗證設置
const msalConfig = {
  auth: {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authority: `${onedriveHostMap[config.region].oauth}/common`,
  }
};

// 確保請求包含 offline_access 範圍，這對於獲取 refresh token 至關重要
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
  }  try {
    console.log('正在用授權碼交換 token...');
    
    // 使用授權碼交換 token
    const tokenResponse = await msalApp.acquireTokenByCode({
      code: code,
      scopes: scopes,
      redirectUri: config.redirectUri,
    });
    
    console.log('成功獲取 Token');
    
    // MSAL 不直接暴露 refreshToken，但我們可以從序列化的 token cache 中提取
    let refreshToken = '';
    
    // 輸出有關 tokenResponse 的詳細信息，但保護敏感數據
    if (tokenResponse) {
      console.log('Token響應類型:', typeof tokenResponse);
      
      // 創建一個安全版本用於日誌輸出
      const safeTokenResponse = { ...tokenResponse };
      if (safeTokenResponse.accessToken) safeTokenResponse.accessToken = '已設定但不顯示';
      if (safeTokenResponse.idToken) safeTokenResponse.idToken = '已設定但不顯示';
      
      // 輸出對象中的所有頂級屬性
      console.log('Token響應包含的屬性:', Object.keys(tokenResponse));
      console.log('Token響應內容 (安全版本):', JSON.stringify(safeTokenResponse, null, 2));
      
      // 檢查各種可能的位置
      if (tokenResponse.refreshToken) {
        refreshToken = tokenResponse.refreshToken;
        console.log('從 tokenResponse.refreshToken 獲取到了 refreshToken');
      } else if (tokenResponse.account && tokenResponse.account.refreshToken) {
        refreshToken = tokenResponse.account.refreshToken;
        console.log('從 tokenResponse.account.refreshToken 獲取到了 refreshToken');
      } else if (tokenResponse.response && tokenResponse.response.refresh_token) {
        refreshToken = tokenResponse.response.refresh_token;
        console.log('從 tokenResponse.response.refresh_token 獲取到了 refreshToken');
      } else {
        // 由於MSAL刻意不暴露refresh token，我們需要處理這種情況
        console.log('在標準位置未找到 refreshToken，檢查其他可能的位置');
        
        // 檢查是否有內部或私有屬性可能包含refreshToken
        for (const key in tokenResponse) {
          const prop = tokenResponse[key];
          if (typeof prop === 'string' && prop.length > 20) {
            console.log(`檢查屬性 ${key} (長度: ${prop.length})`);
            
            // 不要輸出實際值，但可以檢查它是否看起來像 refresh token
            if (prop.length > 500) {
              console.log(`屬性 ${key} 可能是 refresh token (長度足夠長)`);
              refreshToken = prop;
              break;
            }
          } else if (typeof prop === 'object' && prop !== null) {
            console.log(`檢查對象屬性 ${key} 的子屬性`);
            const subKeys = Object.keys(prop);
            
            if (subKeys.includes('refreshToken') || subKeys.includes('refresh_token')) {
              console.log(`在 ${key} 對象中找到 refreshToken 屬性`);
              refreshToken = prop.refreshToken || prop.refresh_token;
              break;
            }
          }
        }
        
        if (!refreshToken) {
          console.log('嘗試使用緩存訪問來獲取 refresh token...');
          
          try {
            // 使用該帳戶嘗試另一種獲取方法
            if (tokenResponse.account) {
              // 使用 acquireTokenSilent 可能會在內部使用緩存的 refresh token
              const silentRequest = {
                account: tokenResponse.account,
                scopes: scopes,
                forceRefresh: true  // 強制刷新以使用 refresh token
              };
              
              console.log('嘗試靜默獲取 token...');
              const silentResponse = await msalApp.acquireTokenSilent(silentRequest);
              console.log('靜默獲取 token 成功');
              
              // 檢查靜默響應中的 refresh token
              if (silentResponse.refreshToken) {
                refreshToken = silentResponse.refreshToken;
                console.log('從靜默請求獲取到了 refreshToken');
              }
            }
          } catch (silentError) {
            console.error('靜默獲取 token 失敗:', silentError.message);
          }
        }
      }
    }
      // 如果經過上面所有嘗試仍然沒有獲取到 refresh token，我們需要使用一個替代解決方案
    if (!refreshToken) {
      console.log('所有方法都未能獲取到 refresh token，使用 accessToken 代替...');
      
      // 雖然我們無法直接獲取 refresh token，但我們可以提供 accessToken 給前端
      const accessToken = tokenResponse.accessToken || '';
        // 注意：這是一個臨時解決方案，因為 access token 有效期較短（通常1小時）
      const successUrl = '/public/success.html' + 
        `?client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
        `&access_token=${encodeURIComponent(accessToken)}` +
        `&note=${encodeURIComponent('未能獲取refresh_token，使用access_token作為替代，請注意其有效期較短')}`;
      res.writeHead(302, { Location: successUrl });
      res.end();
    } else {
      // 成功獲取到 refresh token 的情況
      console.log('成功獲取 refresh token，長度:', refreshToken.length);
      
      // 重定向到成功頁面並傳遞 token（移除敏感資訊 client_secret）
      const successUrl = '/public/success.html' + 
        `?client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
        `&refresh_token=${encodeURIComponent(refreshToken)}`;
      
      res.writeHead(302, { Location: successUrl });
      res.end();
    }
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