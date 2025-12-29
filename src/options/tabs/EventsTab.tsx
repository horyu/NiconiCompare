import { useEffect, useMemo, useRef, useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { handleUIError, NcError } from "../../lib/error-handler"
import { sendNcMessage } from "../../lib/messages"
import type { CompareEvent, Verdict } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"
import { EventVideoLabel } from "../components/EventVideoLabel"
import { ExportMenu } from "../components/ExportMenu"
import { Pagination } from "../components/Pagination"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { buildDelimitedText, downloadDelimitedFile } from "../utils/export"
import { readSessionState, writeSessionState } from "../utils/sessionStorage"

type EventsTabProps = {
  snapshot: OptionsSnapshot
  eventShowThumbnails: boolean
  onToggleEventThumbnails: (checked: boolean) => void
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

type EventSessionState = {
  search: string
  verdict: string
  includeDeleted: boolean
  categoryId: string
  page: number
}

const EVENT_PAGE_SIZE = 100
const SESSION_KEY = "nc_options_event_state"
const DEFAULT_EVENT_SESSION_STATE: EventSessionState = {
  search: "",
  verdict: "all",
  includeDeleted: false,
  categoryId: "",
  page: 1
}

export const EventsTab = ({
  snapshot,
  eventShowThumbnails,
  onToggleEventThumbnails,
  refreshState,
  showToast
}: EventsTabProps) => {
  const initialStateRef = useRef<EventSessionState>()
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  if (!initialStateRef.current) {
    initialStateRef.current = readSessionState(
      SESSION_KEY,
      DEFAULT_EVENT_SESSION_STATE
    )
  }
  const initialState = initialStateRef.current
  const [eventSearch, setEventSearch] = useState(initialState.search)
  const [eventVerdict, setEventVerdict] = useState(initialState.verdict)
  const [eventIncludeDeleted, setEventIncludeDeleted] = useState(
    initialState.includeDeleted
  )
  const [eventCategoryId, setEventCategoryId] = useState(
    initialState.categoryId || snapshot.settings.activeCategoryId
  )
  const [eventPage, setEventPage] = useState(initialState.page)
  const shouldResetPageRef = useRef(false)
  const [eventBusyId, setEventBusyId] = useState<number | null>(null)
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState(
    snapshot.categories.defaultId
  )
  const categoryOptions = snapshot.categories.order.filter(
    (id) => snapshot.categories.items[id]
  )
  const bulkMoveTargets = categoryOptions.filter((id) => id !== eventCategoryId)

  useEffect(() => {
    if (!shouldResetPageRef.current) {
      shouldResetPageRef.current = true
      return
    }
    setEventPage(1)
  }, [eventSearch, eventVerdict, eventIncludeDeleted, eventCategoryId])

  useEffect(() => {
    writeSessionState(SESSION_KEY, {
      search: eventSearch,
      verdict: eventVerdict,
      includeDeleted: eventIncludeDeleted,
      categoryId: eventCategoryId,
      page: eventPage
    })
  }, [
    eventSearch,
    eventVerdict,
    eventIncludeDeleted,
    eventPage,
    eventCategoryId
  ])

  useEffect(() => {
    if (!snapshot.categories.items[eventCategoryId]) {
      setEventCategoryId(snapshot.categories.defaultId)
    }
  }, [eventCategoryId, snapshot.categories])

  useEffect(() => {
    if (bulkMoveTargets.length === 0) {
      return
    }
    if (!bulkMoveTargets.includes(bulkMoveTargetId)) {
      setBulkMoveTargetId(bulkMoveTargets[0])
    }
  }, [bulkMoveTargetId, bulkMoveTargets])

  const filteredEvents = useMemo(() => {
    const normalizedSearch = eventSearch.trim().toLowerCase()
    const events = snapshot.events.items.filter((event) => {
      if (!eventIncludeDeleted && event.disabled) {
        return false
      }
      if (eventVerdict !== "all" && event.verdict !== eventVerdict) {
        return false
      }
      const categoryId = event.categoryId ?? snapshot.categories.defaultId
      if (categoryId !== eventCategoryId) {
        return false
      }
      if (normalizedSearch.length === 0) {
        return true
      }
      const idMatch = String(event.id).includes(normalizedSearch)
      const current = snapshot.videos[event.currentVideoId]
      const opponent = snapshot.videos[event.opponentVideoId]
      const currentAuthor = current
        ? snapshot.authors[current.authorUrl]?.name
        : undefined
      const opponentAuthor = opponent
        ? snapshot.authors[opponent.authorUrl]?.name
        : undefined
      const text =
        `${event.currentVideoId} ${event.opponentVideoId} ` +
        `${current?.title ?? ""} ${opponent?.title ?? ""} ` +
        `${currentAuthor ?? ""} ${opponentAuthor ?? ""}`
      return idMatch || text.toLowerCase().includes(normalizedSearch)
    })
    return events.sort((a, b) => b.id - a.id)
  }, [
    snapshot,
    eventIncludeDeleted,
    eventSearch,
    eventVerdict,
    eventCategoryId
  ])

  const start = (eventPage - 1) * EVENT_PAGE_SIZE
  const pagedEvents = filteredEvents.slice(start, start + EVENT_PAGE_SIZE)

  const eventTotalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE)
  )

  const handleExport = (format: "csv" | "tsv", withBom: boolean) => {
    const exportRows = buildExportRows({ events: filteredEvents, snapshot })
    const delimiter = format === "csv" ? "," : "\t"
    const content = buildDelimitedText({
      header: [
        "ID",
        "日時",
        "状態",
        "基準動画ID",
        "基準動画URL",
        "基準動画タイトル",
        "基準投稿者",
        "比較動画ID",
        "比較動画URL",
        "比較動画タイトル",
        "比較投稿者",
        "評価"
      ],
      rows: exportRows.map((row) => [
        row.id,
        row.occurredAt,
        row.status,
        row.currentVideoId,
        row.currentVideoUrl,
        row.currentVideoTitle,
        row.currentVideoAuthor,
        row.opponentVideoId,
        row.opponentVideoUrl,
        row.opponentVideoTitle,
        row.opponentVideoAuthor,
        row.verdict
      ]),
      delimiter
    })
    downloadDelimitedFile({
      content,
      format,
      withBom,
      filenamePrefix: "NiconiCompareComparison",
      categoryName:
        snapshot.categories.items[eventCategoryId]?.name ?? eventCategoryId
    })
    setExportMenuOpen(false)
  }

  const handleCategoryChange = async (categoryId: string) => {
    setEventCategoryId(categoryId)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.updateActiveCategory,
        payload: { categoryId }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "update failed",
          "options:events:category",
          "カテゴリの更新に失敗しました。"
        )
      }
      await refreshState(true)
    } catch (error) {
      handleUIError(error, "options:events:category", showToast)
    }
  }

  const handleBulkMove = async (targetCategoryId: string) => {
    if (!targetCategoryId) {
      return
    }
    const count = filteredEvents.length
    const targetName = snapshot.categories.items[targetCategoryId]?.name ?? ""
    const confirmed = confirm(
      `検索条件に一致する ${count} 件を [${targetName}] カテゴリに移動します。よろしいですか？`
    )
    if (!confirmed) {
      return
    }
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.bulkMoveEvents,
        payload: {
          eventIds: filteredEvents.map((event) => event.id),
          targetCategoryId
        }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "bulk move failed",
          "options:events:bulk-move",
          "一括移動に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "カテゴリを一括移動しました。")
    } catch (error) {
      handleUIError(error, "options:events:bulk-move", showToast)
    }
  }

  const handleEventVerdictChange = async (
    target: CompareEvent,
    verdict: Verdict
  ) => {
    if (target.disabled) {
      return
    }
    setEventBusyId(target.id)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.recordEvent,
        payload: {
          currentVideoId: target.currentVideoId,
          opponentVideoId: target.opponentVideoId,
          verdict,
          eventId: target.id
        }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "update failed",
          "options:events:update",
          "評価の更新に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "評価を更新しました。")
    } catch (error) {
      handleUIError(error, "options:events:update", showToast)
    } finally {
      setEventBusyId(null)
    }
  }

  const handleDeleteEvent = async (eventId: number) => {
    setEventBusyId(eventId)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.deleteEvent,
        payload: { eventId }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "delete failed",
          "options:events:disable",
          "評価の無効化に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "評価を無効化しました。")
    } catch (error) {
      handleUIError(error, "options:events:disable", showToast)
    } finally {
      setEventBusyId(null)
    }
  }

  const handleRestoreEvent = async (eventId: number) => {
    setEventBusyId(eventId)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.restoreEvent,
        payload: { eventId }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "restore failed",
          "options:events:restore",
          "評価の有効化に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "評価を有効化しました。")
    } catch (error) {
      handleUIError(error, "options:events:restore", showToast)
    } finally {
      setEventBusyId(null)
    }
  }

  const handlePurgeEvent = async (eventId: number) => {
    const confirmed = confirm(
      "無効化済み評価を削除します。元に戻せません。続行しますか？"
    )
    if (!confirmed) return
    setEventBusyId(eventId)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.purgeEvent,
        payload: { eventId }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "purge failed",
          "options:events:purge",
          "評価の削除に失敗しました。"
        )
      }
      await refreshState(true)
      showToast("success", "評価を削除しました。")
    } catch (error) {
      handleUIError(error, "options:events:purge", showToast)
    } finally {
      setEventBusyId(null)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">評価一覧</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            {filteredEvents.length} 件
          </div>
          <ExportMenu
            open={exportMenuOpen}
            onToggle={() => setExportMenuOpen((prev) => !prev)}
            onExport={handleExport}
          />
        </div>
      </header>

      <div className="flex items-end gap-3 flex-nowrap">
        <label className="text-sm flex flex-col gap-1 min-w-[220px]">
          検索
          <input
            value={eventSearch}
            onChange={(event) => setEventSearch(event.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1"
            placeholder="ID・タイトル・動画ID・投稿者で検索"
          />
        </label>
        <label className="text-sm flex flex-col gap-1 min-w-[140px]">
          評価
          <select
            value={eventVerdict}
            onChange={(event) => setEventVerdict(event.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1">
            <option value="all">全て</option>
            <option value="better">勝ち</option>
            <option value="same">引き分け</option>
            <option value="worse">負け</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1 min-w-[140px]">
          カテゴリ
          <select
            value={eventCategoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1">
            {categoryOptions.map((id) => (
              <option key={id} value={id}>
                {snapshot.categories.items[id]?.name ?? "カテゴリ"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm flex items-center gap-2 mb-1">
          <input
            type="checkbox"
            checked={eventIncludeDeleted}
            onChange={(event) => setEventIncludeDeleted(event.target.checked)}
          />
          無効化済みも表示
        </label>
        <label className="text-sm flex items-center gap-2 mb-1">
          <input
            type="checkbox"
            checked={eventShowThumbnails}
            onChange={(event) => onToggleEventThumbnails(event.target.checked)}
          />
          サムネ表示
        </label>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span>一括移動:</span>
        <select
          value={bulkMoveTargetId}
          onChange={(event) => setBulkMoveTargetId(event.target.value)}
          className="border border-slate-200 rounded-md px-2 py-1">
          {bulkMoveTargets.map((id) => (
            <option key={id} value={id}>
              {snapshot.categories.items[id]?.name ?? "カテゴリ"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => handleBulkMove(bulkMoveTargetId)}
          disabled={filteredEvents.length === 0 || bulkMoveTargets.length === 0}
          className="px-3 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50">
          現在の条件で移動
        </button>
      </div>

      <Pagination
        current={eventPage}
        total={eventTotalPages}
        onChange={setEventPage}
      />

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[40px_70px_1fr_1fr_90px_90px] gap-2 bg-slate-100 text-xs font-semibold px-3 py-2">
          <div>ID</div>
          <div>日時</div>
          <div>基準</div>
          <div>比較対象</div>
          <div>評価</div>
          <div>操作</div>
        </div>
        <div className="divide-y divide-slate-100">
          {pagedEvents.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">
              表示できる評価がありません。
            </div>
          ) : (
            pagedEvents.map((event) => {
              const currentVideo = snapshot.videos[event.currentVideoId]
              const opponentVideo = snapshot.videos[event.opponentVideoId]
              const timestamp = new Date(event.timestamp)
              const isBusy = eventBusyId === event.id
              const currentIsWinner =
                !event.disabled && event.verdict === "better"
              const opponentIsWinner =
                !event.disabled && event.verdict === "worse"
              return (
                <div
                  key={event.id}
                  className="grid grid-cols-[40px_70px_1fr_1fr_90px_90px] gap-2 items-center px-3 py-2 text-sm">
                  <div className="font-medium flex flex-col gap-1 items-center">
                    <span>#{event.id}</span>
                    {event.disabled && (
                      <span className="text-[10px] px-2 py-[1px] rounded-full bg-slate-100 text-slate-500 border border-slate-200 w-fit">
                        無効
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {timestamp.toLocaleDateString()}
                    <br />
                    {timestamp.toLocaleTimeString()}
                  </div>
                  <div
                    className={
                      currentIsWinner
                        ? "border-l-4 border-l-slate-400 pl-2"
                        : ""
                    }>
                    <EventVideoLabel
                      videoId={event.currentVideoId}
                      video={currentVideo}
                      authorName={
                        currentVideo
                          ? snapshot.authors[currentVideo.authorUrl]?.name
                          : undefined
                      }
                      showThumbnail={eventShowThumbnails}
                    />
                  </div>
                  <div
                    className={
                      opponentIsWinner
                        ? "border-l-4 border-l-slate-400 pl-2"
                        : ""
                    }>
                    <EventVideoLabel
                      videoId={event.opponentVideoId}
                      video={opponentVideo}
                      authorName={
                        opponentVideo
                          ? snapshot.authors[opponentVideo.authorUrl]?.name
                          : undefined
                      }
                      showThumbnail={eventShowThumbnails}
                    />
                  </div>
                  <select
                    value={event.verdict}
                    disabled={event.disabled || isBusy}
                    onChange={(e) =>
                      handleEventVerdictChange(event, e.target.value as Verdict)
                    }
                    className="border border-slate-200 rounded-md px-2 py-1 text-sm">
                    <option value="better">勝ち</option>
                    <option value="same">引き分け</option>
                    <option value="worse">負け</option>
                  </select>
                  <div className="flex flex-col gap-2">
                    {!event.disabled ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event.id)}
                        disabled={isBusy}
                        className="px-3 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50">
                        無効化
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRestoreEvent(event.id)}
                          disabled={isBusy}
                          className="px-3 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50">
                          有効化
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePurgeEvent(event.id)}
                          disabled={isBusy}
                          className="px-3 py-1 rounded border border-rose-200 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <Pagination
        current={eventPage}
        total={eventTotalPages}
        onChange={setEventPage}
      />
    </section>
  )
}

type ExportRow = {
  id: string
  occurredAt: string
  status: string
  currentVideoId: string
  currentVideoUrl: string
  currentVideoTitle: string
  currentVideoAuthor: string
  opponentVideoId: string
  opponentVideoUrl: string
  opponentVideoTitle: string
  opponentVideoAuthor: string
  verdict: string
}

type ExportRowParams = {
  events: CompareEvent[]
  snapshot: OptionsSnapshot
}

const buildExportRows = ({
  events,
  snapshot
}: ExportRowParams): ExportRow[] => {
  return events.map((event) => {
    const currentVideo = snapshot.videos[event.currentVideoId]
    const opponentVideo = snapshot.videos[event.opponentVideoId]
    const currentAuthor = currentVideo
      ? snapshot.authors[currentVideo.authorUrl]?.name
      : ""
    const opponentAuthor = opponentVideo
      ? snapshot.authors[opponentVideo.authorUrl]?.name
      : ""
    return {
      id: String(event.id),
      occurredAt: new Date(event.timestamp).toLocaleString(),
      status: event.disabled ? "無効" : "有効",
      currentVideoId: event.currentVideoId,
      currentVideoUrl: createWatchUrl(event.currentVideoId),
      currentVideoTitle: currentVideo?.title ?? "",
      currentVideoAuthor: currentAuthor ?? "",
      opponentVideoId: event.opponentVideoId,
      opponentVideoUrl: createWatchUrl(event.opponentVideoId),
      opponentVideoTitle: opponentVideo?.title ?? "",
      opponentVideoAuthor: opponentAuthor ?? "",
      verdict:
        event.verdict === "better"
          ? "勝ち"
          : event.verdict === "same"
            ? "引き分け"
            : "負け"
    }
  })
}
