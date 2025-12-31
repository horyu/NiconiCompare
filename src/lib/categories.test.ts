import { describe, expect, it } from "vitest"

import { normalizeCategories } from "./categories"
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_ID } from "./constants"
import type { NcCategories } from "./types"

describe("normalizeCategories", () => {
  it("未指定の場合はデフォルトカテゴリを返すこと", () => {
    expect(normalizeCategories(undefined)).toEqual(DEFAULT_CATEGORIES)
  })

  it("デフォルトカテゴリが欠けている場合に補完し、順序と表示対象を整えること", () => {
    const categories: NcCategories = {
      items: {
        cat1: {
          id: "cat1",
          name: "音楽",
          createdAt: 123
        }
      },
      order: ["missing", "cat1"],
      overlayVisibleIds: ["missing"],
      defaultId: ""
    }

    const normalized = normalizeCategories(categories)

    expect(normalized.items[DEFAULT_CATEGORY_ID]).toBeDefined()
    expect(normalized.order).toEqual([DEFAULT_CATEGORY_ID, "cat1"])
    expect(normalized.overlayVisibleIds).toEqual([DEFAULT_CATEGORY_ID])
    expect(normalized.defaultId).toBe(DEFAULT_CATEGORY_ID)
  })

  it("既存のカテゴリのみを残しつつ、表示対象が空にならないこと", () => {
    const categories: NcCategories = {
      items: {
        cat1: {
          id: "cat1",
          name: "作画",
          createdAt: 456
        },
        [DEFAULT_CATEGORY_ID]: {
          ...DEFAULT_CATEGORIES.items[DEFAULT_CATEGORY_ID]
        }
      },
      order: ["cat1", "missing"],
      overlayVisibleIds: ["cat1", "missing"],
      defaultId: DEFAULT_CATEGORY_ID
    }

    const normalized = normalizeCategories(categories)

    expect(normalized.order).toEqual([DEFAULT_CATEGORY_ID, "cat1"])
    expect(normalized.overlayVisibleIds).toEqual(["cat1"])
  })

  it("順序と表示対象が空の場合はデフォルトを補うこと", () => {
    const categories: NcCategories = {
      items: {
        [DEFAULT_CATEGORY_ID]: {
          ...DEFAULT_CATEGORIES.items[DEFAULT_CATEGORY_ID]
        }
      },
      order: [],
      overlayVisibleIds: [],
      defaultId: DEFAULT_CATEGORY_ID
    }

    const normalized = normalizeCategories(categories)

    expect(normalized.order).toEqual([DEFAULT_CATEGORY_ID])
    expect(normalized.overlayVisibleIds).toEqual([DEFAULT_CATEGORY_ID])
  })
})
