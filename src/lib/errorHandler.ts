import { logger } from "./logger"

export class NcError extends Error {
  context: string
  userMessage: string

  constructor(message: string, context: string, userMessage: string) {
    super(message)
    this.context = context
    this.userMessage = userMessage
  }
}

type ToastTone = "success" | "error"
type ShowToast = (tone: ToastTone, text: string) => void

export function handleBackgroundError(error: unknown, context: string): void {
  logger.error(`[${context}]`, error)
}

export function handleUIError(
  error: unknown,
  context: string,
  showToast?: ShowToast,
  userMessage?: string
): void {
  logger.error(`[${context}]`, error)

  if (!showToast) {
    return
  }

  if (userMessage) {
    showToast("error", userMessage)
    return
  }

  if (error instanceof NcError) {
    showToast("error", error.userMessage)
    return
  }

  showToast("error", "予期しないエラーが発生しました。")
}
