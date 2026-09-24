const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
let server;
app.whenReady().then(() => {
  const port = 18763;
  server = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(port), SHOP_DATA_DIR: app.getPath('userData'), ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  });
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, backgroundColor: '#f5f4ef', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  const load = () => win.loadURL(`http://127.0.0.1:${port}`).catch(() => setTimeout(load, 350));
  setTimeout(load, 450);
});
app.on('before-quit', () => server?.kill());
app.on('window-all-closed', () => app.quit());
