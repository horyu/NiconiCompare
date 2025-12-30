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
  const [opponentVideoId, setOpponentVideoId] = useState<string>()
  const previousCurrentVideoIdRef = useRef<string>()

  const selectableWindow = recentWindow.filter((id) => id !== currentVideoId)
  const hasSelectableCandidates = selectableWindow.length > 0
  const isPinned = !!pinnedOpponentVideoId

  useEffect(() => {
    const currentChanged = previousCurrentVideoIdRef.current !== currentVideoId

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

    const previousSelectable =
      currentChanged &&
      previousCurrentVideoIdRef.current &&
      selectableWindow.includes(previousCurrentVideoIdRef.current)
        ? previousCurrentVideoIdRef.current
        : undefined

    if (
      currentChanged ||
      !opponentVideoId ||
      !selectableWindow.includes(opponentVideoId)
    ) {
      setOpponentVideoId(previousSelectable ?? selectableWindow[0])
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
