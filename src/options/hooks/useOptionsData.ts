import { useCallback, useEffect, useState } from "react"

import { MESSAGE_TYPES, STORAGE_KEYS } from "../../lib/constants"
import { handleUIError } from "../../lib/errorHandler"
import {
  sendNcMessage,
  type MessageResponse,
  type RequestStateMessage,
  type StateSnapshot
} from "../../lib/messages"
import { useStorageChangeRefresh } from "../../lib/useStorageChangeRefresh"

export type OptionsSnapshot = StateSnapshot

const OPTIONS_STORAGE_KEYS = Object.values(STORAGE_KEYS)

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
    let response: MessageResponse<RequestStateMessage>
    try {
      response = await sendNcMessage({
        type: MESSAGE_TYPES.requestState
      })
    } catch (requestError) {
      handleUIError(requestError, "ui:options:request-state")
      setError(
        requestError instanceof Error
          ? requestError.message
          : "状態取得に失敗しました。"
      )
      setLoading(false)
      return
    }

    if (!response.ok) {
      setError(response.error ?? "状態取得に失敗しました。")
      setLoading(false)
      return
    }
    setSnapshot(response.data)

    try {
      const bytes = await chrome.storage.local.getBytesInUse()
      setBytesInUse(bytes)
    } catch (storageError) {
      handleUIError(storageError, "ui:options:bytes-in-use")
      setBytesInUse(null)
    }

    setLoading(false)
  }, [])

  // chrome.storageからの初期データ読み込み（外部システム同期）
  // NOTE: chrome.storage APIが非同期のため、useSyncExternalStoreの直接適用は困難
  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useStorageChangeRefresh({
    keys: OPTIONS_STORAGE_KEYS,
    refresh: () => refreshState(true)
  })

  return { snapshot, loading, error, bytesInUse, refreshState }
}
