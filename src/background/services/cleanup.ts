import { getStorageData, setStorageData } from "./storage"

const AUTO_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

export async function runAutoCleanupIfNeeded() {
  const { meta } = await getStorageData(["meta"])
  const lastCleanupAt = Number(meta.lastCleanupAt ?? 0)
  if (Date.now() - lastCleanupAt >= AUTO_CLEANUP_INTERVAL_MS) {
    await performCleanup()
  }
}

export async function performCleanup() {
  const { events, videos, authors, ratings, meta, state } =
    await getStorageData([
      "events",
      "videos",
      "authors",
      "ratings",
      "meta",
      "state"
    ])

  const referencedVideos = new Set<string>()
  const referencedAuthors = new Set<string>()

  events.items
    .filter((event) => !event.disabled)
    .forEach((event) => {
      if (event.currentVideoId) {
        referencedVideos.add(event.currentVideoId)
      }
      if (event.opponentVideoId) {
        referencedVideos.add(event.opponentVideoId)
      }
    })
  if (state.currentVideoId) {
    referencedVideos.add(state.currentVideoId)
  }
  if (state.pinnedOpponentVideoId) {
    referencedVideos.add(state.pinnedOpponentVideoId)
  }
  state.recentWindow.forEach((videoId) => {
    if (videoId) {
      referencedVideos.add(videoId)
    }
  })

  Object.values(videos).forEach((video) => {
    if (video.authorUrl) {
      referencedAuthors.add(video.authorUrl)
    }
  })

  const cleanedVideos = Object.fromEntries(
    Object.entries(videos).filter(([videoId]) => referencedVideos.has(videoId))
  )
  const cleanedRatings = Object.fromEntries(
    Object.entries(ratings).map(([categoryId, categoryRatings]) => [
      categoryId,
      Object.fromEntries(
        Object.entries(categoryRatings).filter(([videoId]) =>
          referencedVideos.has(videoId)
        )
      )
    ])
  )
  const cleanedAuthors = Object.fromEntries(
    Object.entries(authors).filter(([authorUrl]) =>
      referencedAuthors.has(authorUrl)
    )
  )

  await setStorageData({
    videos: cleanedVideos,
    ratings: cleanedRatings,
    authors: cleanedAuthors,
    meta: {
      ...meta,
      lastCleanupAt: Date.now()
    }
  })
}
