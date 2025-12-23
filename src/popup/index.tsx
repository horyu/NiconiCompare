import { useEffect, useState } from "react"

import "../style.css"

import { MESSAGE_TYPES } from "../lib/constants"
import type { NcEventsBucket, NcMeta, NcSettings, NcVideos } from "../lib/types"

type PopupSnapshot = {
  settings: NcSettings
  events: NcEventsBucket
  meta: NcMeta
  videos: NcVideos
}

export default function Popup() {
  const [snapshot, setSnapshot] = useState<PopupSnapshot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    refreshState()
  }, [])

  const refreshState = async () => {
    setLoading(true)
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.requestState
    })
    if (!response?.ok) {
      setError(response?.error ?? "状態取得に失敗しました")
      setLoading(false)
      return
    }
    setSnapshot(response.data as PopupSnapshot)
    setLoading(false)
  }

  const toggleOverlay = async (enabled: boolean) => {
    setError(undefined)
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.toggleOverlay,
      payload: { enabled }
    })
    await refreshState()
  }

  if (loading) {
    return (
      <main className="w-80 p-4 flex flex-col gap-4 font-sans">
        <p>読込中...</p>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main className="w-80 p-4 flex flex-col gap-4 font-sans">
        <p>状態を取得できませんでした。</p>
        {error && <small className="text-red-300">{error}</small>}
      </main>
    )
  }

  const lastEvents = buildRecentEvents(snapshot.events)
  const meta = snapshot.meta

  return (
    <main className="w-80 p-4 flex flex-col gap-4 font-sans">
      <header className="flex items-center justify-between">
        <strong>NiconiCompare</strong>
        <label className="text-xs flex items-center gap-2">
          <input
            type="checkbox"
            checked={snapshot.settings.overlayAndCaptureEnabled}
            onChange={(e) => toggleOverlay(e.target.checked)}
          />
          オーバーレイ・動画情報取得
        </label>
      </header>

      <section>
        <h3 className="text-sm mb-2">直近イベント</h3>
        {lastEvents.length === 0 ? (
          <p className="text-xs opacity-70">イベントなし</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-1 text-[13px]">
            {lastEvents.map((event) => {
              const timestamp = new Date(event.timestamp)
              return (
                <li
                  key={event.id}
                  className="grid grid-cols-[auto_96px_auto_96px] items-center gap-0 p-2 rounded-lg bg-slate-900/10">
                  <div className="flex flex-col gap-0.5 text-[10px]">
                    <strong>#{event.id}</strong>
                    <span>{timestamp.toLocaleDateString()}</span>
                    <span>{timestamp.toLocaleTimeString()}</span>
                  </div>
                  {renderVideoCard(
                    snapshot.videos[event.currentVideoId],
                    event.currentVideoId
                  )}
                  <span className="w-fit justify-self-center text-base font-bold text-center text-slate-700">
                    {labelVerdict(event.verdict)}
                  </span>
                  {renderVideoCard(
                    snapshot.videos[event.opponentVideoId],
                    event.opponentVideoId
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm mb-2">Storage 状態</h3>
        <ul className="list-none p-0 m-0 flex flex-col gap-1 text-[13px]">
          <li>
            needsCleanup:{" "}
            {meta.needsCleanup ? (
              <span className="text-red-600">要対応</span>
            ) : (
              "OK"
            )}
          </li>
          <li>retryQueue: {meta.retryQueue.length} 件</li>
          <li>failedWrites: {meta.failedWrites.length} 件</li>
        </ul>
      </section>

      {error && <small className="text-red-300">{error}</small>}
    </main>
  )
}

function buildRecentEvents(events: NcEventsBucket) {
  return [...events.items]
    .filter((event) => !event.deleted)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)
}

function labelVerdict(verdict: string) {
  switch (verdict) {
    case "better":
      return ">"
    case "same":
      return "="
    case "worse":
      return "<"
    default:
      return verdict
  }
}

function renderVideoCard(
  video: PopupSnapshot["videos"][string] | undefined,
  videoId: string
) {
  const thumbnailUrl = video?.thumbnailUrls?.[0]
  const watchUrl = `https://www.nicovideo.jp/watch/${videoId}`
  return (
    <a
      href={watchUrl}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col items-center gap-1 w-24">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`${videoId} thumbnail`}
          className="w-24 h-[54px] rounded-md object-cover bg-slate-800"
        />
      ) : (
        <div className="w-24 h-[54px] rounded-md bg-slate-800" />
      )}
    </a>
  )
}
