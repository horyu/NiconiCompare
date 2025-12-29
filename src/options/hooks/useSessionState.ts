import { useCallback, useRef } from "react"

import { readSessionState, writeSessionState } from "../utils/sessionStorage"

export const useSessionState = <T>(key: string, fallback: T) => {
  const initialStateRef = useRef<T>()
  if (typeof initialStateRef.current === "undefined") {
    initialStateRef.current = readSessionState(key, fallback)
  }

  const persistState = useCallback(
    (state: T) => {
      writeSessionState(key, state)
    },
    [key]
  )

  return { initialState: initialStateRef.current, persistState }
}
