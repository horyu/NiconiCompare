import { produce } from "immer"

import { normalizeCategories } from "../../lib/categories"
import { DEFAULT_CATEGORY_ID } from "../../lib/constants"
import { withStorageUpdates } from "../services/storage"
import { rebuildRatingsFromEvents } from "../utils/ratingHelpers"

export async function handleCreateCategory(name: string) {
  const result = await withStorageUpdates({
    keys: ["categories"],
    context: "bg:categories:create",
    update: ({ categories }) => {
      const nextCategories = normalizeCategories(categories)
      const id = crypto.randomUUID()
      const createdAt = Date.now()
      const updated = produce(nextCategories, (draft) => {
        draft.items[id] = { id, name, createdAt }
        draft.order.push(id)
      })
      return {
        updates: { categories: updated },
        result: id
      }
    }
  })
  return result ?? ""
}

export async function handleUpdateCategoryName(
  categoryId: string,
  name: string
) {
  await withStorageUpdates({
    keys: ["categories"],
    context: "bg:categories:updateName",
    update: ({ categories }) => {
      const nextCategories = normalizeCategories(categories)
      if (!nextCategories.items[categoryId]) {
        throw new Error("Category not found")
      }
      const updated = produce(nextCategories, (draft) => {
        draft.items[categoryId].name = name
      })
      return { updates: { categories: updated } }
    }
  })
}

export async function handleDeleteCategory(
  categoryId: string,
  moveToCategoryId?: string
) {
  if (categoryId === DEFAULT_CATEGORY_ID) {
    throw new Error("Default category cannot be deleted")
  }
  await withStorageUpdates({
    keys: ["categories", "events", "settings"],
    context: "bg:categories:delete",
    update: ({ categories, events, settings }) => {
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
          ? (moveToCategoryId ?? updatedCategories.defaultId)
          : settings.activeCategoryId

      const nextRatings = rebuildRatingsFromEvents(
        updatedEvents.items,
        settings
      )

      return {
        updates: {
          categories: updatedCategories,
          events: updatedEvents,
          ratings: nextRatings,
          settings: {
            ...settings,
            activeCategoryId: nextActiveCategoryId
          }
        }
      }
    }
  })
}

export async function handleReorderCategories(order: string[]) {
  await withStorageUpdates({
    keys: ["categories"],
    context: "bg:categories:reorder",
    update: ({ categories }) => {
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

      return {
        updates: {
          categories: {
            ...nextCategories,
            order: uniqueOrder
          }
        }
      }
    }
  })
}

export async function handleUpdateOverlayVisibleIds(
  overlayVisibleIds: string[]
) {
  await withStorageUpdates({
    keys: ["categories"],
    context: "bg:categories:updateOverlayVisibleIds",
    update: ({ categories }) => {
      const nextCategories = normalizeCategories(categories)
      const filtered = overlayVisibleIds.filter(
        (id) => nextCategories.items[id]
      )
      const normalized =
        filtered.length > 0 ? filtered : [nextCategories.defaultId]

      return {
        updates: {
          categories: {
            ...nextCategories,
            overlayVisibleIds: normalized
          }
        }
      }
    }
  })
}

export async function handleUpdateActiveCategory(categoryId: string) {
  await withStorageUpdates({
    keys: ["categories", "settings"],
    context: "bg:categories:updateActive",
    update: ({ categories, settings }) => {
      const nextCategories = normalizeCategories(categories)
      if (!nextCategories.items[categoryId]) {
        throw new Error("Category not found")
      }
      if (settings.activeCategoryId === categoryId) {
        return { updates: {} }
      }
      return {
        updates: {
          settings: {
            ...settings,
            activeCategoryId: categoryId
          }
        }
      }
    }
  })
}

export async function handleBulkMoveEvents(
  eventIds: number[],
  targetCategoryId: string
) {
  await withStorageUpdates({
    keys: ["categories", "events", "settings"],
    context: "bg:categories:bulkMove",
    update: ({ categories, events, settings }) => {
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

      const nextRatings = rebuildRatingsFromEvents(
        updatedEvents.items,
        settings
      )

      return {
        updates: {
          events: updatedEvents,
          ratings: nextRatings
        }
      }
    }
  })
}
