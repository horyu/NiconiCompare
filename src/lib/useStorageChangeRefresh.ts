import { useEffect, useRef } from "react"

export function hasWatchedStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
  keys: readonly string[]
): boolean {
  if (areaName !== "local") return false
  return keys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))
}

interface UseStorageChangeRefreshOptions {
  keys: readonly string[]
  refresh: () => Promise<void>
}

export function useStorageChangeRefresh({
  keys,
  refresh
}: UseStorageChangeRefreshOptions): void {
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect((): (() => void) | undefined => {
    if (!chrome.storage?.onChanged) return undefined

    let disposed = false
    let isRunning = false
    let shouldRunAgain = false

    const runRefresh = (): void => {
      if (isRunning) {
        shouldRunAgain = true
        return
      }

      isRunning = true
      void refreshRef
        .current()
        .catch(() => undefined)
        .finally(() => {
          isRunning = false
          if (disposed) return
          if (!shouldRunAgain) return

          shouldRunAgain = false
          runRefresh()
        })
    }

    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ): void => {
      if (hasWatchedStorageChange(changes, areaName, keys)) {
        runRefresh()
      }
    }

    chrome.storage.onChanged.addListener(handler)
    const cleanup = (): void => {
      disposed = true
      chrome.storage.onChanged.removeListener(handler)
    }
    return cleanup
  }, [keys])
}
