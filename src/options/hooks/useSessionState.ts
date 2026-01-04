import { useCallback, useState } from "react"

import { readSessionState, writeSessionState } from "../utils/sessionStorage"

export const useSessionState = <T>(
  key: string,
  fallback: T
): { initialState: T; persistState: (state: T) => void } => {
  const [initialState] = useState<T>(() => readSessionState(key, fallback))

  const persistState = useCallback(
    (state: T): void => {
      writeSessionState(key, state)
    },
    [key]
  )

  return { initialState, persistState }
}
