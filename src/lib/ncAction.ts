import { handleUIError, NcError } from "./errorHandler"
import { logger } from "./logger"

type ToastTone = "success" | "error"
type ShowToast = (tone: ToastTone, text: string) => void
type NcActionResponse = { ok: true } | { ok: false; error: string }

interface NcActionOptions<TResponse extends NcActionResponse> {
  context: string
  errorMessage: string
  successMessage?: string
  showToast?: ShowToast
  refreshState?: () => Promise<void>
  onSuccess?: (
    response: Extract<TResponse, { ok: true }>
  ) => Promise<void> | void
}

export async function runNcAction<TResponse extends NcActionResponse>(
  action: () => Promise<TResponse>,
  options: NcActionOptions<TResponse>
): Promise<Extract<TResponse, { ok: true }> | null> {
  try {
    logger.info(`[${options.context}] action start`)
    const response = await action()
    if (isFailureResponse(response)) {
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
    if (!isSuccessResponse(response)) {
      return null
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

function isFailureResponse<TResponse extends NcActionResponse>(
  response: TResponse
): response is Extract<TResponse, { ok: false }> {
  return !response.ok
}

function isSuccessResponse<TResponse extends NcActionResponse>(
  response: TResponse
): response is Extract<TResponse, { ok: true }> {
  return response.ok
}
