import { produce } from "immer"

import type { NcEventsBucket } from "../../lib/types"
import { withStorageUpdates } from "../services/storage"
import { rebuildRatingsFromEvents } from "../utils/ratingHelpers"

export async function handleDeleteEvent(eventId: number) {
  const result = await withStorageUpdates({
    keys: ["events", "settings", "meta"],
    context: "bg:events:delete",
    update: ({ events, settings, meta }) => {
      const index = events.items.findIndex((event) => event.id === eventId)
      if (index === -1) {
        return { updates: {}, result: false }
      }

      if (events.items[index].disabled) {
        return { updates: {}, result: true }
      }

      const updatedEvents = produce(events, (draft) => {
        draft.items[index] = { ...draft.items[index], disabled: true }
      })
      const nextRatings = rebuildRatingsFromEvents(
        updatedEvents.items,
        settings
      )

      return {
        updates: {
          events: updatedEvents,
          ratings: nextRatings,
          meta
        },
        result: true
      }
    }
  })

  return result ?? false
}

export async function handleRestoreEvent(eventId: number) {
  const result = await withStorageUpdates({
    keys: ["events", "settings"],
    context: "bg:events:restore",
    update: ({ events, settings }) => {
      const index = events.items.findIndex((event) => event.id === eventId)
      if (index === -1) {
        return { updates: {}, result: false }
      }

      if (!events.items[index].disabled) {
        return { updates: {}, result: true }
      }

      const updatedEvents = produce(events, (draft) => {
        draft.items[index] = { ...draft.items[index], disabled: false }
      })
      const nextRatings = rebuildRatingsFromEvents(
        updatedEvents.items,
        settings
      )

      return {
        updates: {
          events: updatedEvents,
          ratings: nextRatings
        },
        result: true
      }
    }
  })

  return result ?? false
}

export async function handlePurgeEvent(eventId: number) {
  const result = await withStorageUpdates({
    keys: ["events", "settings", "meta"],
    context: "bg:events:purge",
    update: ({ events, settings, meta }) => {
      const index = events.items.findIndex((event) => event.id === eventId)
      if (index === -1) {
        return { updates: {}, result: false }
      }

      if (!events.items[index].disabled) {
        return { updates: {}, result: false }
      }

      const updatedEvents: NcEventsBucket = {
        items: events.items.filter((event) => event.id !== eventId),
        nextId: events.nextId
      }
      const nextRatings = rebuildRatingsFromEvents(
        updatedEvents.items,
        settings
      )

      return {
        updates: {
          events: updatedEvents,
          ratings: nextRatings,
          meta
        },
        result: true
      }
    }
  })

  return result ?? false
}
