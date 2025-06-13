const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let serviceStarted = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 480,
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
  }
  return true;
});

exports.openLocalhost = function () {
  shell.openExternal('http://localhost:3000');
};
