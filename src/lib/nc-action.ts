import { handleUIError, NcError } from "./error-handler"
import type { BackgroundResponse } from "./messages"

type ToastTone = "success" | "error"
type ShowToast = (tone: ToastTone, text: string) => void

type NcActionOptions<TResponse extends BackgroundResponse> = {
  context: string
  errorMessage: string
  successMessage?: string
  showToast?: ShowToast
  refreshState?: () => Promise<void>
  onSuccess?: (response: TResponse) => Promise<void> | void
}

export async function runNcAction<TResponse extends BackgroundResponse>(
  action: () => Promise<TResponse>,
  options: NcActionOptions<TResponse>
): Promise<Extract<TResponse, { ok: true }> | null> {
  try {
    const response = await action()
    if (!response.ok) {
      throw new NcError(
        response.error ?? "request failed",
        options.context,
        options.errorMessage
      )
    }
    if (options.onSuccess) {
      await options.onSuccess(response)
    }
    if (options.refreshState) {
      await options.refreshState()
    }
    if (options.successMessage && options.showToast) {
      options.showToast("success", options.successMessage)
    }
    return response as Extract<TResponse, { ok: true }>
  } catch (error) {
    handleUIError(error, options.context, options.showToast)
    return null
  }
}
