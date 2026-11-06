import electron from 'electron';
import { electronEvent } from '../main/const';
import type { ChatWindowMode } from '../main/chatWindowMode';

const ipcRenderer = electron.ipcRenderer;
const list = document.getElementById('res-list') as HTMLUListElement;
let currentDisplayId: number | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let isResizing = false;
const frame = document.getElementById('subtitle-frame') as HTMLDivElement;

const clearSubtitle = () => {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  currentDisplayId = null;
  list.innerHTML = '';
};

ipcRenderer.on(electronEvent.SHOW_COMMENT, (_event: any, args: { id: number; dom: string; durationMs: number; dispType: number }) => {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  currentDisplayId = args.id;
  list.innerHTML = args.dom;

  // チャット風は設定秒数で消す。SpeechCast風はOBS側のresetと同じタイミングでmainから消す。
  if (args.dispType === 0) {
    clearTimer = setTimeout(() => {
      if (currentDisplayId === args.id) {
        clearSubtitle();
        ipcRenderer.send(electronEvent.CLEAR_DESKTOP_SUBTITLE, args.id);
      }
    }, Math.max(0, args.durationMs));
  }
});

ipcRenderer.on(electronEvent.CLEAR_DESKTOP_SUBTITLE, (_event: any, displayId?: number) => {
  if (typeof displayId === 'number' && displayId !== currentDisplayId) return;
  clearSubtitle();
});

const updateFrameVisibility = (mode: ChatWindowMode) => {
  // frameless は「カスタム枠を隠す」意味。背景は常に透過。
  frame.classList.toggle('hidden', mode.frameless);
};

ipcRenderer.on(electronEvent.CHAT_WINDOW_MODE_UPDATED, (_event: any, mode: ChatWindowMode) => updateFrameVisibility(mode));
void ipcRenderer.invoke(electronEvent.GET_CHAT_WINDOW_MODE).then(updateFrameVisibility);

document.querySelectorAll<HTMLElement>('[data-resize-edge]').forEach((edgeElement) => {
  edgeElement.addEventListener('pointerdown', (event: PointerEvent) => {
    if (frame.classList.contains('hidden')) return;
    event.preventDefault();
    isResizing = true;
    edgeElement.setPointerCapture(event.pointerId);
    ipcRenderer.send(electronEvent.START_DESKTOP_SUBTITLE_RESIZE, edgeElement.dataset.resizeEdge);
  });
});

const finishResize = () => {
  if (!isResizing) return;
  isResizing = false;
  ipcRenderer.send(electronEvent.END_DESKTOP_SUBTITLE_RESIZE);
};
window.addEventListener('pointerup', finishResize);
window.addEventListener('pointercancel', finishResize);

/** 設定画面で編集した CSS は字幕ウィンドウだけに適用する。 */
const applyUserCss = (css: string) => {
  let style = document.getElementById('user-css') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'user-css';
    document.head.appendChild(style);
  }
  style.textContent = css;
};

ipcRenderer.on(electronEvent.APPLY_CHAT_WINDOW_CSS, (_event: any, css: string) => applyUserCss(css));
void ipcRenderer.invoke(electronEvent.GET_CHAT_WINDOW_CSS).then((css: string) => {
  if (!document.getElementById('user-css')) applyUserCss(css);
});
