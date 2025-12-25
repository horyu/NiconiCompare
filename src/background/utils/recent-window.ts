import type { CompareEvent, NcVideos } from "../../lib/types"

export function rebuildRecentWindowFromEvents(
  events: CompareEvent[],
  size: number,
  videos: NcVideos
) {
  if (size <= 0) {
    return []
  }
  const next: string[] = []
  let inspected = 0
  for (
    let i = events.length - 1;
    i >= 0 && inspected < 100 && next.length < size;
    i--
  ) {
    const event = events[i]
    inspected++
    if (event.disabled) {
      continue
    }
    const candidates = [event.currentVideoId, event.opponentVideoId]
    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }
      if (!videos[candidate]) {
        continue
      }
      if (!next.includes(candidate)) {
        next.push(candidate)
        if (next.length >= size) {
          break
        }
      }
    }
  }
  return next.slice(0, size)
}
