import { useCallback, useEffect, useState } from "react"

import {
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  STORAGE_KEYS
} from "../../lib/constants"
import type { NcSettings, NcState, VideoSnapshot } from "../../lib/types"

type StateResponse = {
  settings: NcSettings
  state: NcState
}

export function useOverlayState() {
  const [currentVideoId, setCurrentVideoId] = useState<string>()
  const [recentWindow, setRecentWindow] = useState<string[]>([])
  const [pinnedOpponentVideoId, setPinnedOpponentVideoId] = useState<string>()
  const [overlaySettings, setOverlaySettings] =
    useState<NcSettings>(DEFAULT_SETTINGS)
  const [isReady, setIsReady] = useState(false)
  const [videoSnapshots, setVideoSnapshots] = useState<
    Record<string, VideoSnapshot>
  >({})
  const [statusMessage, setStatusMessage] = useState<string>()

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

  return {
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
    videoSnapshots
  }
}
