import { useEffect, useState, type ReactElement } from "react"

import "../style.css"
import { MESSAGE_TYPES } from "../lib/constants"
import { sendNcMessage } from "../lib/messages"
import { runNcAction } from "../lib/ncAction"
import type {
  NcCategories,
  NcEventsBucket,
  NcMeta,
  NcSettings,
  NcVideos
} from "../lib/types"
import { createWatchUrl } from "../lib/url"
import {
  buildRecentEvents,
  buildRecentEventVideoVerdictStats,
  labelVerdict,
  verdictToStatKey,
  type VideoVerdictStatKey,
  type VideoVerdictStats
} from "./utils"

interface PopupSnapshot {
  settings: NcSettings
  events: NcEventsBucket
  meta: NcMeta
  videos: NcVideos
  categories: NcCategories
}

export default function Popup(): ReactElement {
  const [snapshot, setSnapshot] = useState<PopupSnapshot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refreshState = async (): Promise<void> => {
    setLoading(true)
    const response = await runNcAction<PopupSnapshot>(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.requestState
        }),
      {
        context: "ui:popup:request-state",
        errorMessage: "状態取得に失敗しました"
      }
    )
    if (!response?.ok) {
      setError("状態取得に失敗しました")
      setLoading(false)
      return
    }
    setSnapshot(response.data)
    setLoading(false)
  }

  // chrome.storageからの初期データ読み込み（外部システム同期）
  // NOTE: chrome.storage APIが非同期のため、useSyncExternalStoreの直接適用は困難
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState()
  }, [])

  const toggleOverlay = async (enabled: boolean): Promise<void> => {
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

  const toggleVideoVerdictCounts = async (enabled: boolean): Promise<void> => {
    setError(undefined)
    const response = await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.updateSettings,
          payload: { showPopupVideoVerdictCounts: enabled }
        }),
      {
        context: "ui:popup:toggle-video-verdict-counts",
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
  const videoVerdictStatsByEvent = buildRecentEventVideoVerdictStats(
    snapshot.events,
    lastEvents,
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm truncate">
            直近の評価（{activeCategoryName}）
          </h3>
          <label className="text-xs flex items-center gap-1 whitespace-nowrap">
            <input
              type="checkbox"
              checked={snapshot.settings.showPopupVideoVerdictCounts}
              title="各動画の 勝/引き分け/敗 を表示"
              onChange={(e) => {
                void toggleVideoVerdictCounts(e.target.checked)
              }}
            />
            勝敗数
          </label>
        </div>
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
                    event.currentVideoId,
                    snapshot.settings.showPopupVideoVerdictCounts
                      ? videoVerdictStatsByEvent[event.id]?.[
                          event.currentVideoId
                        ]
                      : undefined,
                    snapshot.settings.showPopupVideoVerdictCounts
                      ? verdictToStatKey(event.verdict)
                      : undefined
                  )}
                  <span className="w-fit justify-self-center text-base font-bold text-center text-slate-700 dark:text-slate-200">
                    {labelVerdict(event.verdict)}
                  </span>
                  {renderVideoCard(
                    snapshot.videos[event.opponentVideoId],
                    event.opponentVideoId,
                    snapshot.settings.showPopupVideoVerdictCounts
                      ? videoVerdictStatsByEvent[event.id]?.[
                          event.opponentVideoId
                        ]
                      : undefined,
                    snapshot.settings.showPopupVideoVerdictCounts
                      ? toOpponentStatKey(event.verdict)
                      : undefined
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

function renderVideoCard(
  video: PopupSnapshot["videos"][string] | undefined,
  videoId: string,
  verdictStats?: VideoVerdictStats,
  highlightedStatKey?: VideoVerdictStatKey
): ReactElement {
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
      {verdictStats && (
        <span className="w-full text-center text-[11px] text-slate-700 dark:text-slate-300">
          <span className={highlightedStatKey === "wins" ? "font-bold" : ""}>
            {verdictStats.wins}
          </span>
          /
          <span className={highlightedStatKey === "draws" ? "font-bold" : ""}>
            {verdictStats.draws}
          </span>
          /
          <span className={highlightedStatKey === "losses" ? "font-bold" : ""}>
            {verdictStats.losses}
          </span>
        </span>
      )}
    </a>
  )
}

function toOpponentStatKey(
  verdict: "better" | "same" | "worse"
): VideoVerdictStatKey {
  switch (verdict) {
    case "better":
      return "losses"
    case "same":
      return "draws"
    case "worse":
      return "wins"
    default:
      return "draws"
  }
}
