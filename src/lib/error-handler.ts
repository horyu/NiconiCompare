export class NcError extends Error {
  code: string
  userMessage: string

  constructor(message: string, code: string, userMessage: string) {
    super(message)
    this.code = code
    this.userMessage = userMessage
  }
}

type ToastTone = "success" | "error"
type ShowToast = (tone: ToastTone, text: string) => void

export function handleBackgroundError(error: unknown, context: string) {
  console.error(`[${context}]`, error)
}

export function handleUIError(
  error: unknown,
  context: string,
  showToast?: ShowToast,
  userMessage?: string
) {
  console.error(`[${context}]`, error)

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
