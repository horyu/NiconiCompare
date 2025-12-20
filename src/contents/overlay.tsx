import styleText from "data-text:../style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"

import { DEFAULT_SETTINGS, MESSAGE_TYPES, STORAGE_KEYS } from "../lib/constants"
import type {
  AuthorProfile,
  NcSettings,
  NcState,
  Verdict,
  VideoSnapshot
} from "../lib/types"

export const config: PlasmoCSConfig = {
  matches: ["https://www.nicovideo.jp/watch/*"]
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

const keepOverlayEnvValue = String(process.env.PLASMO_PUBLIC_KEEP_OVERLAY_OPEN)
const forceKeepOverlayOpen = keepOverlayEnvValue.toLowerCase() === "true"

type StateResponse = {
  settings: NcSettings
  state: NcState
}

export default function Overlay() {
  const [currentVideoId, setCurrentVideoId] = useState<string>()
  const [recentWindow, setRecentWindow] = useState<string[]>([])
  const [opponentVideoId, setOpponentVideoId] = useState<string>()
  const [overlaySettings, setOverlaySettings] =
    useState<NcSettings>(DEFAULT_SETTINGS)
  const [videoSnapshots, setVideoSnapshots] = useState<
    Record<string, VideoSnapshot>
  >({})
  const [statusMessage, setStatusMessage] = useState<string>()
  const [isHovered, setIsHovered] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [lastVerdict, setLastVerdict] = useState<Verdict>()

  const autoCloseTimerRef = useRef<number>()
  const observerScheduledRef = useRef(false)

  // Chrome storage listener
  useEffect(() => {
    if (!chrome.storage?.onChanged) return

    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName !== "local") return

      if (changes[STORAGE_KEYS.settings]?.newValue) {
        setOverlaySettings(
          changes[STORAGE_KEYS.settings].newValue ?? DEFAULT_SETTINGS
        )
      }

      if (changes[STORAGE_KEYS.videos]?.newValue) {
        setVideoSnapshots(changes[STORAGE_KEYS.videos].newValue ?? {})
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  // Load initial video snapshots
  useEffect(() => {
    loadVideoSnapshots()
  }, [])

  // JSON-LD observer
  useEffect(() => {
    const observer = observeLdJsonChanges()

    const videoData = extractVideoDataFromLdJson()
    if (videoData) {
      handleVideoChange(videoData)
    } else {
      setStatusMessage("動画情報を取得中...")
    }

    return () => observer?.disconnect()
  }, [])

  // Auto-close handler
  useEffect(() => {
    if (forceKeepOverlayOpen) {
      setShowControls(true)
      clearAutoCloseTimer()
      return
    }

    if (!overlaySettings.overlayEnabled) {
      setShowControls(false)
      clearAutoCloseTimer()
      return
    }

    if (isHovered) {
      clearAutoCloseTimer()
      setShowControls(true)
      return
    }

    setShowControls(true)
    scheduleAutoClose()
  }, [
    isHovered,
    overlaySettings.overlayEnabled,
    overlaySettings.overlayAutoCloseMs
  ])

  // Update UI when state changes
  useEffect(() => {
    const selectableWindow = recentWindow.filter((id) => id !== currentVideoId)
    if (selectableWindow.length === 0) {
      if (opponentVideoId) {
        setOpponentVideoId(undefined)
      }
      return
    }

    if (!opponentVideoId || opponentVideoId === currentVideoId) {
      setOpponentVideoId(selectableWindow[0])
    }
  }, [recentWindow, currentVideoId])

  useEffect(() => {
    setLastVerdict(undefined)
  }, [currentVideoId])

  const loadVideoSnapshots = async () => {
    if (!chrome.storage?.local) return
    const result = await chrome.storage.local.get(STORAGE_KEYS.videos)
    setVideoSnapshots(result?.[STORAGE_KEYS.videos] ?? {})
  }

  const observeLdJsonChanges = () => {
    const head = document.head
    if (!head) {
      console.error("document.head is missing; ld+json observer disabled.")
      setStatusMessage("動画情報を取得できません")
      return undefined
    }

    const observer = new MutationObserver(() => scheduleLdJsonProcessing())
    observer.observe(head, { childList: true, subtree: true })
    return observer
  }

  const scheduleLdJsonProcessing = () => {
    if (observerScheduledRef.current) return
    observerScheduledRef.current = true

    const runner = () => {
      observerScheduledRef.current = false
      const videoData = extractVideoDataFromLdJson()
      if (videoData) {
        handleVideoChange(videoData)
      }
    }

    if ("requestIdleCallback" in window) {
      ;(window.requestIdleCallback as (cb: () => void) => number)(runner)
    } else {
      setTimeout(runner, 0)
    }
  }

  const handleVideoChange = async (videoData: {
    video: VideoSnapshot
    author: AuthorProfile
  }) => {
    if (currentVideoId === videoData.video.videoId) return

    setCurrentVideoId(videoData.video.videoId)

    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.registerSnapshot,
      payload: { video: videoData.video, author: videoData.author }
    })

    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.updateCurrentVideo,
      payload: { videoId: videoData.video.videoId }
    })

    await refreshState()
  }

  const refreshState = async () => {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.requestState
    })

    if (!response?.ok) return

    const data = response.data as StateResponse
    setOverlaySettings(data.settings)
    setRecentWindow(data.state.recentWindow)
    setCurrentVideoId(data.state.currentVideoId)
    await loadVideoSnapshots()

    if (data.state.currentVideoId) {
      setStatusMessage(undefined)
    } else {
      setStatusMessage("再生中動画を検出できません")
    }
  }

  const submitVerdict = async (verdict: Verdict) => {
    if (!opponentVideoId || !currentVideoId) return
    setLastVerdict(verdict)

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.recordEvent,
      payload: {
        currentVideoId,
        opponentVideoId,
        verdict
      }
    })

    if (response?.ok) {
      await refreshState()
    }
  }

  const scheduleAutoClose = () => {
    clearAutoCloseTimer()
    const timeout = overlaySettings.overlayAutoCloseMs ?? 2000
    autoCloseTimerRef.current = window.setTimeout(() => {
      if (!isHovered) {
        setShowControls(false)
      }
      autoCloseTimerRef.current = undefined
    }, timeout)
  }

  const clearAutoCloseTimer = () => {
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = undefined
    }
  }

  const formatVideoLabel = (videoId?: string) => {
    if (!videoId) return ""
    const snapshot = videoSnapshots[videoId]
    if (snapshot?.title) {
      return `${videoId} | ${snapshot.title}`
    }
    return videoId
  }

  const getThumbnailUrl = (videoId?: string) => {
    if (!videoId) return undefined
    return videoSnapshots[videoId]?.thumbnailUrls?.[0]
  }

  const getVerdictButtonClass = (verdict: Verdict) =>
    [
      "px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap w-full",
      lastVerdict === verdict
        ? "bg-white text-black shadow-inner ring-2 ring-white/80"
        : "bg-white/20 hover:bg-white/30"
    ].join(" ")

  if (!overlaySettings.overlayEnabled) {
    return null
  }

  const selectableWindow = recentWindow.filter((id) => id !== currentVideoId)
  const hasVideos = selectableWindow.length > 0
  const canSubmit = hasVideos && currentVideoId && opponentVideoId

  return (
    <div
      className="fixed top-0 right-0 z-[2147483647] bg-black/75 text-white p-3 rounded-lg shadow-lg max-w-[320px] flex flex-col gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <strong className="text-right w-full">NiconiCompare</strong>

      {statusMessage && (
        <span className="text-xs opacity-80 text-right w-full">
          {statusMessage}
        </span>
      )}

      {showControls && (
        <div className="flex flex-col gap-2">
          {/* Verdict buttons */}
          <div className="grid grid-cols-[105px_70px_105px] gap-2 items-center">
            <button
              onClick={() => submitVerdict("better")}
              aria-pressed={lastVerdict === "better"}
              disabled={!canSubmit}
              className={getVerdictButtonClass("better")}>
              再生中の動画
            </button>
            <button
              onClick={() => submitVerdict("same")}
              aria-pressed={lastVerdict === "same"}
              disabled={!canSubmit}
              className={getVerdictButtonClass("same")}>
              引き分け
            </button>
            <button
              onClick={() => submitVerdict("worse")}
              aria-pressed={lastVerdict === "worse"}
              disabled={!canSubmit}
              className={getVerdictButtonClass("worse")}>
              選択中の動画
            </button>
          </div>

          {/* Video comparison */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
            {/* Current video */}
            <div className="flex flex-col gap-2">
              {getThumbnailUrl(currentVideoId) ? (
                <img
                  src={getThumbnailUrl(currentVideoId)}
                  alt="現在の動画"
                  className="w-full aspect-video object-cover rounded-md bg-white/10"
                />
              ) : (
                <div className="w-full aspect-video rounded-md bg-white/10" />
              )}
              <div className="text-[14px] opacity-90 text-right break-all overflow-hidden w-full">
                {currentVideoId
                  ? formatVideoLabel(currentVideoId)
                  : "再生中動画を検出できません"}
              </div>
            </div>

            {/* VS label */}
            <div className="flex items-center justify-center self-center">
              <div className="text-center text-[14px] font-bold opacity-70">
                vs
              </div>
            </div>

            {/* Selected video */}
            <div className="flex flex-col gap-[5px]">
              {getThumbnailUrl(opponentVideoId) ? (
                <img
                  src={getThumbnailUrl(opponentVideoId)}
                  alt="選択中の動画"
                  className="w-full aspect-video object-cover rounded-md bg-white/10"
                />
              ) : (
                <div className="w-full aspect-video rounded-md bg-white/10" />
              )}

              {/* Custom select */}
              <div className="w-full flex flex-col items-start">
                <label
                  htmlFor="nc-select"
                  className="relative w-full flex items-center">
                  <span className="pt-[3px] pb-[1px] px-1.5 pr-6 rounded border border-white/30 bg-[#1f1f1f] text-[12px] overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none w-full">
                    {hasVideos
                      ? opponentVideoId ?? "比較候補を選択してください"
                      : "比較対象がありません"}
                  </span>
                  <span className="absolute right-2 text-[10px] opacity-70 pointer-events-none">
                    ▼
                  </span>
                  <select
                    id="nc-select"
                    value={opponentVideoId ?? ""}
                    onChange={(e) => setOpponentVideoId(e.target.value)}
                    onBlur={() => {
                      if (forceKeepOverlayOpen) {
                        return
                      }
                      if (!autoCloseTimerRef.current) {
                        scheduleAutoClose()
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-[5] text-black bg-white">
                    {!hasVideos ? (
                      <option value="">比較候補なし</option>
                    ) : (
                      selectableWindow.map((id, index) => (
                        <option key={id} value={id}>
                          {index + 1}. {formatVideoLabel(id)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <div className="text-[14px] opacity-90 self-stretch text-left break-all overflow-hidden">
                  {opponentVideoId
                    ? videoSnapshots[opponentVideoId]?.title ?? ""
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Utility functions (extracted from original code)
function extractVideoDataFromLdJson():
  | {
      video: VideoSnapshot
      author: AuthorProfile
    }
  | undefined {
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

function findLdJsonScripts() {
  return Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
}

function extractVideoIdFromUrl(target?: string) {
  if (!target) return undefined
  const url = target.startsWith("http")
    ? new URL(target)
    : new URL(target, window.location.origin)
  const segments = url.pathname.split("/")
  return segments.pop() || segments.pop()
}
