export const NICONICO_WATCH_BASE_URL = "https://www.nicovideo.jp/watch"

export const createWatchUrl = (videoId: string): string =>
  `${NICONICO_WATCH_BASE_URL}/${videoId}`
