import type { NcEventsBucket, NcSettings } from "../../lib/types"
import type { StorageDataByKey } from "../services/storage"
import { rebuildRatingsFromEvents } from "../utils/ratingHelpers"

interface BuildEventMutationUpdatesParams {
  currentEvents: NcEventsBucket
  nextEvents: NcEventsBucket
  settings: NcSettings
  extraUpdates?: Partial<StorageDataByKey>
}

export function buildEventMutationUpdates({
  currentEvents,
  nextEvents,
  settings,
  extraUpdates = {}
}: BuildEventMutationUpdatesParams): Partial<StorageDataByKey> {
  if (nextEvents === currentEvents) {
    return extraUpdates
  }

  return {
    ...extraUpdates,
    events: nextEvents,
    ratings: rebuildRatingsFromEvents(nextEvents.items, settings)
  }
}
