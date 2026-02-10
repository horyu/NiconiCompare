export const NICONICO_WATCH_BASE_URL = "https://www.nicovideo.jp/watch"

export const createWatchUrl = (videoId: string): string =>
  `${NICONICO_WATCH_BASE_URL}/${videoId}`

export const getWatchVideoIdFromPathname = (
  pathname: string
): string | undefined => {
  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  if (segments[0] !== "watch") {
    return undefined
  }
  return segments[1] || undefined
}
