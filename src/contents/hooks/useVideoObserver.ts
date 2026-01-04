import { useEffect } from "react"

import {
  extractVideoDataFromLdJson,
  observeLdJsonChanges
} from "../../lib/domObserver"
import { logger } from "../../lib/logger"
import type { AuthorProfile, VideoSnapshot } from "../../lib/types"

interface VideoData {
  video: VideoSnapshot
  author: AuthorProfile
}

interface UseVideoObserverParams {
  enabled: boolean
  isReady: boolean
  onStatusMessage?: (message?: string) => void
  onVideoChange: (videoData: VideoData) => void
}

export function useVideoObserver({
  enabled,
  isReady,
  onStatusMessage,
  onVideoChange
}: UseVideoObserverParams) {
  useEffect(() => {
    if (!isReady || !enabled) {
      return
    }
    logger.debug("[ui:overlay:video-observer] start", {
      isReady,
      enabled
    })
    const cleanup = observeLdJsonChanges({
      onVideoDataChange: onVideoChange,
      onError: (message) => onStatusMessage?.(message)
    })

    const videoData = extractVideoDataFromLdJson()
    if (videoData) {
      logger.debug("[ui:overlay:video-observer] initial video detected")
      onVideoChange(videoData)
    } else {
      logger.debug("[ui:overlay:video-observer] initial video missing")
      onStatusMessage?.("動画情報を取得中...")
    }

    return cleanup
  }, [enabled, isReady, onStatusMessage, onVideoChange])
}
