import { useCallback, useEffect, useRef, useState } from "react"

type UseAutoCloseParams = {
  autoCloseMs: number
  enabled: boolean
  forceKeepOpen: boolean
  isHovered: boolean
  isReady: boolean
}

export function useAutoClose({
  autoCloseMs,
  enabled,
  forceKeepOpen,
  isHovered,
  isReady
}: UseAutoCloseParams) {
  const [showControls, setShowControls] = useState(true)
  const autoCloseTimerRef = useRef<number | undefined>(undefined)

  const clearAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = undefined
    }
  }, [])

  const scheduleAutoClose = useCallback(() => {
    clearAutoCloseTimer()
    const timeout = autoCloseMs ?? 2000
    autoCloseTimerRef.current = window.setTimeout(() => {
      if (!isHovered) {
        setShowControls(false)
      }
      autoCloseTimerRef.current = undefined
    }, timeout)
  }, [autoCloseMs, clearAutoCloseTimer, isHovered])

  useEffect(() => {
    if (forceKeepOpen) {
      setShowControls(true)
      clearAutoCloseTimer()
      return
    }

    if (!isReady || !enabled) {
      setShowControls(false)
      clearAutoCloseTimer()
      return
    }

    if (isHovered) {
      clearAutoCloseTimer()
      setShowControls(true)
      return
    }

    if (!showControls) {
      return
    }

    scheduleAutoClose()
  }, [
    enabled,
    forceKeepOpen,
    isHovered,
    isReady,
    showControls,
    clearAutoCloseTimer,
    scheduleAutoClose
  ])

  return {
    clearAutoCloseTimer,
    scheduleAutoClose,
    showControls
  }
}
