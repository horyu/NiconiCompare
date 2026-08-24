import { describe, expect, it } from "vitest"

import {
  formatCompactTimestamp,
  formatDateInput,
  formatPaddedDateTime,
  parseDateStart
} from "./date"

describe("formatCompactTimestamp", () => {
  it("ゼロ埋めされた YYYYMMDDHHmmss 形式を返すこと", () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    expect(formatCompactTimestamp(date)).toBe("20260102030405")
  })
})

describe("formatPaddedDateTime", () => {
  it("ゼロ埋めされた YYYY/MM/DD HH:mm:ss 形式を返すこと", () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    expect(formatPaddedDateTime(date)).toBe("2026/01/02 03:04:05")
  })
})

describe("formatDateInput", () => {
  it("date input 用の YYYY-MM-DD 形式を返すこと", () => {
    expect(formatDateInput(new Date(2026, 0, 2, 3, 4, 5))).toBe("2026-01-02")
  })
})

describe("parseDateStart", () => {
  it("指定日の開始時刻を返すこと", () => {
    expect(parseDateStart("2026-01-02")).toBe(
      new Date(2026, 0, 2, 0, 0, 0).getTime()
    )
  })

  it("空文字列と不正な日付を undefined として扱うこと", () => {
    expect(parseDateStart("")).toBeUndefined()
    expect(parseDateStart("invalid")).toBeUndefined()
  })
})
