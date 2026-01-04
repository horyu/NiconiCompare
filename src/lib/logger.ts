type LogLevel = "error" | "warn" | "info" | "debug"

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

const resolveLogLevel = (): LogLevel => {
  const raw = (import.meta.env.WXT_PUBLIC_NC_LOG_LEVEL ?? "")
    .toLowerCase()
    .trim()
  if (raw === "error" || raw === "warn" || raw === "info" || raw === "debug") {
    return raw
  }
  return "warn"
}

const currentLevel = resolveLogLevel()

const shouldLog = (level: LogLevel): boolean =>
  LOG_LEVELS[level] <= LOG_LEVELS[currentLevel]

export const logger = {
  error: (...args: unknown[]) => {
    if (shouldLog("error")) {
      console.error(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) {
      console.warn(...args)
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) {
      console.info(...args)
    }
  },
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) {
      console.debug(...args)
    }
  }
}
