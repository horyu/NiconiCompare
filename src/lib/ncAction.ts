import { handleUIError, NcError } from "./errorHandler"
import { logger } from "./logger"
import type { BackgroundResponse } from "./messages"

type ToastTone = "success" | "error"
type ShowToast = (tone: ToastTone, text: string) => void

interface NcActionOptions<TResponse extends BackgroundResponse> {
  context: string
  errorMessage: string
  successMessage?: string
  showToast?: ShowToast
  refreshState?: () => Promise<void>
  onSuccess?: (response: TResponse) => Promise<void> | void
}

export async function runNcAction<T>(
  action: () => Promise<BackgroundResponse<T>>,
  options: NcActionOptions<BackgroundResponse<T>>
): Promise<Extract<BackgroundResponse<T>, { ok: true }> | null> {
  try {
    logger.info(`[${options.context}] action start`)
    const response = await action()
    if (!response.ok) {
      const userMessage =
        typeof response.error === "string" && response.error.trim().length > 0
          ? response.error
          : options.errorMessage
      throw new NcError(
        response.error ?? "request failed",
        options.context,
        userMessage
      )
    }
    logger.info(`[${options.context}] action success`)
    if (options.onSuccess) {
      await options.onSuccess(response)
    }
    if (options.refreshState) {
      await options.refreshState()
    }
    if (options.successMessage && options.showToast) {
      options.showToast("success", options.successMessage)
    }
    return response
  } catch (error) {
    handleUIError(error, options.context, options.showToast)
    return null
  }
}
