/**
 * デスクトップ字幕の表示モード (最前面・カスタム枠)。
 *
 * ゲーム画面などの上に重ねてコメントを見るデスクトップ字幕向け。設定画面から切り替える。
 * モードの正は main が持ち、設定画面と字幕ウィンドウへ通知する。
 *
 * - 最前面とカスタム枠の表示状態は electron-store に保存し、次回起動時も引き継ぐ
 * - 字幕ウィンドウは常に枠なし・背景透過・クリック透過。frameless は画面上にカスタム枠を表示しないことを表す。
 */
import { BrowserWindow, BrowserWindowConstructorOptions, ipcMain } from 'electron';
import electronlog from 'electron-log';
import { electronEvent } from './const';
const log = electronlog.scope('chatWindowMode');

export type ChatWindowMode = {
  /** 最前面に表示 */
  alwaysOnTop: boolean;
  /** 枠を表示しない (背景透過は常時有効) */
  frameless: boolean;
};

export type StoredChatWindowMode = ChatWindowMode;

type ModeStore = {
  get: (key: 'chatWindowMode') => Partial<StoredChatWindowMode> | undefined;
  set: (key: 'chatWindowMode', value: StoredChatWindowMode) => void;
};

let mode: ChatWindowMode = { alwaysOnTop: false, frameless: false };
let store: ModeStore | null = null;
let onModeChanged: () => void = () => {};

/** 保存済みのモードを読み込む。字幕ウィンドウを作る前に呼ぶ */
export const loadChatWindowMode = (modeStore: ModeStore) => {
  store = modeStore;
  const saved = modeStore.get('chatWindowMode') ?? {};
  mode = { alwaysOnTop: saved.alwaysOnTop === true, frameless: saved.frameless === true };
};

export const getChatWindowMode = (): ChatWindowMode => ({ ...mode });

/** ウィンドウ作成時にしか指定できないオプション */
export const chatWindowCreateOptions = (): Pick<BrowserWindowConstructorOptions, 'frame' | 'transparent' | 'backgroundColor'> =>
  ({ frame: false, transparent: true, backgroundColor: '#00000000' });

/** 作成後に切り替えられるモードをウィンドウへ反映する */
export const applyChatWindowRuntimeMode = (win: BrowserWindow) => {
  win.setAlwaysOnTop(mode.alwaysOnTop);
};

const notify = () => {
  for (const win of [globalThis.electron?.mainWindow, globalThis.electron?.subtitleWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(electronEvent.CHAT_WINDOW_MODE_UPDATED, getChatWindowMode());
  }
};

/**
 * IPC ハンドラを登録する。
 * @param modeChanged モード変更を字幕ウィンドウや補助ハンドルへ反映する関数
 */
export const registerChatWindowModeHandlers = (modeChanged: () => void = () => {}) => {
  onModeChanged = modeChanged;
  ipcMain.handle(electronEvent.GET_CHAT_WINDOW_MODE, () => getChatWindowMode());
  ipcMain.handle(electronEvent.SET_CHAT_WINDOW_MODE, async (_event, patch: Partial<ChatWindowMode>) => {
    const prev = mode;
    mode = {
      alwaysOnTop: typeof patch?.alwaysOnTop === 'boolean' ? patch.alwaysOnTop : prev.alwaysOnTop,
      frameless: typeof patch?.frameless === 'boolean' ? patch.frameless : prev.frameless,
    };
    log.info(`[set] ${JSON.stringify(mode)}`);
    store?.set('chatWindowMode', mode);

    const win = globalThis.electron?.subtitleWindow;
    if (win && !win.isDestroyed()) applyChatWindowRuntimeMode(win);
    onModeChanged();
    notify();
    return getChatWindowMode();
  });
};
