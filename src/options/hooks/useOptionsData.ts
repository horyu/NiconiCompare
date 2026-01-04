import { useCallback, useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { handleUIError } from "../../lib/errorHandler"
import { sendNcMessage } from "../../lib/messages"
import type {
  NcAuthors,
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos
} from "../../lib/types"

export interface OptionsSnapshot {
  settings: NcSettings
  state: NcState
  videos: NcVideos
  authors: NcAuthors
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
  categories: NcCategories
}

interface UseOptionsDataResult {
  snapshot?: OptionsSnapshot
  loading: boolean
  error?: string
  bytesInUse: number | null
  refreshState: (silent?: boolean) => Promise<void>
}

export const useOptionsData = (): UseOptionsDataResult => {
  const [snapshot, setSnapshot] = useState<OptionsSnapshot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [bytesInUse, setBytesInUse] = useState<number | null>(null)

  const refreshState = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(undefined)
    }
    const response = await sendNcMessage({
      type: MESSAGE_TYPES.requestState
    })
    if (!response.ok) {
      setError(response.error ?? "状態取得に失敗しました。")
      setLoading(false)
      return
    }
    setSnapshot(response.data as OptionsSnapshot)

    try {
      const bytes = await chrome.storage.local.getBytesInUse()
      setBytesInUse(bytes)
    } catch (error) {
      handleUIError(error, "ui:options:bytes-in-use")
      setBytesInUse(null)
    }

    setLoading(false)
  }, [])

  // chrome.storageからの初期データ読み込み（外部システム同期）
  // NOTE: chrome.storage APIが非同期のため、useSyncExternalStoreの直接適用は困難
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    const handler = (): void => {
      void refreshState(true)
    }
    chrome.storage?.onChanged?.addListener(handler)
    const cleanup = (): void => {
      chrome.storage?.onChanged?.removeListener(handler)
    }
    return cleanup
  }, [refreshState])

  return { snapshot, loading, error, bytesInUse, refreshState }
}
