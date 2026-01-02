import { useCallback, useEffect, useState } from "react"

import { normalizeCategories } from "../../lib/categories"
import {
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  STORAGE_KEYS
} from "../../lib/constants"
import { sendNcMessage } from "../../lib/messages"
import type {
  NcCategories,
  NcSettings,
  NcState,
  VideoSnapshot
} from "../../lib/types"

type StateResponse = {
  settings: NcSettings
  state: NcState
  categories: NcCategories
}

export function useOverlayState() {
  const [currentVideoId, setCurrentVideoId] = useState<string>("")
  const [recentWindow, setRecentWindow] = useState<string[]>([])
  const [pinnedOpponentVideoId, setPinnedOpponentVideoId] = useState<string>("")
  const [overlaySettings, setOverlaySettings] =
    useState<NcSettings>(DEFAULT_SETTINGS)
  const [isReady, setIsReady] = useState(false)
  const [videoSnapshots, setVideoSnapshots] = useState<
    Record<string, VideoSnapshot>
  >({})
  const [statusMessage, setStatusMessage] = useState<string | undefined>(
    undefined
  )
  const [categories, setCategories] = useState<NcCategories>(
    normalizeCategories()
  )

  useEffect(() => {
    if (!chrome.storage?.onChanged) return

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return

      if (changes[STORAGE_KEYS.settings]?.newValue) {
        const nextSettings = changes[STORAGE_KEYS.settings].newValue as
          | NcSettings
          | undefined
        setOverlaySettings(nextSettings ?? DEFAULT_SETTINGS)
      }

      if (changes[STORAGE_KEYS.videos]?.newValue) {
        const nextVideos = changes[STORAGE_KEYS.videos].newValue as
          | Record<string, VideoSnapshot>
          | undefined
        setVideoSnapshots(nextVideos ?? {})
      }

      if (changes[STORAGE_KEYS.categories]?.newValue) {
        const nextCategories = changes[STORAGE_KEYS.categories].newValue as
          | NcCategories
          | undefined
        setCategories(normalizeCategories(nextCategories))
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const loadVideoSnapshots = useCallback(async () => {
    if (!chrome.storage?.local) return
    const result = await chrome.storage.local.get(STORAGE_KEYS.videos)
    const nextVideos = result?.[STORAGE_KEYS.videos] as
      | Record<string, VideoSnapshot>
      | undefined
    setVideoSnapshots(nextVideos ?? {})
  }, [])

  const refreshState = useCallback(async () => {
    const response = await sendNcMessage({
      type: MESSAGE_TYPES.requestState
    })

    if (!response.ok) {
      return
    }

    const data = response.data as StateResponse
    setOverlaySettings(data.settings)
    setRecentWindow(data.state.recentWindow)
    setCurrentVideoId(data.state.currentVideoId)
    setPinnedOpponentVideoId(data.state.pinnedOpponentVideoId)
    setCategories(normalizeCategories(data.categories))
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
    videoSnapshots,
    categories
  }
}
