const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let serviceStarted = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 680,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    resizable: false,
  });
  win.loadFile('electron-gui.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('start-service', (event, envVars) => {
  if (!serviceStarted) {
    Object.assign(process.env, envVars);
    require(path.join(__dirname, 'index.js'));
    serviceStarted = true;
    // 啟動服務後自動打開瀏覽器
    setTimeout(() => {
      shell.openExternal('http://localhost:3000');
    }, 100); // 延遲0.1秒，確保服務已啟動
  }
  return true;
});
