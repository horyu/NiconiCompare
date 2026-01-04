import type { CompareEvent, NcVideos } from "../../lib/types"

export function updateRecentWindow(
  current: string[],
  size: number,
  candidates: (string | undefined)[],
  videos: NcVideos
) {
  const maxSize = Math.max(1, size)
  const result: string[] = []
  const seen = new Set<string>()

  // candidates を優先的に追加
  for (const candidate of candidates) {
    if (candidate && videos[candidate] && !seen.has(candidate)) {
      seen.add(candidate)
      result.push(candidate)
      if (result.length >= maxSize) {
        return result // 早期リターン
      }
    }
  }

  // current から追加
  for (const id of current) {
    if (videos[id] && !seen.has(id)) {
      seen.add(id)
      result.push(id)
      if (result.length >= maxSize) {
        return result // 早期リターン
      }
    }
  }

  return result
}

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
