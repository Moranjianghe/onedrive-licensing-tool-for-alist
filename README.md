# OneDrive 授權工具 (AList 掛載助手)

這是一個輕量級工具，幫助您獲取在 AList 中掛載 OneDrive 時所需的授權 token。

## 功能特點

- 簡潔的用戶界面
- 自動獲取 Microsoft OAuth 授權
- 支持多個區域 (global, cn, us, de)
- 提供完整的掛載所需信息 (refresh_token 等)
- 可輕鬆部署到 Vercel 無伺服器平台

## 本地開發與運行

### 準備工作

1. 在 [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) 註冊應用程式
2. 創建一個新的 Web 應用
3. 設置重定向 URI 為 `http://localhost:3000/auth/callback`（本地開發）或 `https://your-vercel-app.vercel.app/auth/callback`（Vercel 部署）
4. 在「憑證和密碼」部分創建一個新的客戶端密碼
5. 記下應用程式 (client) ID 和客戶端密碼

### 本地運行

1. 複製 `.env.example` 為 `.env` 並填入您的配置：

```bash
# Microsoft OAuth 設定
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000

# 選擇區域 (global, cn, us, de)
REGION=global
```

2. 安裝依賴：

```bash
npm install
```

3. 啟動服務：

```bash
npm start
```

4. 在瀏覽器打開 http://localhost:3000

## Vercel 部署

[![部署到 Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/yourusername/onedrive-licensing-tool-for-alist)

1. 點擊上方按鈕，或直接將本儲存庫連結到 Vercel
2. 在 Vercel 環境變數設定中添加：
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - `REDIRECT_URI` (必須是 `https://your-vercel-app.vercel.app/auth/callback`)
   - `REGION` (可選，預設為 global)

## AList 掛載說明

成功獲取授權後，您會得到以下資訊：

1. **Client ID**: 您的 Microsoft 應用程式 ID
2. **Client Secret**: 您的 Microsoft 應用程式密鑰
3. **Redirect URI**: 您配置的重定向 URI
4. **Refresh Token**: 用於獲取存取權限的重要令牌

在 AList 中添加 OneDrive 存儲時：

1. 選擇存儲類型為 "OneDrive"
2. 填入您的 Client ID、Client Secret
3. 將 Redirect URI 設定為預設值或您自己的 URI
4. 填入獲取到的 Refresh Token
5. 選擇正確的區域 (global, cn, us, de)

## 技術細節

- 使用純 Node.js HTTP 模組，無需任何 Web 框架
- MSAL (Microsoft Authentication Library) 處理 OAuth 授權流程
- Microsoft Graph 用戶端庫用於與 Microsoft 服務交互
- 靜態 HTML/CSS/JavaScript 實現用戶界面

## 隱私聲明

本工具僅獲取必要的 Microsoft 授權令牌，不存儲或傳輸您的任何個人資料。所有授權過程均在您的瀏覽器中進行，獲取的令牌僅顯示給您本人。

## 授權協議

MIT

## 支持與貢獻

如有問題或建議，歡迎提交 Issue 或 Pull Request。
