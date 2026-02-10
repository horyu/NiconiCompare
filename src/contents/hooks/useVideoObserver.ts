import { useEffect } from "react"

import { OVERLAY_STATUS_MESSAGES } from "../../lib/constants"
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
}: UseVideoObserverParams): void {
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
      onStatusMessage?.(OVERLAY_STATUS_MESSAGES.jsonLdLoading)
    }

    return cleanup
  }, [enabled, isReady, onStatusMessage, onVideoChange])
}
