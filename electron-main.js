const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let nodeProcess = null;

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
  if (nodeProcess) nodeProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('start-service', (event, envVars) => {
  if (nodeProcess) nodeProcess.kill();
  nodeProcess = spawn('node', ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, ...envVars },
    stdio: 'ignore',
    detached: true
  });
  nodeProcess.unref();
  return true;
});

exports.openLocalhost = function () {
  shell.openExternal('http://localhost:3000');
};
