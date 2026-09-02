const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SolarCAD — Suíte Profissional de Homologação GD',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  // Intercepta e normaliza headers de CORS para comunicação com Supabase e APIs externas
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (!headers['Origin'] || headers['Origin'] === 'file://' || headers['Origin'] === 'null') {
      headers['Origin'] = 'http://localhost';
    }
    callback({ cancel: false, requestHeaders: headers });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['access-control-allow-origin'] = ['*'];
    responseHeaders['access-control-allow-headers'] = ['*'];
    responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
    callback({ cancel: false, responseHeaders });
  });

  // Em produção carrega o build estático do Vite
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Abre links externos no navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Novo Projeto', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        { label: 'Sair', role: isMac ? 'close' : 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Recarregamento Forçado' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom Padrão' },
        { role: 'zoomIn', label: 'Aumentar Zoom' },
        { role: 'zoomOut', label: 'Diminuir Zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Documentação & Normas',
          click: () => shell.openExternal('https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida'),
        },
        {
          label: 'Sobre o SolarCAD',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre o SolarCAD',
              message: 'SolarCAD Desktop v1.1.0',
              detail: 'Suíte de Engenharia e Homologação Fotovoltaica GD\nCompatível com NBR 5410, NBR 16690 e Lei 14.300/2022.\nAutor: Luca Rodrigues Gomes de Sant\'Anna',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
