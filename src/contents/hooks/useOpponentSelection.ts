import { useEffect, useRef, useState } from "react"

type UseOpponentSelectionParams = {
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

  useEffect(() => {
    const currentChanged = previousCurrentVideoIdRef.current !== currentVideoId
    if (currentChanged && previousCurrentVideoIdRef.current) {
      pendingPreviousVideoIdRef.current = previousCurrentVideoIdRef.current
    }

    if (pinnedOpponentVideoId) {
      if (opponentVideoId !== pinnedOpponentVideoId) {
        setOpponentVideoId(pinnedOpponentVideoId)
      }
      previousCurrentVideoIdRef.current = currentVideoId
      return
    }

    if (selectableWindow.length === 0) {
      setOpponentVideoId(undefined)
      previousCurrentVideoIdRef.current = currentVideoId
      return
    }

    // 直前の動画が selectableWindow に入っている場合は優先的に選択
    const pendingPrevious = pendingPreviousVideoIdRef.current
    const previousSelectable =
      pendingPrevious && selectableWindow.includes(pendingPrevious)
        ? pendingPrevious
        : undefined

    const shouldSelectPrevious =
      previousSelectable && opponentVideoId !== previousSelectable
    if (
      currentChanged ||
      !opponentVideoId ||
      !selectableWindow.includes(opponentVideoId) ||
      shouldSelectPrevious
    ) {
      const nextOpponent = previousSelectable ?? selectableWindow[0]
      setOpponentVideoId(nextOpponent)
      // 直前の動画が選択された場合のみクリア
      if (previousSelectable) {
        pendingPreviousVideoIdRef.current = null
      }
    }

    previousCurrentVideoIdRef.current = currentVideoId
  }, [currentVideoId, opponentVideoId, pinnedOpponentVideoId, selectableWindow])

  return {
    hasSelectableCandidates,
    isPinned,
    opponentVideoId,
    selectableWindow,
    setOpponentVideoId
  }
}
