import { withStorageUpdates } from "../services/storage"
import { rebuildRatingsFromEvents } from "../utils/ratingHelpers"

export async function handleRebuildRatings(): Promise<void> {
  await withStorageUpdates({
    keys: ["events", "settings"],
    context: "bg:ratings:rebuild",
    update: ({ settings, events }) => ({
      updates: {
        ratings: rebuildRatingsFromEvents(events.items, settings)
      }
    })
  })
}
