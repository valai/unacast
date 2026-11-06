export const electronEvent = {
  /** サーバー起動 */
  START_SERVER: 'start-server',
  /** サーバー停止 */
  STOP_SERVER: 'stop-server',
  /** Config適用 */
  APPLY_CONFIG: 'apply-config',

  /** アラート表示 */
  SHOW_ALERT: 'show-alert',

  SAVE_CONFIG: 'save-config',

  /** 棒読み再生 */
  PLAY_TAMIYASU: 'play-tamiyasu',
  /** レス着信音再生 */
  PLAY_SOUND_START: 'play-sound-start',
  PLAY_SOUND_END: 'play-sound-end',

  WAIT_YOMIKO_TIME: 'wait-yomiko-time',
  SPEAK_WAV: 'speak-wav',
  ABORT_WAV: 'abort-wav',
  SPEAKING_END: 'speaking-end',
  /** 棒読みちゃん・民安★Talk の「読んでいる時間相当の待ち」を打ち切る main → renderer (読み上げ中断時) */
  CANCEL_WAIT_YOMIKO_TIME: 'cancel-wait-yomiko-time',

  /** 読み上げ中かどうかの取得・変更通知 (#77) */
  GET_SPEECH_STATE: 'get-speech-state',
  SPEECH_STATE_UPDATED: 'speech-state-updated',
  /** 読み上げを中断する renderer → main */
  STOP_SPEECH: 'stop-speech',

  // VOICEVOX の読み込み renderer → main
  LOAD_VOICEVOX: 'load-voicevox',
  // VOICEVOX の状態更新 renderer ← main
  UPDATE_VOICEVOX_CONFIG: 'update-voicevox-config',

  /** デスクトップ字幕のユーザー CSS を適用 renderer(設定画面) → main → renderer(字幕) */
  APPLY_CHAT_WINDOW_CSS: 'apply-chat-window-css',
  /** デスクトップ字幕のユーザー CSS を取得 (字幕ウィンドウの読み込み時) */
  GET_CHAT_WINDOW_CSS: 'get-chat-window-css',
  /** 通常のチャットボックスを表示する (設定画面 → main) */
  SHOW_CHAT_WINDOW: 'show-chat-window',
  /** デスクトップ字幕ウィンドウを表示する (設定画面 → main) */
  SHOW_DESKTOP_SUBTITLE: 'show-desktop-subtitle',
  /** デスクトップ字幕ウィンドウを隠す (設定画面 → main) */
  HIDE_DESKTOP_SUBTITLE: 'hide-desktop-subtitle',
  /** デスクトップ字幕を消す (main → 字幕 renderer)。引数 ID があれば表示世代を照合 */
  CLEAR_DESKTOP_SUBTITLE: 'clear-desktop-subtitle',
  /** 字幕枠のリサイズを開始/終了する (字幕 renderer → main) */
  START_DESKTOP_SUBTITLE_RESIZE: 'start-desktop-subtitle-resize',
  END_DESKTOP_SUBTITLE_RESIZE: 'end-desktop-subtitle-resize',

  /** デスクトップ字幕の最前面・カスタム枠モードの取得・変更・通知 */
  GET_CHAT_WINDOW_MODE: 'get-chat-window-mode',
  SET_CHAT_WINDOW_MODE: 'set-chat-window-mode',
  CHAT_WINDOW_MODE_UPDATED: 'chat-window-mode-updated',
  /** コメント表示 */
  SHOW_COMMENT: 'show-comment',
  /** コメント欄初期化 */
  CLEAR_COMMENT: 'clear-comment',

  /** 翻訳コメント表示 */
  SHOW_COMMENT_TL: 'show_comment_translate',

  /** サーバー起動の返信 */
  START_SERVER_REPLY: 'start-server-reply',

  /** 強制的に端にスクロール */
  FORCE_SCROLL: 'FORCE_SCROLL',

  /** ステータス更新 */
  UPDATE_STATUS: 'UPDATE_STATUS',

  /** コメントテスト */
  COMMENT_TEST: 'COMMENT_TEST',

  /** 画像プレビュー */
  PREVIEW_IMAGE: 'PREVIEW_IMAGE',

  /** スレッドブラウザを開く (renderer → main) */
  OPEN_THREAD_BROWSER: 'open-thread-browser',
  /** スレッドブラウザ: 初期化 (板情報の解決) */
  THREAD_BROWSER_INIT: 'thread-browser-init',
  /** スレッドブラウザ: スレ一覧取得 */
  THREAD_BROWSER_LIST: 'thread-browser-list',
  /** スレッドブラウザ: スレ内容プレビュー */
  THREAD_BROWSER_PREVIEW: 'thread-browser-preview',
  /** スレッドブラウザ: コメント読み込みスレッドの切り替え */
  THREAD_BROWSER_APPLY: 'thread-browser-apply',
  /**
   * スレッドブラウザ: main 側 config 未初期化時 (サーバー起動・適用前) のスレURL変更通知。
   * main → メイン設定ウィンドウ renderer。renderer 側で config.url を更新・永続化する。
   */
  THREAD_BROWSER_URL_SELECTED: 'thread-browser-url-selected',
  /** スレッドブラウザ: スレ立てフォームへのコピー元 (現在のスレの1レス目) 取得 */
  THREAD_BROWSER_CREATE_SOURCE: 'thread-browser-create-source',
  /** スレッドブラウザ: スレ立て実行 */
  THREAD_BROWSER_CREATE: 'thread-browser-create',
  /** 自動スレ立て: 生成されるタイトル・本文のプレビュー */
  AUTO_CREATE_THREAD_PREVIEW: 'auto-create-thread-preview',

  /** Sherpa Speech To text **/
  SHERPA_STT: 'sherpa-stt',
  /** クリップボードへの書き込み (renderer → main)。Electron 44 以降 renderer から clipboard を直接使えないため */
  CLIPBOARD_WRITE_TEXT: 'clipboard-write-text',
  /** クリップボードの読み出し (renderer → main) */
  CLIPBOARD_READ_TEXT: 'clipboard-read-text',
  /** 音声認識: マイク音声を認識プロセスへ直接送る MessagePort の受け渡し (main → renderer) */
  SHERPA_STT_AUDIO_PORT: 'sherpa-stt-audio-port',
};
