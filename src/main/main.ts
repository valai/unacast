// Electronのモジュール
import path from 'path';
import electron, { Tray, Menu, dialog, ipcMain, screen } from 'electron';
import * as remote from '@electron/remote/main';
import log from 'electron-log';
import { sleep } from './util';
import windowStateKeeper from 'electron-window-state';
import ElectronStore from 'electron-store';
// サーバー起動モジュール (IPC ハンドラ等の副作用登録目的)
import './startServer';
import { initThreadBrowser } from './threadBrowser';
import { registerClipboardHandlers } from './clipboard';
import { registerChatWindowCssHandlers } from './chatWindowCss';
import { registerSpeechControlHandlers } from './speechControl';
import { applyChatWindowRuntimeMode, chatWindowCreateOptions, getChatWindowMode, loadChatWindowMode, registerChatWindowModeHandlers } from './chatWindowMode';
import SherpaSpeechToText from './sherpaStt';
import { electronEvent } from './const';
remote.initialize();

/**
 * 各 HTML ページのロード先 URL を解決する。
 *  - electron-vite dev 中: process.env.ELECTRON_RENDERER_URL に dev サーバの URL が入る
 *  - production: dist/main/index.js から見た dist/renderer/src/html/<name>.html を file:// で読む
 */
const resolveRendererUrl = (htmlName: 'index' | 'chat' | 'desktopSubtitle' | 'translate' | 'imagePreview' | 'threadBrowser') => {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    return `${devUrl}/src/html/${htmlName}.html`;
  }
  return 'file://' + path.resolve(__dirname, `../renderer/src/html/${htmlName}.html`);
};
log.initialize();

// HTMLで出ないウインドウの表示設定
type WindowConfig = (typeof globalThis)['window_config'];

console.trace = () => {
  //
};

process.on('uncaughtException', (err) => {
  log.error(err);
});

// アプリケーションをコントロールするモジュール
const app = electron.app;

// 多重起動防止
if (!app.requestSingleInstanceLock()) {
  log.error('[app] It is terminated for multiple launches.');
  app.exit();
} else {
  log.info('[app] started');

  const store = new ElectronStore<WindowConfig>({
    name: 'unacast-window-config',
    defaults: {
      taskbar: {
        mainWindow: true,
        chatWindow: true,
        translateWindow: true,
        imagePreviewWindow: false,
      },
    },
  }) as any;

  // app.allowRendererProcessReuse = true;

  const iconPath = path.resolve(__dirname, '../../icon.png');

  // メインウィンドウはGCされないようにグローバル宣言
  globalThis.electron = {
    mainWindow: null as any,
    chatWindow: null as any,
    subtitleWindow: null as any,
    desktopSubtitlePayload: null,
    translateWindow: null as any,
    imagePreviewWindow: null as any,
    iconList: null as any,
    seList: [],
    twitchChat: null as any,
    youtubeChat: null as any,
    niconicoChat: null as any,
    twitcastingChat: null as any,
    jpnknFast: null as any,
    sherpaStt: new SherpaSpeechToText(),
    threadNumber: 0,
    bbsDefaultName: '',
    jpnknDefaultName: '',
    commentQueueList: [],
    translateQueueList: [],
  };

  globalThis.window_config = {
    taskbar: store.get('taskbar'),
  };
  // チャットウィンドウの表示モード (最前面・枠なし/背景透過)。ウィンドウ作成前に読み込む
  loadChatWindowMode(store);

  // 全てのウィンドウが閉じたら終了
  // app.on('window-all-closed', () => {
  //   if (process.platform != 'darwin') {
  //     app.exit();
  //   }
  // });

  // Electronの初期化完了後に実行
  app.on('ready', () => {
    const windowState = windowStateKeeper({
      defaultWidth: 700,
      defaultHeight: 720,
      file: 'mainWindow.json',
    });

    // ウィンドウサイズを（フレームサイズを含まない）設定
    const mainWin = new electron.BrowserWindow({
      // 前回起動時のを復元
      x: windowState.x,
      y: windowState.y,
      width: windowState.width,
      height: windowState.height,

      useContentSize: true,
      icon: iconPath,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      // タスクバー非表示
      skipTaskbar: globalThis.window_config.taskbar?.mainWindow ?? false,
    });
    remote.enable(mainWin.webContents);
    globalThis.electron.mainWindow = mainWin;
    windowState.manage(mainWin);

    mainWin.setTitle('unacast');
    mainWin.setMenu(null);

    // // レンダラーで使用するhtmlファイルを指定する
    mainWin.loadURL(resolveRendererUrl('index'));

    // ウィンドウが閉じられたらアプリも終了
    mainWin.on('close', (event) => {
      // 確認ダイアログではいをクリックしたら閉じる
      event.preventDefault();
      dialog
        .showMessageBox(mainWin, {
          type: 'question',
          buttons: ['Yes', 'No'],
          // title: '',
          message: '終了しますか？',
        })
        .then((value) => {
          if (value.response === 0) {
            app.exit();
          }
        });
    });
    mainWin.on('closed', () => {
      log.info('[app] close');
      app.exit();
    });

    // 開発者ツールを開く
    // mainWin.webContents.openDevTools();

    // タスクトレイの設定
    let tray: Tray = null as any;
    app.whenReady().then(() => {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '設定',
          click: function () {
            globalThis.electron.mainWindow.show();
            globalThis.electron.mainWindow.focus();
          },
        },
        {
          label: 'コメント',
          click: function () {
            globalThis.electron.chatWindow.show();
            globalThis.electron.chatWindow.focus();
          },
        },
        {
          label: '翻訳',
          click: function () {
            globalThis.electron.translateWindow.show();
            globalThis.electron.translateWindow.focus();
          },
        },
        {
          label: 'タスクバー表示設定',
          submenu: [
            {
              label: '設定',
              type: 'checkbox',
              checked: globalThis.window_config.taskbar?.mainWindow ?? false,
              click(item) {
                globalThis.window_config.taskbar.mainWindow = item.checked;
                store.set('taskbar', globalThis.window_config.taskbar);
                applyTaskbarState();
              },
            },
            {
              label: 'チャット',
              type: 'checkbox',
              checked: globalThis.window_config.taskbar?.chatWindow ?? false,
              click(item) {
                globalThis.window_config.taskbar.chatWindow = item.checked;
                store.set('taskbar', globalThis.window_config.taskbar);
                applyTaskbarState();
              },
            },
            {
              label: '翻訳',
              type: 'checkbox',
              checked: globalThis.window_config.taskbar?.translateWindow ?? false,
              click(item) {
                globalThis.window_config.taskbar.translateWindow = item.checked;
                store.set('taskbar', globalThis.window_config.taskbar);
                applyTaskbarState();
              },
            },
            // {
            //   label: '画像プレビュー',
            //   type: 'checkbox',
            //   checked: globalThis.config.showTaskbar.imagepreview,
            //   click(item) {
            //     globalThis.config.showTaskbar.imagepreview = item.checked;
            //     applyTaskbarState();
            //   },
            // },
          ],
        },
        { type: 'separator' },
        {
          label: '終了',
          click: function () {
            globalThis.electron.mainWindow.close();
          },
        },
      ]);
      tray.setToolTip('∈(ﾟ◎ﾟ)∋ｳﾅｰ');
      tray.setContextMenu(contextMenu);
      // タスクトレイクリック時の挙動
      let isDoubleClicked = false;
      tray.on('click', async () => {
        isDoubleClicked = false;
        await sleep(200);
        if (isDoubleClicked) return;
        globalThis.electron.chatWindow.show();
        globalThis.electron.chatWindow.focus();
      });
      tray.on('double-click', () => {
        isDoubleClicked = true;
        globalThis.electron.mainWindow.show();
        globalThis.electron.mainWindow.focus();
      });
    });

    createChatWindow();
    createDesktopSubtitleWindow();
    createTranslateWindow();
    createImagePreviewWindow();
    initThreadBrowser(() => resolveRendererUrl('threadBrowser'));
    registerClipboardHandlers();
    registerChatWindowCssHandlers();
    registerSpeechControlHandlers();
    registerChatWindowModeHandlers(syncDesktopSubtitleHandleMode);
    startDesktopSubtitlePointerMonitoring();
    ipcMain.on(electronEvent.START_DESKTOP_SUBTITLE_RESIZE, (event, edge: string) => {
      const subtitleWindow = globalThis.electron.subtitleWindow;
      if (!subtitleWindow || subtitleWindow.isDestroyed() || event.sender !== subtitleWindow.webContents) return;
      const [x, y] = subtitleWindow.getPosition();
      const [width, height] = subtitleWindow.getSize();
      const cursor = screen.getCursorScreenPoint();
      desktopSubtitleResize = { edge, startX: cursor.x, startY: cursor.y, x, y, width, height };
      setDesktopSubtitleMouseIgnored(false);
    });
    ipcMain.on(electronEvent.END_DESKTOP_SUBTITLE_RESIZE, (event) => {
      const subtitleWindow = globalThis.electron.subtitleWindow;
      if (event.sender !== subtitleWindow?.webContents) return;
      desktopSubtitleResize = null;
      setDesktopSubtitleMouseIgnored(true);
    });
    ipcMain.on(electronEvent.CLEAR_DESKTOP_SUBTITLE, (event, displayId?: number) => {
      if (event.sender !== globalThis.electron.subtitleWindow?.webContents) return;
      if (typeof displayId === 'number' && globalThis.electron.desktopSubtitlePayload?.id !== displayId) return;
      globalThis.electron.desktopSubtitlePayload = null;
    });
    ipcMain.on(electronEvent.SHOW_CHAT_WINDOW, () => {
      const chatWindow = globalThis.electron.chatWindow;
      if (!chatWindow || chatWindow.isDestroyed()) return;
      if (!chatWindow.isVisible()) chatWindow.show();
      chatWindow.focus();
    });
    ipcMain.on(electronEvent.SHOW_DESKTOP_SUBTITLE, () => showDesktopSubtitleWindow());
    ipcMain.on(electronEvent.HIDE_DESKTOP_SUBTITLE, () => hideDesktopSubtitleWindow());
    initializeSherpaStt(globalThis.electron.sherpaStt);

    applyTaskbarState();
  });

  // 音声再生できるようにする
  app.commandLine.appendSwitch('--autoplay-policy', 'no-user-gesture-required');
}

const createChatWindow = () => {
  const windowState = windowStateKeeper({
    defaultWidth: 400,
    defaultHeight: 720,
    file: 'chatWindow.json',
  });
  const iconPath = path.resolve(__dirname, '../../icon.png');

  const chatWindow = new electron.BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,

    useContentSize: true,
    icon: iconPath,
    // 通常のコメント一覧は、字幕の表示モードから独立した通常ウィンドウにする。
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // タスクバーに表示しない
    skipTaskbar: globalThis.window_config.taskbar.chatWindow ?? false,
    // 閉じれなくする
    closable: false,
  });
  remote.enable(chatWindow.webContents);
  windowState.manage(chatWindow);
  chatWindow.setTitle('unacast');
  chatWindow.setMenu(null);

  // レンダラーで使用するhtmlファイルを指定する
  chatWindow.loadURL(resolveRendererUrl('chat'));

  globalThis.electron.chatWindow = chatWindow;
  // chatWindow.webContents.openDevTools();
};

let desktopSubtitleHandleWindow: electron.BrowserWindow | null = null;
let syncingDesktopSubtitleHandle = false;
let desktopSubtitleResize: { edge: string; startX: number; startY: number; x: number; y: number; width: number; height: number } | null = null;
let desktopSubtitleMouseIgnored = true;
const DESKTOP_SUBTITLE_HANDLE_WIDTH = 44;
const DESKTOP_SUBTITLE_HANDLE_HEIGHT = 11;
const DESKTOP_SUBTITLE_HANDLE_WINDOW_WIDTH = 46;
const DESKTOP_SUBTITLE_HANDLE_WINDOW_HEIGHT = 32;

const setDesktopSubtitleMouseIgnored = (ignore: boolean) => {
  const subtitleWindow = globalThis.electron.subtitleWindow;
  if (!subtitleWindow || subtitleWindow.isDestroyed() || desktopSubtitleMouseIgnored === ignore) return;
  subtitleWindow.setIgnoreMouseEvents(ignore);
  desktopSubtitleMouseIgnored = ignore;
};

const createDesktopSubtitleWindow = () => {
  const windowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 150,
    file: 'desktopSubtitleWindow.json',
  });
  const iconPath = path.resolve(__dirname, '../../icon.png');
  const subtitleWindow = new electron.BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    useContentSize: true,
    icon: iconPath,
    ...chatWindowCreateOptions(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    skipTaskbar: true,
    closable: false,
    resizable: false,
    hasShadow: false,
  });
  remote.enable(subtitleWindow.webContents);
  windowState.manage(subtitleWindow);
  applyChatWindowRuntimeMode(subtitleWindow);
  subtitleWindow.setIgnoreMouseEvents(true);
  desktopSubtitleMouseIgnored = true;
  subtitleWindow.setTitle('unacast');
  subtitleWindow.setMenu(null);
  subtitleWindow.loadURL(resolveRendererUrl('desktopSubtitle'));
  subtitleWindow.on('move', alignDesktopSubtitleHandle);
  subtitleWindow.on('closed', () => {
    if (globalThis.electron.subtitleWindow === subtitleWindow) globalThis.electron.subtitleWindow = null as any;
  });
  globalThis.electron.subtitleWindow = subtitleWindow;
  subtitleWindow.webContents.once('did-finish-load', () => {
    if (globalThis.electron.desktopSubtitlePayload) subtitleWindow.webContents.send(electronEvent.SHOW_COMMENT, globalThis.electron.desktopSubtitlePayload);
  });
};

const alignDesktopSubtitleHandle = () => {
  const subtitleWindow = globalThis.electron.subtitleWindow;
  const handle = desktopSubtitleHandleWindow;
  if (!subtitleWindow || subtitleWindow.isDestroyed() || !handle || handle.isDestroyed()) return;
  const [x, y] = subtitleWindow.getPosition();
  syncingDesktopSubtitleHandle = true;
  handle.setPosition(x, y - DESKTOP_SUBTITLE_HANDLE_WINDOW_HEIGHT, false);
  syncingDesktopSubtitleHandle = false;
};

const ensureDesktopSubtitleHandle = () => {
  if (desktopSubtitleHandleWindow && !desktopSubtitleHandleWindow.isDestroyed()) return desktopSubtitleHandleWindow;
  const handle = new electron.BrowserWindow({
    width: DESKTOP_SUBTITLE_HANDLE_WINDOW_WIDTH,
    height: DESKTOP_SUBTITLE_HANDLE_WINDOW_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  handle.setTitle('unacast');
  handle.setMenu(null);
  handle.setAlwaysOnTop(true);
  handle.setBackgroundColor('#00000000');
  handle.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}body{display:flex;align-items:center;justify-content:center}#handle-label{box-sizing:border-box;width:44px;height:11px;padding:0 2px;background:#6060c0;color:#fff;font:400 10px/11px "Segoe UI",sans-serif;letter-spacing:.3px;text-align:center;white-space:nowrap;user-select:none;-webkit-app-region:drag}</style></head><body><div id="handle-label">unacast</div></body></html>',
      ),
  );
  handle.on('move', () => {
    if (syncingDesktopSubtitleHandle) return;
    const subtitleWindow = globalThis.electron.subtitleWindow;
    if (!subtitleWindow || subtitleWindow.isDestroyed()) return;
    const [x, y] = handle.getPosition();
    subtitleWindow.setPosition(x, y + DESKTOP_SUBTITLE_HANDLE_WINDOW_HEIGHT, false);
  });
  handle.on('closed', () => {
    if (desktopSubtitleHandleWindow === handle) desktopSubtitleHandleWindow = null;
  });
  desktopSubtitleHandleWindow = handle;
  return handle;
};

const syncDesktopSubtitleHandleMode = () => {
  const mode = getChatWindowMode();
  if (desktopSubtitleHandleWindow && !desktopSubtitleHandleWindow.isDestroyed()) {
    desktopSubtitleHandleWindow.setAlwaysOnTop(mode.alwaysOnTop);
    if (globalThis.electron.subtitleWindow?.isVisible()) desktopSubtitleHandleWindow.showInactive();
  }
  if (mode.frameless) {
    desktopSubtitleResize = null;
    setDesktopSubtitleMouseIgnored(true);
  }
};

const showDesktopSubtitleWindow = () => {
  const subtitleWindow = globalThis.electron.subtitleWindow;
  if (!subtitleWindow || subtitleWindow.isDestroyed()) return;
  const mode = getChatWindowMode();
  subtitleWindow.setAlwaysOnTop(mode.alwaysOnTop);
  setDesktopSubtitleMouseIgnored(true);
  const [x, y] = subtitleWindow.getPosition();
  if (y < DESKTOP_SUBTITLE_HANDLE_WINDOW_HEIGHT) subtitleWindow.setPosition(x, DESKTOP_SUBTITLE_HANDLE_WINDOW_HEIGHT, false);
  const handle = ensureDesktopSubtitleHandle();
  alignDesktopSubtitleHandle();
  handle.setAlwaysOnTop(mode.alwaysOnTop);
  subtitleWindow.showInactive();
  handle.showInactive();
};

const hideDesktopSubtitleWindow = () => {
  desktopSubtitleResize = null;
  setDesktopSubtitleMouseIgnored(true);
  const subtitleWindow = globalThis.electron.subtitleWindow;
  if (subtitleWindow && !subtitleWindow.isDestroyed()) subtitleWindow.hide();
  if (desktopSubtitleHandleWindow && !desktopSubtitleHandleWindow.isDestroyed()) desktopSubtitleHandleWindow.hide();
};

const startDesktopSubtitlePointerMonitoring = () => {
  setInterval(() => {
    const subtitleWindow = globalThis.electron.subtitleWindow;
    if (!subtitleWindow || subtitleWindow.isDestroyed() || !subtitleWindow.isVisible()) return;

    if (desktopSubtitleResize) {
      const cursor = screen.getCursorScreenPoint();
      const dx = cursor.x - desktopSubtitleResize.startX;
      const dy = cursor.y - desktopSubtitleResize.startY;
      const next = { x: desktopSubtitleResize.x, y: desktopSubtitleResize.y, width: desktopSubtitleResize.width, height: desktopSubtitleResize.height };
      if (desktopSubtitleResize.edge.includes('left')) {
        next.x = desktopSubtitleResize.x + dx;
        next.width = desktopSubtitleResize.width - dx;
      }
      if (desktopSubtitleResize.edge.includes('right')) next.width = desktopSubtitleResize.width + dx;
      if (desktopSubtitleResize.edge.includes('top')) {
        next.y = desktopSubtitleResize.y + dy;
        next.height = desktopSubtitleResize.height - dy;
      }
      if (desktopSubtitleResize.edge.includes('bottom')) next.height = desktopSubtitleResize.height + dy;
      if (next.width < 200) {
        if (desktopSubtitleResize.edge.includes('left')) next.x = desktopSubtitleResize.x + desktopSubtitleResize.width - 200;
        next.width = 200;
      }
      if (next.height < 80) {
        if (desktopSubtitleResize.edge.includes('top')) next.y = desktopSubtitleResize.y + desktopSubtitleResize.height - 80;
        next.height = 80;
      }
      subtitleWindow.setBounds(next, false);
      alignDesktopSubtitleHandle();
      return;
    }

    // 字幕本文は常時クリック透過。枠を表示した場合だけ、枠端の数pxをリサイズ操作に使う。
    const mode = getChatWindowMode();
    if (mode.frameless) {
      setDesktopSubtitleMouseIgnored(true);
      return;
    }
    const [x, y] = subtitleWindow.getPosition();
    const [width, height] = subtitleWindow.getSize();
    const cursor = screen.getCursorScreenPoint();
    const within = cursor.x >= x && cursor.x <= x + width && cursor.y >= y && cursor.y <= y + height;
    const edge = within && (cursor.x - x <= 8 || x + width - cursor.x <= 8 || cursor.y - y <= 8 || y + height - cursor.y <= 8);
    setDesktopSubtitleMouseIgnored(!edge);
  }, 16);
};

const createTranslateWindow = () => {
  const windowState = windowStateKeeper({
    defaultWidth: 400,
    defaultHeight: 720,
    file: 'translateWindow.json',
  });
  const iconPath = path.resolve(__dirname, '../../icon.png');

  const translateWindow = new electron.BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,

    useContentSize: true,
    icon: iconPath,
    // CSS 適用前の下地色。style-window.css の既定背景と合わせて白フラッシュを防ぐ
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // タスクバーに表示しない
    skipTaskbar: globalThis.window_config.taskbar?.translateWindow ?? false,
    // 閉じれなくする
    closable: false,
  });
  remote.enable(translateWindow.webContents);
  windowState.manage(translateWindow);

  translateWindow.setTitle('unacast');
  translateWindow.setMenu(null);

  // レンダラーで使用するhtmlファイルを指定する
  translateWindow.loadURL(resolveRendererUrl('translate'));

  // 初期表示は最小化
  translateWindow.minimize();
  globalThis.electron.translateWindow = translateWindow;
  // translateWindow.webContents.openDevTools();
};

const createImagePreviewWindow = () => {
  const windowState = windowStateKeeper({
    defaultWidth: 400,
    defaultHeight: 400,
    file: 'imagePreview.json',
  });
  const iconPath = path.resolve(__dirname, '../../icon.png');

  const childwindow = new electron.BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,

    useContentSize: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // タスクバーに表示しない
    skipTaskbar: true,

    minimizable: false,
    minHeight: 100,
    closable: true,
  });
  remote.enable(childwindow.webContents);
  windowState.manage(childwindow);

  childwindow.setTitle('unacast');
  childwindow.setMenu(null);
  childwindow.hide();

  // レンダラーで使用するhtmlファイルを指定する
  childwindow.loadURL(resolveRendererUrl('imagePreview'));

  // ×押したらインスタンス再生成
  childwindow.on('close', () => {
    setTimeout(() => {
      createImagePreviewWindow();
    }, 10);
  });

  globalThis.electron.imagePreviewWindow = childwindow;
  // childwindow.webContents.openDevTools();
};

const applyTaskbarState = () => {
  const map = globalThis.window_config.taskbar;

  const targets: [string, electron.BrowserWindow][] = [
    ['mainWindow', globalThis.electron.mainWindow],
    ['chatWindow', globalThis.electron.chatWindow],
    ['translateWindow', globalThis.electron.translateWindow],
    //['imagePreviewWindow', globalThis.electron.imagePreviewWindow],
  ];

  for (const [key, win] of targets) {
    if (win && !win.isDestroyed()) {
      win.setSkipTaskbar(!map[key]);
    }
  }
};

const initializeSherpaStt = (stt: SherpaSpeechToText) => {
  stt.on('start', () => {
    globalThis.electron.mainWindow.webContents.send(electronEvent.UPDATE_STATUS, {
      commentType: 'stt',
      category: 'status',
      message: `読み取り開始`,
    });
  });

  stt.on('comment', (event) => {
    globalThis.electron.commentQueueList.push({ ...event, imgUrl: globalThis.electron.iconList.getStt() });
    globalThis.electron.mainWindow.webContents.send(electronEvent.UPDATE_STATUS, {
      commentType: 'stt',
      category: 'status',
      message: `ok`,
    });
  });
  // 読み取り終了
  stt.on('end', () => {
    globalThis.electron.mainWindow.webContents.send(electronEvent.UPDATE_STATUS, {
      commentType: 'stt',
      category: 'status',
      message: `読み取り終了`,
    });
  });
  stt.on('error', (error, message) => {
    globalThis.electron.mainWindow.webContents.send(electronEvent.UPDATE_STATUS, {
      commentType: 'stt',
      category: 'status',
      // 見出しが無いエラー (マイク関連など) は理由だけを出す
      message: message ? `${message}: ${error}` : `${error}`,
    });
  });
  stt.on('status', (message) => {
    globalThis.electron.mainWindow.webContents.send(electronEvent.UPDATE_STATUS, {
      commentType: 'stt',
      category: 'status',
      message: message,
    });
  });

  /** モデルのダウンロード状態を renderer に通知する */
  const sendModelStatus = () => {
    globalThis.electron.mainWindow.webContents.send(electronEvent.UPDATE_STATUS, {
      commentType: 'stt',
      category: 'modelStatus',
      message: stt.checkModels() ? 'ダウンロード済み' : '未ダウンロード',
    });
  };

  ipcMain.on(electronEvent.SHERPA_STT, async (_event: any, command: string, arg?: unknown) => {
    switch (command) {
      case 'micStarted':
        stt.onMicStarted();
        break;
      case 'micError':
        stt.onMicError(String(arg));
        break;
      case 'restart':
        stt.restart((arg as { inputDevice?: string } | undefined)?.inputDevice);
        break;
      case 'downloadModels':
        await stt.downloadModels();
        sendModelStatus();
        break;
      case 'checkModelStatus':
        // 起動直後は renderer の準備前に送っても届かないため、設定画面の表示時に renderer から問い合わせる
        sendModelStatus();
        break;
    }
  });
};
