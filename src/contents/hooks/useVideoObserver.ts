import { useEffect } from "react"

import {
  extractVideoDataFromLdJson,
  observeLdJsonChanges
} from "../../lib/dom-observer"
import type { AuthorProfile, VideoSnapshot } from "../../lib/types"

type VideoData = { video: VideoSnapshot; author: AuthorProfile }

type UseVideoObserverParams = {
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
    const cleanup = observeLdJsonChanges({
      onVideoDataChange: onVideoChange,
      onError: onStatusMessage
    })

    const videoData = extractVideoDataFromLdJson()
    if (videoData) {
      onVideoChange(videoData)
    } else {
      onStatusMessage?.("動画情報を取得中...")
    }

    return cleanup
  }, [enabled, isReady, onStatusMessage, onVideoChange])
}
