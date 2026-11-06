import type {} from '../../types/global';

export type AppConfig = (typeof globalThis)['config'];

/** デスクトップ字幕の既定CSS。初回起動時に設定へコピーし、設定画面から編集できる。 */
const defaultDesktopSubtitleCss = `@import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@900&display=swap');

body {
  background-color: transparent !important;
  margin: 0;
  overflow: hidden;
  font-family: "M PLUS Rounded 1c", "Meiryo", sans-serif !important;
  font-size: 32px !important;
  font-weight: 900 !important;
  line-height: 1.25 !important;
  letter-spacing: -0.03em;
  color: #ffffff !important;
}

/* unacast の文字全体 */
.content,
.resNumber,
.name,
.date,
li,
span {
  color: #ffffff !important;
  font-family: "M PLUS Rounded 1c", "Meiryo", sans-serif !important;
  font-weight: 900 !important;
  /* 内側の青フチ */
  -webkit-text-stroke: 2px #1828ff !important;
  /* 外側の細い黒フチ */
  text-shadow:
    -3px -3px 0 #000,
    0 -3px 0 #000,
    3px -3px 0 #000,
    -3px 0 0 #000,
    3px 0 0 #000,
    -3px 3px 0 #000,
    0 3px 0 #000,
    3px 3px 0 #000 !important;
}`;

const DESKTOP_SUBTITLE_CSS_MIGRATION_KEY = 'desktopSubtitleCssV1';

export const defaultConfig: AppConfig = {
  url: '',
  resNumber: '',
  initMessage: 'スレッド読み込みを開始しました',
  port: 3000,
  interval: 10,
  dispNumber: NaN,
  youtubeId: '',
  youtubeLiveId: '',
  twitchId: '',
  niconicoId: '',
  twitcastingId: '',
  jpnknFastBoardId: '',
  dispSort: false,
  minDisplayTime: 2.5,
  newLine: true,
  showIcon: true,
  showNumber: true,
  showName: false,
  showTime: false,
  wordBreak: true,
  thumbnail: 0,
  hideImgUrl: false,
  emoteAnimation: false,
  emoteSize: 1,
  iconDirBbs: '',
  iconDirYoutube: '',
  iconDirTwitch: '',
  iconDirNiconico: '',
  iconDirTwitcasting: '',
  iconDirStt: '',
  sePath: '',
  playSeVolume: 100,
  playSe: false,
  playSeStt: false,
  typeYomiko: 'none',
  typeYomikoStt: 'none',
  yomikoDictionary: [
    { pattern: "h?ttps?://[A-Za-z0-9:/?#\\[\\]@!$&'()*+.,;=%-]+", pronunciation: 'URL' },
    { pattern: 'www+', pronunciation: 'わらわら' },
    { pattern: 'ｗｗｗ+', pronunciation: 'わらわら' },
  ],
  tamiyasuPath: '',
  bouyomiPort: 50001,
  bouyomiVolume: 50,
  voicevox: {
    path: '',
    engineUrl: '',
    speakerAndStyle: '',
  },
  yomikoReplaceNewline: false,
  yomikoSkipResNumbers: '',
  yomikoOmit: {
    enable: false,
    maxLength: 100,
  },
  yomikoTemplate: { default: '{text}', perSource: {} },
  bbsAnonymousName: '',
  notifyThreadConnectionErrorLimit: 0,
  notifyThreadResLimit: 0,
  moveThread: true,
  autoCreateThread: { enable: false, resThreshold: 950 },
  commentProcessType: 0,
  dispType: 0,
  aamode: {
    enable: true,
    condition: {
      length: 200,
      words: ['д', '（●）', '从', '）)ﾉヽ', '∀', '<●>', '（__人__）'],
    },
    speakWord: 'アスキーアート',
  },
  chatWindowCss: defaultDesktopSubtitleCss,
  translate: {
    enable: true,
    targetLang: 'ja',
  },
  sherpaStt: {
    enable: false,
    name: '',
    inputDevice: 'default',
  },
  audioOutputDevices: ['default'],
  external: {
    enabled: false,
    iconDir: '',
  },
  sourceFilter: {
    broadcast: {
      bbs: true,
      jpnkn: true,
      youtube: true,
      twitch: true,
      niconico: true,
      twitcasting: true,
      stt: true,
      external: true,
    },
  },
  ngWords: [],
};

const STORAGE_KEY = 'config';

export const loadConfigFromStorage = (): AppConfig => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(DESKTOP_SUBTITLE_CSS_MIGRATION_KEY, '1');
    return { ...defaultConfig };
  }
  try {
    const stored = JSON.parse(raw) as Partial<AppConfig>;
    const shouldSeedDesktopSubtitleCss =
      localStorage.getItem(DESKTOP_SUBTITLE_CSS_MIGRATION_KEY) !== '1' &&
      (typeof stored.chatWindowCss !== 'string' || stored.chatWindowCss === '');
    localStorage.setItem(DESKTOP_SUBTITLE_CSS_MIGRATION_KEY, '1');
    return {
      ...defaultConfig,
      ...stored,
      chatWindowCss: shouldSeedDesktopSubtitleCss ? defaultDesktopSubtitleCss : (stored.chatWindowCss ?? defaultConfig.chatWindowCss),
      // トップレベルの浅いマージだけだと、後から増えたネストのキー (engineUrl 等) が
      // 旧保存データで欠けたままになるため、ネストしたオブジェクトは既定値で補完する
      voicevox: { ...defaultConfig.voicevox, ...stored.voicevox },
      yomikoOmit: { ...defaultConfig.yomikoOmit, ...stored.yomikoOmit },
    };
  } catch {
    return { ...defaultConfig };
  }
};

export const saveConfigToStorage = (config: AppConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};
