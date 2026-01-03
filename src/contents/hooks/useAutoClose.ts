import { useCallback, useEffect, useRef, useState } from "react"

interface UseAutoCloseParams {
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
  const [timedOut, setTimedOut] = useState(false)
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
        setTimedOut(true)
      }
      autoCloseTimerRef.current = undefined
    }, timeout)
  }, [autoCloseMs, clearAutoCloseTimer, isHovered])

  const showControls =
    forceKeepOpen || (isReady && enabled && (isHovered || !timedOut))

  // props 由来の条件変化に合わせてリセットするため useEffect で同期する
  useEffect(() => {
    if (forceKeepOpen || !enabled || !isReady || isHovered) {
      clearAutoCloseTimer()
      // 表示条件が変わった時はタイムアウト状態を必ず解除
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimedOut(false)
    }
  }, [clearAutoCloseTimer, enabled, forceKeepOpen, isHovered, isReady])

  useEffect(() => {
    // タイマーをクリアする条件: forceKeepOpen, 準備未完了, ホバー中
    if (forceKeepOpen || !isReady || !enabled || isHovered) {
      clearAutoCloseTimer()
      return
    }

    // タイムアウト済みなら何もしない
    if (timedOut) {
      return
    }

    // それ以外はタイマーを開始
    scheduleAutoClose()
  }, [
    enabled,
    forceKeepOpen,
    isHovered,
    isReady,
    timedOut,
    clearAutoCloseTimer,
    scheduleAutoClose
  ])

  return {
    clearAutoCloseTimer,
    scheduleAutoClose,
    showControls
  }
}
