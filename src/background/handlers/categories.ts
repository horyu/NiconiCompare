import { produce } from "immer"

import { DEFAULT_CATEGORY_ID } from "../../lib/constants"
import { handleBackgroundError } from "../../lib/error-handler"
import { getStorageData, setStorageData } from "../services/storage"
import { normalizeCategories } from "../utils/categories"
import { rebuildRatingsFromEvents } from "../utils/rating-helpers"

export async function handleCreateCategory(name: string) {
  const { categories } = await getStorageData(["categories"])
  const nextCategories = normalizeCategories(categories)
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  const updated = produce(nextCategories, (draft) => {
    draft.items[id] = { id, name, createdAt }
    draft.order.push(id)
  })

  await setStorageData({ categories: updated })
  return id
}

export async function handleUpdateCategoryName(
  categoryId: string,
  name: string
) {
  const { categories } = await getStorageData(["categories"])
  const nextCategories = normalizeCategories(categories)

  if (!nextCategories.items[categoryId]) {
    throw new Error("Category not found")
  }

  const updated = produce(nextCategories, (draft) => {
    draft.items[categoryId].name = name
  })

  await setStorageData({ categories: updated })
}

export async function handleDeleteCategory(
  categoryId: string,
  moveToCategoryId?: string
) {
  if (categoryId === DEFAULT_CATEGORY_ID) {
    throw new Error("Default category cannot be deleted")
  }

  const { categories, events, settings } = await getStorageData([
    "categories",
    "events",
    "settings"
  ])
  const nextCategories = normalizeCategories(categories)

  if (!nextCategories.items[categoryId]) {
    throw new Error("Category not found")
  }
  if (moveToCategoryId && !nextCategories.items[moveToCategoryId]) {
    throw new Error("Target category not found")
  }

  const updatedEvents = produce(events, (draft) => {
    if (moveToCategoryId) {
      draft.items = draft.items.map((event) =>
        event.categoryId === categoryId
          ? { ...event, categoryId: moveToCategoryId }
          : event
      )
    } else {
      draft.items = draft.items.filter(
        (event) => event.categoryId !== categoryId
      )
    }
  })

  const updatedCategories = produce(nextCategories, (draft) => {
    delete draft.items[categoryId]
    draft.order = draft.order.filter((id) => id !== categoryId)
    draft.overlayVisibleIds = draft.overlayVisibleIds.filter(
      (id) => id !== categoryId
    )
    if (draft.overlayVisibleIds.length === 0) {
      draft.overlayVisibleIds = [draft.defaultId]
    }
  })

  const nextActiveCategoryId =
    settings.activeCategoryId === categoryId
      ? moveToCategoryId ?? updatedCategories.defaultId
      : settings.activeCategoryId

  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    categories: updatedCategories,
    events: updatedEvents,
    ratings: nextRatings,
    settings: {
      ...settings,
      activeCategoryId: nextActiveCategoryId
    }
  })
}

export async function handleReorderCategories(order: string[]) {
  const { categories } = await getStorageData(["categories"])
  const nextCategories = normalizeCategories(categories)

  const uniqueOrder = Array.from(new Set(order)).filter(
    (id) => nextCategories.items[id]
  )
  for (const id of Object.keys(nextCategories.items)) {
    if (!uniqueOrder.includes(id)) {
      uniqueOrder.push(id)
    }
  }
  if (!uniqueOrder.includes(nextCategories.defaultId)) {
    uniqueOrder.unshift(nextCategories.defaultId)
  }

  await setStorageData({
    categories: {
      ...nextCategories,
      order: uniqueOrder
    }
  })
}

export async function handleUpdateOverlayVisibleIds(
  overlayVisibleIds: string[]
) {
  const { categories } = await getStorageData(["categories"])
  const nextCategories = normalizeCategories(categories)
  const filtered = overlayVisibleIds.filter((id) => nextCategories.items[id])
  const normalized = filtered.length > 0 ? filtered : [nextCategories.defaultId]

  await setStorageData({
    categories: {
      ...nextCategories,
      overlayVisibleIds: normalized
    }
  })
}

export async function handleUpdateActiveCategory(categoryId: string) {
  const { categories, settings } = await getStorageData([
    "categories",
    "settings"
  ])
  const nextCategories = normalizeCategories(categories)

  if (!nextCategories.items[categoryId]) {
    throw new Error("Category not found")
  }
  if (settings.activeCategoryId === categoryId) {
    return
  }

  await setStorageData({
    settings: {
      ...settings,
      activeCategoryId: categoryId
    }
  })
}

export async function handleBulkMoveEvents(
  eventIds: number[],
  targetCategoryId: string
) {
  const { categories, events, settings } = await getStorageData([
    "categories",
    "events",
    "settings"
  ])
  const nextCategories = normalizeCategories(categories)
  if (!nextCategories.items[targetCategoryId]) {
    throw new Error("Target category not found")
  }

  const eventIdSet = new Set(eventIds)
  const updatedEvents = produce(events, (draft) => {
    draft.items = draft.items.map((event) =>
      eventIdSet.has(event.id)
        ? { ...event, categoryId: targetCategoryId }
        : event
    )
  })

  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  try {
    await setStorageData({
      events: updatedEvents,
      ratings: nextRatings
    })
  } catch (error) {
    handleBackgroundError(error, "categories:bulkMove")
    throw error
  }
}
