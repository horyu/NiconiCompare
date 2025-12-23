import styleText from "data-text:../style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useRef, useState } from "react"

import { DEFAULT_SETTINGS, MESSAGE_TYPES, STORAGE_KEYS } from "../lib/constants"
import {
  extractVideoDataFromLdJson,
  observeLdJsonChanges
} from "../lib/dom-observer"
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
  const [pinnedOpponentVideoId, setPinnedOpponentVideoId] = useState<string>()
  const [overlaySettings, setOverlaySettings] =
    useState<NcSettings>(DEFAULT_SETTINGS)
  const [isReady, setIsReady] = useState(false)
  const [videoSnapshots, setVideoSnapshots] = useState<
    Record<string, VideoSnapshot>
  >({})
  const [statusMessage, setStatusMessage] = useState<string>()
  const [isHovered, setIsHovered] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [lastVerdict, setLastVerdict] = useState<Verdict>()
  const [lastEventId, setLastEventId] = useState<number>()

  const autoCloseTimerRef = useRef<number>()
  const previousCurrentVideoIdRef = useRef<string>()

  // Chrome storage listener
  useEffect(() => {
    if (!chrome.storage?.onChanged) return

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
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

  const loadVideoSnapshots = useCallback(async () => {
    if (!chrome.storage?.local) return
    const result = await chrome.storage.local.get(STORAGE_KEYS.videos)
    setVideoSnapshots(result?.[STORAGE_KEYS.videos] ?? {})
  }, [])

  const clearAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = undefined
    }
  }, [])

  const scheduleAutoClose = useCallback(() => {
    clearAutoCloseTimer()
    const timeout = overlaySettings.overlayAutoCloseMs ?? 2000
    autoCloseTimerRef.current = window.setTimeout(() => {
      if (!isHovered) {
        setShowControls(false)
      }
      autoCloseTimerRef.current = undefined
    }, timeout)
  }, [clearAutoCloseTimer, overlaySettings.overlayAutoCloseMs, isHovered])

  const refreshState = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.requestState
    })

    if (!response?.ok) {
      return
    }

    const data = response.data as StateResponse
    setOverlaySettings(data.settings)
    setRecentWindow(data.state.recentWindow)
    setCurrentVideoId(data.state.currentVideoId)
    setPinnedOpponentVideoId(data.state.pinnedOpponentVideoId)
    await loadVideoSnapshots()
    setIsReady(true)

    if (data.state.currentVideoId) {
      setStatusMessage(undefined)
    } else {
      setStatusMessage("再生中動画を検出できません")
    }
  }, [loadVideoSnapshots])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  const handleVideoChange = useCallback(
    async (videoData: { video: VideoSnapshot; author: AuthorProfile }) => {
      if (!isReady || !overlaySettings.overlayAndCaptureEnabled) {
        return
      }
      setStatusMessage(undefined)
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
    },
    [
      currentVideoId,
      isReady,
      refreshState,
      overlaySettings.overlayAndCaptureEnabled
    ]
  )

  // JSON-LD observer
  useEffect(() => {
    if (!isReady || !overlaySettings.overlayAndCaptureEnabled) {
      return
    }
    const cleanup = observeLdJsonChanges({
      onVideoDataChange: handleVideoChange,
      onError: setStatusMessage
    })

    const videoData = extractVideoDataFromLdJson()
    if (videoData) {
      handleVideoChange(videoData)
    } else {
      setStatusMessage("動画情報を取得中...")
    }

    return cleanup
  }, [handleVideoChange, isReady, overlaySettings.overlayAndCaptureEnabled])

  // Auto-close handler
  useEffect(() => {
    if (forceKeepOverlayOpen) {
      setShowControls(true)
      clearAutoCloseTimer()
      return
    }

    if (!isReady || !overlaySettings.overlayAndCaptureEnabled) {
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
    isReady,
    overlaySettings.overlayAndCaptureEnabled,
    overlaySettings.overlayAutoCloseMs,
    clearAutoCloseTimer,
    scheduleAutoClose
  ])

  // Update UI when state changes
  useEffect(() => {
    const selectableWindow = recentWindow.filter((id) => id !== currentVideoId)
    const currentChanged = previousCurrentVideoIdRef.current !== currentVideoId

    if (pinnedOpponentVideoId) {
      if (opponentVideoId !== pinnedOpponentVideoId) {
        setOpponentVideoId(pinnedOpponentVideoId)
      }
      previousCurrentVideoIdRef.current = currentVideoId
      return
    }

    if (selectableWindow.length === 0) {
      setOpponentVideoId(undefined)
      previousCurrentVideoIdRef.current = currentVideoId
      return
    }

    const previousSelectable =
      currentChanged &&
      previousCurrentVideoIdRef.current &&
      selectableWindow.includes(previousCurrentVideoIdRef.current)
        ? previousCurrentVideoIdRef.current
        : undefined

    if (
      currentChanged ||
      !opponentVideoId ||
      !selectableWindow.includes(opponentVideoId)
    ) {
      setOpponentVideoId(previousSelectable ?? selectableWindow[0])
    }

    previousCurrentVideoIdRef.current = currentVideoId
  }, [recentWindow, currentVideoId, opponentVideoId, pinnedOpponentVideoId])

  useEffect(() => {
    setLastVerdict(undefined)
    setLastEventId(undefined)
  }, [currentVideoId, opponentVideoId])

  const togglePinnedOpponent = useCallback(async () => {
    if (!opponentVideoId && !pinnedOpponentVideoId) {
      return
    }

    const nextPinned = pinnedOpponentVideoId ? undefined : opponentVideoId
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.updatePinnedOpponent,
      payload: { videoId: nextPinned }
    })

    if (response?.ok) {
      setPinnedOpponentVideoId(nextPinned)
      await refreshState()
    }
  }, [opponentVideoId, pinnedOpponentVideoId, refreshState])

  const submitVerdict = async (verdict: Verdict) => {
    if (lastVerdict === verdict) {
      if (!lastEventId) {
        setLastVerdict(undefined)
        return
      }

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.deleteEvent,
        payload: { eventId: lastEventId }
      })

      setLastVerdict(undefined)
      setLastEventId(undefined)

      if (response?.ok) {
        await refreshState()
      }
      return
    }

    if (!opponentVideoId || !currentVideoId) return

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.recordEvent,
      payload: {
        currentVideoId,
        opponentVideoId,
        verdict,
        eventId: lastEventId
      }
    })

    if (response?.ok) {
      setLastVerdict(verdict)
      setLastEventId(response.eventId)
      await refreshState()
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

  // NOTE: dev mode (HMR) では一瞬表示されることがあるが、prod build では発生しない。
  if (!isReady || !overlaySettings.overlayAndCaptureEnabled) {
    return null
  }
  const selectableWindow = recentWindow.filter((id) => id !== currentVideoId)
  const hasSelectableCandidates = selectableWindow.length > 0
  const isPinned = !!pinnedOpponentVideoId
  const pinnedSameMessage =
    isPinned && pinnedOpponentVideoId === currentVideoId
      ? "比較不可: 再生中と同じ動画が固定されています"
      : undefined
  const displayStatus = statusMessage ?? pinnedSameMessage
  const canSubmit = currentVideoId && opponentVideoId && !displayStatus
  const opponentWatchUrl = opponentVideoId
    ? `https://www.nicovideo.jp/watch/${opponentVideoId}`
    : undefined

  return (
    <div
      className="fixed top-0 right-0 z-[2147483647] bg-black/75 text-white p-3 rounded-lg shadow-lg max-w-[320px] flex flex-col gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <strong className="text-right w-full">NiconiCompare</strong>

      {displayStatus && (
        <span className="text-xs opacity-80 text-right w-full">
          {displayStatus}
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
              {opponentWatchUrl ? (
                <a href={opponentWatchUrl} target="_blank" rel="noreferrer">
                  {getThumbnailUrl(opponentVideoId) ? (
                    <img
                      src={getThumbnailUrl(opponentVideoId)}
                      alt="選択中の動画"
                      className="w-full aspect-video object-cover rounded-md bg-white/10"
                    />
                  ) : (
                    <div className="w-full aspect-video rounded-md bg-white/10" />
                  )}
                </a>
              ) : getThumbnailUrl(opponentVideoId) ? (
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
                <div className="w-full flex items-center gap-1">
                  <label
                    htmlFor="nc-select"
                    className="relative flex-1 flex items-center">
                    <span className="pt-[3px] pb-[1px] px-1.5 pr-6 rounded border border-white/30 bg-[#1f1f1f] text-[12px] overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none w-full">
                      {opponentVideoId
                        ? opponentVideoId
                        : hasSelectableCandidates
                          ? "比較候補を選択してください"
                          : "比較対象がありません"}
                    </span>
                    <span className="absolute right-2 text-[10px] opacity-70 pointer-events-none">
                      ▼
                    </span>
                    <select
                      id="nc-select"
                      value={opponentVideoId ?? ""}
                      disabled={isPinned}
                      onChange={(e) => setOpponentVideoId(e.target.value)}
                      onBlur={() => {
                        if (forceKeepOverlayOpen) {
                          return
                        }
                        if (!autoCloseTimerRef.current) {
                          scheduleAutoClose()
                        }
                      }}
                      className={[
                        "absolute inset-0 opacity-0 z-[5] text-black bg-white",
                        isPinned ? "cursor-not-allowed" : "cursor-pointer"
                      ].join(" ")}>
                      {!hasSelectableCandidates ? (
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
                  <button
                    type="button"
                    onClick={togglePinnedOpponent}
                    disabled={!opponentVideoId}
                    title={isPinned ? "固定解除" : "比較対象を固定"}
                    className="px-1.5 py-1 rounded border border-white/30 bg-[#1f1f1f] text-[12px] leading-none disabled:opacity-40">
                    <span className="inline-block filter grayscale">
                      {isPinned ? "🔒" : "🔓"}
                    </span>
                  </button>
                </div>
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
