import { useEffect, useState } from "react"

import "../style.css"

import { MESSAGE_TYPES } from "../lib/constants"
import { sendNcMessage } from "../lib/messages"
import { runNcAction } from "../lib/nc-action"
import type {
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcSettings,
  NcVideos
} from "../lib/types"
import { createWatchUrl } from "../lib/url"

interface PopupSnapshot {
  settings: NcSettings
  events: NcEventsBucket
  meta: NcMeta
  videos: NcVideos
  categories: NcCategories
}

export default function Popup() {
  const [snapshot, setSnapshot] = useState<PopupSnapshot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refreshState = async () => {
    setLoading(true)
    const response = await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.requestState
        }),
      {
        context: "ui:popup:request-state",
        errorMessage: "状態取得に失敗しました"
      }
    )
    if (!response) {
      setError("状態取得に失敗しました")
      setLoading(false)
      return
    }
    setSnapshot(response.data as PopupSnapshot)
    setLoading(false)
  }

  useEffect(() => {
    void refreshState()
  }, [])

  const toggleOverlay = async (enabled: boolean) => {
    setError(undefined)
    const response = await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.toggleOverlay,
          payload: { enabled }
        }),
      {
        context: "ui:popup:toggle-overlay",
        errorMessage: "更新に失敗しました。"
      }
    )
    if (!response) {
      setError("更新に失敗しました。")
      return
    }
    await refreshState()
  }

  if (loading) {
    return (
      <main className="w-80 p-4 flex flex-col gap-4 font-sans bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p>読込中...</p>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main className="w-80 p-4 flex flex-col gap-4 font-sans bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p>状態を取得できませんでした。</p>
        {error && (
          <small className="text-rose-500 dark:text-rose-300">{error}</small>
        )}
      </main>
    )
  }

  const activeCategoryId = snapshot.categories.items[
    snapshot.settings.activeCategoryId
  ]
    ? snapshot.settings.activeCategoryId
    : snapshot.categories.defaultId
  const activeCategoryName =
    snapshot.categories.items[activeCategoryId]?.name ?? "カテゴリ"
  const lastEvents = buildRecentEvents(
    snapshot.events,
    snapshot.settings.popupRecentCount,
    activeCategoryId,
    snapshot.categories.defaultId
  )
  return (
    <main className="w-80 p-4 flex flex-col gap-4 font-sans bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
        <h3 className="text-sm mb-2 truncate">
          <span className="block max-w-full truncate">
            直近の評価（{activeCategoryName}）
          </span>
        </h3>
        {lastEvents.length === 0 ? (
          <p className="text-xs opacity-70 text-slate-500 dark:text-slate-400">
            評価なし
          </p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-1 text-[13px]">
            {lastEvents.map((event) => {
              const timestamp = new Date(event.timestamp)
              return (
                <li
                  key={event.id}
                  className="grid grid-cols-[auto_96px_auto_96px] items-center gap-0 p-2 rounded-lg bg-slate-900/10 dark:bg-white/10">
                  <div className="flex flex-col gap-0.5 text-[10px]">
                    <strong>#{event.id}</strong>
                    <span>{timestamp.toLocaleDateString()}</span>
                    <span>{timestamp.toLocaleTimeString()}</span>
                  </div>
                  {renderVideoCard(
                    snapshot.videos[event.currentVideoId],
                    event.currentVideoId
                  )}
                  <span className="w-fit justify-self-center text-base font-bold text-center text-slate-700 dark:text-slate-200">
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

      {error && (
        <small className="text-rose-500 dark:text-rose-300">{error}</small>
      )}
    </main>
  )
}

function buildRecentEvents(
  events: NcEventsBucket,
  limit: number,
  categoryId: string,
  defaultCategoryId: string
) {
  return [...events.items]
    .filter((event) => !event.disabled)
    .filter((event) => (event.categoryId ?? defaultCategoryId) === categoryId)
    .sort((a, b) => b.id - a.id)
    .slice(0, Math.max(1, limit))
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
  const watchUrl = createWatchUrl(videoId)
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
          className="w-24 h-[54px] rounded-md object-cover bg-slate-200 dark:bg-slate-700"
        />
      ) : (
        <div className="w-24 h-[54px] rounded-md bg-slate-200 dark:bg-slate-700" />
      )}
    </a>
  )
}
