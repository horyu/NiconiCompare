import { handleUIError } from "./error-handler"
import type { AuthorProfile, VideoSnapshot } from "./types"

type LdAuthor = {
  "@id"?: string
  url?: string
  name?: string
}

type LdVideoObject = {
  "@type"?: string
  author?: LdAuthor | LdAuthor[]
  identifier?: string
  videoId?: string
  url?: string
  name?: string
  thumbnailUrl?: string | string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

const asLdAuthor = (value: unknown): LdAuthor | undefined =>
  isRecord(value) ? (value as LdAuthor) : undefined

const asLdVideoObject = (value: unknown): LdVideoObject | undefined =>
  isRecord(value) ? (value as LdVideoObject) : undefined

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
    handleUIError(
      "document.head is missing; ld+json observer disabled.",
      "ui:dom-observer:missing-head"
    )
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
      const parsed: unknown = JSON.parse(script.textContent)
      const videoObject = Array.isArray(parsed)
        ? parsed
            .map((item) => asLdVideoObject(item))
            .find((item) => item?.["@type"] === "VideoObject")
        : asLdVideoObject(parsed)

      if (!videoObject || videoObject["@type"] !== "VideoObject") continue

      const authorData = Array.isArray(videoObject.author)
        ? asLdAuthor(videoObject.author[0])
        : asLdAuthor(videoObject.author)

      const videoId =
        readString(videoObject.identifier) ||
        readString(videoObject.videoId) ||
        extractVideoIdFromUrl(readString(videoObject.url)) ||
        extractVideoIdFromUrl(window.location.pathname)

      if (!videoId) continue

      const author: AuthorProfile = {
        authorUrl:
          readString(authorData?.url) ||
          readString(authorData?.["@id"]) ||
          document.querySelector<HTMLAnchorElement>('[rel="author"]')?.href ||
          window.location.origin,
        name:
          readString(authorData?.name) ||
          document.querySelector('[rel="author"]')?.textContent ||
          "unknown",
        capturedAt: Date.now()
      }

      const thumbnailUrl = readString(videoObject.thumbnailUrl)
      const thumbnailUrls = Array.isArray(videoObject.thumbnailUrl)
        ? videoObject.thumbnailUrl.filter(
            (item): item is string => typeof item === "string"
          )
        : thumbnailUrl
          ? [thumbnailUrl]
          : []

      const video: VideoSnapshot = {
        videoId,
        title: readString(videoObject.name) || document.title || videoId,
        authorUrl: author.authorUrl,
        thumbnailUrls,
        capturedAt: Date.now()
      }

      return { video, author }
    } catch (error) {
      handleUIError(error, "ui:dom-observer:parse-ld-json")
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
