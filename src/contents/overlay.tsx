import styleText from "data-text:../style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useState } from "react"

import { MESSAGE_TYPES } from "../lib/constants"
import { handleUIError } from "../lib/error-handler"
import { sendNcMessage } from "../lib/messages"
import type { AuthorProfile, VideoSnapshot } from "../lib/types"
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

export default function Overlay() {
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
  const { lastVerdict, lastEventId, submitVerdict } = useVerdictSubmission({
    currentVideoId,
    opponentVideoId,
    refreshState,
    onStatusMessage: setStatusMessage
  })
  const activeCategoryId = categories.items[overlaySettings.activeCategoryId]
    ? overlaySettings.activeCategoryId
    : categories.defaultId

  const handleCategoryChange = useCallback(
    async (categoryId: string) => {
      try {
        const response = await sendNcMessage({
          type: MESSAGE_TYPES.updateActiveCategory,
          payload: { categoryId }
        })
        if (!response.ok) {
          setStatusMessage("カテゴリの更新に失敗しました。")
          return
        }
        if (lastEventId) {
          const moveResponse = await sendNcMessage({
            type: MESSAGE_TYPES.bulkMoveEvents,
            payload: {
              eventIds: [lastEventId],
              targetCategoryId: categoryId
            }
          })
          if (!moveResponse.ok) {
            setStatusMessage("カテゴリの移動に失敗しました。")
            return
          }
        }
        await refreshState()
      } catch (error) {
        handleUIError(error, "overlay:category-change")
        setStatusMessage("カテゴリの更新に失敗しました。")
      }
    },
    [lastEventId, refreshState, setStatusMessage]
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

  useVideoObserver({
    enabled: overlaySettings.overlayAndCaptureEnabled,
    isReady,
    onStatusMessage: setStatusMessage,
    onVideoChange: handleVideoChange
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
      setPinnedOpponentVideoId(nextPinned)
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
  const displayStatus = statusMessage ?? pinnedSameMessage
  const isBlockingStatus =
    displayStatus !== undefined && displayStatus !== RETRY_MESSAGE
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
