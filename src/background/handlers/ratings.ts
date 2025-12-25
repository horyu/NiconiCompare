import { getStorageData, setStorageData } from "../services/storage"
import { rebuildRatingsFromEvents } from "../utils/rating-helpers"

export async function handleRebuildRatings() {
  const { settings, events } = await getStorageData(["events", "settings"])
  const nextRatings = rebuildRatingsFromEvents(events.items, settings)

  await setStorageData({ ratings: nextRatings })
}
