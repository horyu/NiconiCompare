import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_META
} from "../../lib/constants"
import type {
  NcEventsBucket,
  NcRatings,
  NcSettings,
  RatingSnapshot
} from "../../lib/types"
import { normalizeSettings } from "../utils/normalize"
import { getRawStorageData, setStorageData } from "./storage"

const TARGET_SCHEMA_VERSION = "1.1.0"

export async function runMigrationIfNeeded() {
  const { meta } = await getRawStorageData(["meta"])
  const currentVersion = meta?.schemaVersion
  if (currentVersion !== "1.0.0") {
    return
  }

  const { events, ratings, settings } = await getRawStorageData([
    "events",
    "ratings",
    "settings"
  ])

  const legacyEvents = (events as NcEventsBucket) ?? {
    items: [],
    nextId: 1
  }
  const migratedEvents: NcEventsBucket = {
    ...legacyEvents,
    items: Array.isArray(legacyEvents.items)
      ? legacyEvents.items.map((event) => ({
          ...event,
          categoryId: event.categoryId ?? DEFAULT_CATEGORY_ID
        }))
      : []
  }

  const legacyRatings =
    (ratings as unknown as Record<string, RatingSnapshot>) ?? {}
  const migratedRatings: NcRatings = {
    [DEFAULT_CATEGORY_ID]: legacyRatings
  }

  const migratedSettings = normalizeSettings({
    ...(settings as Partial<NcSettings>),
    activeCategoryId: DEFAULT_CATEGORY_ID
  } as NcSettings)

  await setStorageData({
    meta: {
      ...DEFAULT_META,
      ...meta,
      schemaVersion: TARGET_SCHEMA_VERSION
    },
    settings: migratedSettings,
    events: migratedEvents,
    ratings: migratedRatings,
    categories: DEFAULT_CATEGORIES
  })
}
