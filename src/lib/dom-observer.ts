import type { AuthorProfile, VideoSnapshot } from "./types"

/**
 * Video data extracted from JSON-LD
 */
export type VideoData = {
  video: VideoSnapshot
  author: AuthorProfile
}

/**
 * Callbacks for observer events
 */
export type ObserverCallbacks = {
  onVideoDataChange: (data: VideoData) => void
  onError: (message: string) => void
}

/**
 * Creates and starts a MutationObserver to watch for JSON-LD changes in document.head.
 * Returns a cleanup function to disconnect the observer.
 *
 * @param callbacks - Callbacks for handling video data changes and errors
 * @returns Cleanup function to disconnect the observer, or undefined if setup failed
 */
export function observeLdJsonChanges(
  callbacks: ObserverCallbacks
): (() => void) | undefined {
  const head = document.head
  if (!head) {
    console.error("document.head is missing; ld+json observer disabled.")
    callbacks.onError("動画情報を取得できません")
    return undefined
  }

  // Internal state for debouncing (encapsulated in closure)
  let isScheduled = false

  const scheduleLdJsonProcessing = () => {
    if (isScheduled) return
    isScheduled = true

    const runner = () => {
      isScheduled = false
      const videoData = extractVideoDataFromLdJson()
      if (videoData) {
        callbacks.onVideoDataChange(videoData)
      }
    }

    if ("requestIdleCallback" in window) {
      ;(window.requestIdleCallback as (cb: () => void) => number)(runner)
    } else {
      setTimeout(runner, 0)
    }
  }

  const observer = new MutationObserver(() => scheduleLdJsonProcessing())
  observer.observe(head, { childList: true, subtree: true })

  return () => observer.disconnect()
}

/**
 * Extracts video data from JSON-LD scripts in the current document.
 *
 * @returns Video data if found, undefined otherwise
 */
export function extractVideoDataFromLdJson(): VideoData | undefined {
  const scripts = findLdJsonScripts()
  if (scripts.length === 0) return undefined

  for (const script of scripts) {
    if (!script.textContent) continue

    try {
      const parsed = JSON.parse(script.textContent)
      const videoObject = Array.isArray(parsed)
        ? parsed.find((item) => item?.["@type"] === "VideoObject")
        : parsed

      if (!videoObject) continue

      const authorData = Array.isArray(videoObject.author)
        ? videoObject.author[0]
        : videoObject.author

      const videoId =
        videoObject.identifier ||
        videoObject.videoId ||
        extractVideoIdFromUrl(videoObject.url) ||
        extractVideoIdFromUrl(window.location.pathname)

      if (!videoId) continue

      const author: AuthorProfile = {
        authorUrl:
          authorData?.url ||
          authorData?.["@id"] ||
          document.querySelector<HTMLAnchorElement>('[rel="author"]')?.href ||
          window.location.origin,
        name:
          authorData?.name ||
          document.querySelector('[rel="author"]')?.textContent ||
          "unknown",
        capturedAt: Date.now()
      }

      const video: VideoSnapshot = {
        videoId,
        title: videoObject.name || document.title || videoId,
        authorUrl: author.authorUrl,
        thumbnailUrls: Array.isArray(videoObject.thumbnailUrl)
          ? videoObject.thumbnailUrl
          : videoObject.thumbnailUrl
            ? [videoObject.thumbnailUrl]
            : [],
        lengthSeconds: Number(videoObject.duration ?? 0),
        capturedAt: Date.now()
      }

      return { video, author }
    } catch (error) {
      console.error("Failed to parse ld+json", error)
    }
  }
  return undefined
}

/**
 * Finds all JSON-LD script elements in the document.
 */
function findLdJsonScripts(): HTMLScriptElement[] {
  return Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
}

/**
 * Extracts video ID from a URL string.
 */
function extractVideoIdFromUrl(target?: string): string | undefined {
  if (!target) return undefined
  const url = target.startsWith("http")
    ? new URL(target)
    : new URL(target, window.location.origin)
  const segments = url.pathname.split("/")
  return segments.pop() || segments.pop()
}
