import { describe, expect, it, vi } from "vitest"

import { handleUIError } from "./error-handler"
import type { BackgroundResponse } from "./messages"
import { runNcAction } from "./nc-action"

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn()
  }
}))

vi.mock("./error-handler", async () => {
  const actual =
    await vi.importActual<typeof import("./error-handler")>("./error-handler")
  return {
    ...actual,
    handleUIError: vi.fn()
  }
})

describe("runNcAction", () => {
  it("成功時にフックとトーストが呼ばれること", async () => {
    const action = vi
      .fn<Promise<BackgroundResponse<{ ok: number }>>, []>()
      .mockResolvedValue({ ok: true, data: { ok: 1 } })
    const onSuccess = vi.fn()
    const refreshState = vi.fn()
    const showToast = vi.fn()

    const result = await runNcAction<BackgroundResponse<{ ok: number }>>(
      action,
      {
        context: "ui:test:success",
        errorMessage: "fail",
        successMessage: "ok",
        showToast,
        refreshState,
        onSuccess
      }
    )

    expect(result?.ok).toBe(true)
    expect(onSuccess).toHaveBeenCalled()
    expect(refreshState).toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith("success", "ok")
  })

  it("失敗レスポンス時はエラーハンドリングされること", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "nope" })

    const result = await runNcAction(action, {
      context: "ui:test:fail",
      errorMessage: "fail"
    })

    expect(result).toBeNull()
    expect(handleUIError).toHaveBeenCalled()
  })

  it("例外発生時はエラーハンドリングされること", async () => {
    const action = vi.fn().mockRejectedValue(new Error("boom"))

    const result = await runNcAction(action, {
      context: "ui:test:throw",
      errorMessage: "fail"
    })

    expect(result).toBeNull()
    expect(handleUIError).toHaveBeenCalled()
  })
})
