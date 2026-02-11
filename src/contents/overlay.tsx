import { useCallback, useState, type ReactElement } from "react"

import { MESSAGE_TYPES, OVERLAY_STATUS_MESSAGES } from "../lib/constants"
import { sendNcMessage } from "../lib/messages"
import { runNcAction } from "../lib/ncAction"
import type { AuthorProfile, VideoSnapshot } from "../lib/types"
import { getWatchVideoIdFromPathname } from "../lib/url"
import { CategorySelector } from "./components/CategorySelector"
import { OpponentSelector } from "./components/OpponentSelector"
import { VerdictButtons } from "./components/VerdictButtons"
import { VideoComparison } from "./components/VideoComparison"
import { useAutoClose } from "./hooks/useAutoClose"
import { useOpponentSelection } from "./hooks/useOpponentSelection"
import { useOverlayState } from "./hooks/useOverlayState"
import {
  RETRY_MESSAGE,
  useVerdictSubmission
} from "./hooks/useVerdictSubmission"
import { useVideoObserver } from "./hooks/useVideoObserver"

const keepOverlayEnvValue = String(
  import.meta.env.WXT_PUBLIC_KEEP_OVERLAY_OPEN ?? ""
)
const forceKeepOverlayOpen = keepOverlayEnvValue.toLowerCase() === "true"

function isJsonLdFallbackStatus(statusMessage: string): boolean {
  return (
    statusMessage === OVERLAY_STATUS_MESSAGES.jsonLdLoading ||
    statusMessage === OVERLAY_STATUS_MESSAGES.jsonLdUnavailable
  )
}

function resolveStatusState({
  currentPageVideoId,
  currentVideoId,
  pinnedSameMessage,
  statusMessage,
  videoSnapshots
}: {
  currentPageVideoId: string | undefined
  currentVideoId: string
  pinnedSameMessage: string | undefined
  statusMessage: string | undefined
  videoSnapshots: Record<string, VideoSnapshot>
}): { canUseSnapshotFallback: boolean; displayStatus: string | undefined } {
  const canUseSnapshotFallback =
    statusMessage !== undefined &&
    isJsonLdFallbackStatus(statusMessage) &&
    currentPageVideoId !== undefined &&
    currentVideoId === currentPageVideoId &&
    Boolean(videoSnapshots[currentVideoId])
  return {
    canUseSnapshotFallback,
    displayStatus:
      pinnedSameMessage ?? (canUseSnapshotFallback ? undefined : statusMessage)
  }
}

export default function Overlay(): ReactElement | null {
  const [isHovered, setIsHovered] = useState(false)
  const {
    currentVideoId,
    isReady,
    overlaySettings,
    pinnedOpponentVideoId,
    recentWindow,
    refreshState,
    setCurrentVideoId,
    setPinnedOpponentVideoId,
    setStatusMessage,
    statusMessage,
    videoSnapshots,
    categories
  } = useOverlayState()
  const {
    hasSelectableCandidates,
    isPinned,
    opponentVideoId,
    selectableWindow,
    setOpponentVideoId
  } = useOpponentSelection({
    currentVideoId,
    pinnedOpponentVideoId,
    recentWindow
  })
  const { showControls, scheduleAutoClose } = useAutoClose({
    autoCloseMs: overlaySettings.overlayAutoCloseMs,
    enabled: overlaySettings.overlayAndCaptureEnabled,
    forceKeepOpen: forceKeepOverlayOpen,
    isHovered,
    isReady
  })
  const activeCategoryId = categories.items[overlaySettings.activeCategoryId]
    ? overlaySettings.activeCategoryId
    : categories.defaultId
  const { lastVerdict, submitVerdict } = useVerdictSubmission({
    activeCategoryId,
    currentVideoId,
    opponentVideoId,
    refreshState,
    onStatusMessage: setStatusMessage
  })

  const handleCategoryChange = useCallback(
    async (categoryId: string) => {
      const response = await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.updateActiveCategory,
            payload: { categoryId }
          }),
        {
          context: "ui:overlay:category-change",
          errorMessage: "カテゴリの更新に失敗しました。"
        }
      )
      if (!response) {
        setStatusMessage("カテゴリの更新に失敗しました。")
        return
      }
      await refreshState()
    },
    [refreshState, setStatusMessage]
  )

  const handleVideoChange = useCallback(
    async (videoData: { video: VideoSnapshot; author: AuthorProfile }) => {
      if (!isReady || !overlaySettings.overlayAndCaptureEnabled) {
        return
      }
      setStatusMessage(undefined)
      if (currentVideoId === videoData.video.videoId) return

      setCurrentVideoId(videoData.video.videoId)

      await sendNcMessage({
        type: MESSAGE_TYPES.registerSnapshot,
        payload: { video: videoData.video, author: videoData.author }
      })

      await sendNcMessage({
        type: MESSAGE_TYPES.updateCurrentVideo,
        payload: { videoId: videoData.video.videoId }
      })

      await refreshState()
    },
    [
      currentVideoId,
      isReady,
      refreshState,
      overlaySettings.overlayAndCaptureEnabled,
      setCurrentVideoId,
      setStatusMessage
    ]
  )

  const handleVideoChangeVoid = useCallback(
    (videoData: { video: VideoSnapshot; author: AuthorProfile }) => {
      void handleVideoChange(videoData)
    },
    [handleVideoChange]
  )

  useVideoObserver({
    enabled: overlaySettings.overlayAndCaptureEnabled,
    isReady,
    onStatusMessage: setStatusMessage,
    onVideoChange: handleVideoChangeVoid
  })

  const togglePinnedOpponent = useCallback(async () => {
    if (!opponentVideoId && !pinnedOpponentVideoId) {
      return
    }

    const nextPinned = pinnedOpponentVideoId ? undefined : opponentVideoId
    const response = await sendNcMessage({
      type: MESSAGE_TYPES.updatePinnedOpponent,
      payload: { videoId: nextPinned }
    })

    if (response.ok) {
      setPinnedOpponentVideoId(nextPinned ?? "")
      await refreshState()
    }
  }, [
    opponentVideoId,
    pinnedOpponentVideoId,
    refreshState,
    setPinnedOpponentVideoId
  ])

  // NOTE: dev mode (HMR) では一瞬表示されることがあるが、prod build では発生しない。
  if (!isReady || !overlaySettings.overlayAndCaptureEnabled) {
    return null
  }
  const pinnedSameMessage =
    isPinned && pinnedOpponentVideoId === currentVideoId
      ? "比較不可: 再生中と同じ動画が固定されています"
      : undefined
  const currentPageVideoId = getWatchVideoIdFromPathname(
    window.location.pathname
  )
  const { canUseSnapshotFallback, displayStatus } = resolveStatusState({
    currentPageVideoId,
    currentVideoId,
    pinnedSameMessage,
    statusMessage,
    videoSnapshots
  })
  const isBlockingStatus =
    pinnedSameMessage !== undefined ||
    (statusMessage !== undefined &&
      statusMessage !== RETRY_MESSAGE &&
      !isJsonLdFallbackStatus(statusMessage)) ||
    (statusMessage !== undefined &&
      isJsonLdFallbackStatus(statusMessage) &&
      !canUseSnapshotFallback)
  const canSubmit = currentVideoId && opponentVideoId && !isBlockingStatus
  return (
    <div
      className="fixed top-0 right-0 z-[2147483647] bg-black/75 text-white p-3 rounded-lg shadow-lg max-w-[320px] flex flex-col gap-2"
      onMouseEnter={() => {
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
      }}>
      <div className="flex items-center justify-between gap-2">
        {showControls && (
          <CategorySelector
            activeCategoryId={activeCategoryId}
            categories={categories}
            onChange={handleCategoryChange}
          />
        )}
        <strong className="text-right w-full">NiconiCompare</strong>
      </div>

      {displayStatus && (
        <span className="text-xs opacity-80 text-right w-full">
          {displayStatus}
        </span>
      )}

      {showControls && (
        <div className="flex flex-col gap-2">
          <VerdictButtons
            canSubmit={!!canSubmit}
            lastVerdict={lastVerdict}
            onSubmit={submitVerdict}
          />
          <VideoComparison
            currentVideoId={currentVideoId}
            opponentVideoId={opponentVideoId}
            opponentSelector={
              <OpponentSelector
                hasSelectableCandidates={hasSelectableCandidates}
                isPinned={isPinned}
                opponentVideoId={opponentVideoId}
                onBlur={() => {
                  if (forceKeepOverlayOpen) {
                    return
                  }
                  scheduleAutoClose()
                }}
                onChange={setOpponentVideoId}
                onTogglePinned={togglePinnedOpponent}
                selectableWindow={selectableWindow}
                videoSnapshots={videoSnapshots}
              />
            }
            videoSnapshots={videoSnapshots}
          />
        </div>
      )}
    </div>
  )
}
