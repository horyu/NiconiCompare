export const readSessionState = <T>(key: string, fallback: T): T => {
  try {
    if (typeof sessionStorage === "undefined") {
      return fallback
    }
    const raw = sessionStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeSessionState = (key: string, value: unknown): void => {
  try {
    if (typeof sessionStorage === "undefined") {
      return
    }
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // noop
  }
}
