import { describe, expect, it } from "vitest"

import {
  DEFAULT_SETTINGS,
  MAX_OVERLAY_AUTO_CLOSE_MS,
  MAX_POPUP_RECENT_COUNT
} from "../../lib/constants"
import type { NcSettings } from "../../lib/types"
import { normalizeSettings } from "./normalize"

describe("normalizeSettings", () => {
  it("サイズ系は最小1、最大値でクランプされること", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      recentWindowSize: 0, // 最小値未満なのでデフォルト値（5）にフォールバック
      popupRecentCount: MAX_POPUP_RECENT_COUNT + 10 // 最大値を超えるのでクランプ
    }

    const normalized = normalizeSettings(settings)

    expect(normalized.recentWindowSize).toBe(5)
    expect(normalized.popupRecentCount).toBe(MAX_POPUP_RECENT_COUNT)
  })

  it("overlayAutoCloseMs は 0 以上 MAX_OVERLAY_AUTO_CLOSE_MS 以下に正規化されること", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      overlayAutoCloseMs: -10
    }
    expect(normalizeSettings(settings).overlayAutoCloseMs).toBe(0)

    const high = {
      ...DEFAULT_SETTINGS,
      overlayAutoCloseMs: MAX_OVERLAY_AUTO_CLOSE_MS + 10_000
    }
    expect(normalizeSettings(high).overlayAutoCloseMs).toBe(
      MAX_OVERLAY_AUTO_CLOSE_MS
    )
  })

  it("未指定の設定はデフォルトにフォールバックすること", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      overlayAndCaptureEnabled: undefined as unknown as boolean,
      showClosedOverlayVerdict: undefined as unknown as boolean,
      showPopupVideoVerdictCounts: undefined as unknown as boolean,
      showEventThumbnails: undefined as unknown as boolean,
      activeCategoryId: undefined as unknown as string,
      glicko: null as unknown as NcSettings["glicko"]
    }

    const normalized = normalizeSettings(settings)

    expect(normalized.overlayAndCaptureEnabled).toBe(
      DEFAULT_SETTINGS.overlayAndCaptureEnabled
    )
    expect(normalized.showClosedOverlayVerdict).toBe(
      DEFAULT_SETTINGS.showClosedOverlayVerdict
    )
    expect(normalized.showPopupVideoVerdictCounts).toBe(
      DEFAULT_SETTINGS.showPopupVideoVerdictCounts
    )
    expect(normalized.showEventThumbnails).toBe(
      DEFAULT_SETTINGS.showEventThumbnails
    )
    expect(normalized.activeCategoryId).toBe(DEFAULT_SETTINGS.activeCategoryId)
    expect(normalized.glicko).toEqual(DEFAULT_SETTINGS.glicko)
  })

  it("recentWindowSize の小数は切り捨てられること", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      recentWindowSize: 3.7
    }

    const normalized = normalizeSettings(settings)

    expect(normalized.recentWindowSize).toBe(3)
  })
})
