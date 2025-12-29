import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_ID } from "./constants"
import type { NcCategories } from "./types"

export function normalizeCategories(categories?: NcCategories): NcCategories {
  if (!categories) {
    return DEFAULT_CATEGORIES
  }

  const items = { ...categories.items }
  if (!items[DEFAULT_CATEGORY_ID]) {
    items[DEFAULT_CATEGORY_ID] = {
      ...DEFAULT_CATEGORIES.items[DEFAULT_CATEGORY_ID]
    }
  }

  const order = categories.order.filter((id) => items[id])
  if (!order.includes(DEFAULT_CATEGORY_ID)) {
    order.unshift(DEFAULT_CATEGORY_ID)
  }

  const overlayVisibleIds = categories.overlayVisibleIds.filter(
    (id) => items[id]
  )
  if (overlayVisibleIds.length === 0) {
    overlayVisibleIds.push(DEFAULT_CATEGORY_ID)
  }

  return {
    items,
    order,
    overlayVisibleIds,
    defaultId: categories.defaultId || DEFAULT_CATEGORY_ID
  }
}
