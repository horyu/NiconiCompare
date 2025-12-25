import { useCallback, useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { handleUIError } from "../../lib/error-handler"
import type {
  NcAuthors,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos
} from "../../lib/types"

export type OptionsSnapshot = {
  settings: NcSettings
  state: NcState
  videos: NcVideos
  authors: NcAuthors
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
}

type UseOptionsDataResult = {
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
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.requestState
    })
    if (!response?.ok) {
      setError(response?.error ?? "状態取得に失敗しました。")
      setLoading(false)
      return
    }
    setSnapshot(response.data as OptionsSnapshot)

    try {
      const bytes = await chrome.storage.local.getBytesInUse()
      setBytesInUse(bytes)
    } catch (error) {
      handleUIError(error, "options:bytes-in-use")
      setBytesInUse(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  useEffect(() => {
    const handler = () => {
      refreshState(true)
    }
    chrome.storage?.onChanged?.addListener(handler)
    return () => {
      chrome.storage?.onChanged?.removeListener(handler)
    }
  }, [refreshState])

  return { snapshot, loading, error, bytesInUse, refreshState }
}
