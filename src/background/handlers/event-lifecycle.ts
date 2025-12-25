import { produce } from "immer"

import type { NcEventsBucket } from "../../lib/types"
import { getStorageData, setStorageData } from "../services/storage"
import { rebuildRatingsFromEvents } from "../utils/rating-helpers"

export async function handleDeleteEvent(eventId: number) {
  const { events, settings, meta } = await getStorageData([
    "events",
    "settings",
    "meta"
  ])

  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return false
  }

  if (events.items[index].disabled) {
    return true
  }

  const updatedEvents = produce(events, (draft) => {
    draft.items[index] = { ...draft.items[index], disabled: true }
  })
  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    events: updatedEvents,
    ratings: nextRatings,
    meta
  })

  return true
}

export async function handleRestoreEvent(eventId: number) {
  const { events, settings } = await getStorageData(["events", "settings"])

  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return false
  }

  if (!events.items[index].disabled) {
    return true
  }

  const updatedEvents = produce(events, (draft) => {
    draft.items[index] = { ...draft.items[index], disabled: false }
  })
  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    events: updatedEvents,
    ratings: nextRatings
  })

  return true
}

export async function handlePurgeEvent(eventId: number) {
  const { events, settings, meta } = await getStorageData([
    "events",
    "settings",
    "meta"
  ])

  const index = events.items.findIndex((event) => event.id === eventId)
  if (index === -1) {
    return false
  }

  if (!events.items[index].disabled) {
    return false
  }

  const updatedEvents: NcEventsBucket = {
    items: events.items.filter((event) => event.id !== eventId),
    nextId: events.nextId
  }
  const nextRatings = rebuildRatingsFromEvents(updatedEvents.items, settings)

  await setStorageData({
    events: updatedEvents,
    ratings: nextRatings,
    meta
  })

  return true
}
