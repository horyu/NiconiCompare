import { describe, expect, it } from "vitest"

import {
  normalizeEventSessionState,
  normalizeVideoSessionState
} from "./sessionState"

describe("normalizeEventSessionState", () => {
  it("有効な値を維持し、不正なフィールドだけ既定値に戻すこと", () => {
    expect(
      normalizeEventSessionState({
        search: "test",
        verdict: "better",
        includeDeleted: "true",
        categoryId: "category-a",
        showCategoryOps: true,
        page: 0
      })
    ).toEqual({
      search: "test",
      verdict: "better",
      includeDeleted: false,
      categoryId: "category-a",
      showCategoryOps: true,
      page: 1
    })
  })

  it("object 以外と未対応の判定値を既定値に戻すこと", () => {
    expect(normalizeEventSessionState(null)).toEqual({
      search: "",
      verdict: "all",
      includeDeleted: false,
      categoryId: "",
      showCategoryOps: false,
      page: 1
    })
    expect(normalizeEventSessionState({ verdict: "unknown" }).verdict).toBe(
      "all"
    )
  })
})

describe("normalizeVideoSessionState", () => {
  it("許可されたソート値と正の整数ページだけを復元すること", () => {
    expect(
      normalizeVideoSessionState({
        search: "test",
        author: "Alice",
        categoryId: "category-a",
        sort: "wins",
        order: "asc",
        page: 3
      })
    ).toEqual({
      search: "test",
      author: "Alice",
      categoryId: "category-a",
      sort: "wins",
      order: "asc",
      page: 3
    })
  })

  it("不正な選択値とページを既定値に戻すこと", () => {
    expect(
      normalizeVideoSessionState({
        sort: "unknown",
        order: "up",
        page: "3"
      })
    ).toEqual({
      search: "",
      author: "all",
      categoryId: "",
      sort: "rating",
      order: "desc",
      page: 1
    })
  })
})
