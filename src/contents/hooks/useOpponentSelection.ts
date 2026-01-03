import { useEffect, useRef, useState } from "react"

interface UseOpponentSelectionParams {
  currentVideoId: string
  pinnedOpponentVideoId: string
  recentWindow: string[]
}

export function useOpponentSelection({
  currentVideoId,
  pinnedOpponentVideoId,
  recentWindow
}: UseOpponentSelectionParams) {
  const [opponentVideoId, setOpponentVideoId] = useState<string | undefined>(
    undefined
  )
  const previousCurrentVideoIdRef = useRef<string | undefined>(undefined)
  const pendingPreviousVideoIdRef = useRef<string | null>(null)

  const selectableWindow = recentWindow.filter((id) => id !== currentVideoId)
  const hasSelectableCandidates = selectableWindow.length > 0
  const isPinned = !!pinnedOpponentVideoId

  // ピン状態が優先され、なければselectable候補から自動選択
  const derivedOpponent =
    pinnedOpponentVideoId || selectableWindow[0] || undefined

  useEffect(() => {
    const currentChanged = previousCurrentVideoIdRef.current !== currentVideoId
    if (currentChanged && previousCurrentVideoIdRef.current) {
      pendingPreviousVideoIdRef.current = previousCurrentVideoIdRef.current
    }
    previousCurrentVideoIdRef.current = currentVideoId

    // 複雑な優先度ロジック:
    // 1. ピン優先 → 2. 直前の動画 → 3. 手動選択維持 → 4. 派生状態
    // この同期は外部システム(recent window)との整合性維持のために必要
    if (pinnedOpponentVideoId) {
      if (opponentVideoId !== pinnedOpponentVideoId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpponentVideoId(pinnedOpponentVideoId)
      }
      return
    }

    // 直前の動画が selectableWindow に入っている場合は優先的に選択
    const pendingPrevious = pendingPreviousVideoIdRef.current
    const previousSelectable =
      pendingPrevious && selectableWindow.includes(pendingPrevious)
        ? pendingPrevious
        : undefined

    if (previousSelectable) {
      setOpponentVideoId(previousSelectable)
      pendingPreviousVideoIdRef.current = null
      return
    }

    // 手動選択を優先: opponentVideoIdが有効ならそのまま維持
    if (opponentVideoId && selectableWindow.includes(opponentVideoId)) {
      return
    }

    // それ以外は派生状態を適用
    setOpponentVideoId(derivedOpponent)
  }, [
    currentVideoId,
    opponentVideoId,
    pinnedOpponentVideoId,
    selectableWindow,
    derivedOpponent
  ])

  return {
    hasSelectableCandidates,
    isPinned,
    opponentVideoId,
    selectableWindow,
    setOpponentVideoId
  }
}
