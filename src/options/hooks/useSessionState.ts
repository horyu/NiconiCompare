import { useCallback, useState } from "react"

import { readSessionState, writeSessionState } from "../utils/sessionStorage"

export const useSessionState = <T>(key: string, fallback: T) => {
  const [initialState] = useState<T>(() => readSessionState(key, fallback))

  const persistState = useCallback(
    (state: T) => {
      writeSessionState(key, state)
    },
    [key]
  )

  return { initialState, persistState }
}
