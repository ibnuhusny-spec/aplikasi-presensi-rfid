const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,       // Mode Layar Penuh Kiosk
    kiosk: true,            // Mengunci layar tanpa bar apapun
    autoHideMenuBar: true,  // Sembunyikan menu bar bawaan
    frame: false,           // Tanpa border / title bar atas
    icon: path.join(__dirname, 'public/logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Buka URL Vercel Live atau Build Lokal index.html
  const liveUrl = 'https://aplikasi-presensi-rfid.vercel.app';
  win.loadURL(liveUrl).catch(() => {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
