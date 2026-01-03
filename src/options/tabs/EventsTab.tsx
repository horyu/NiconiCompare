import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { EVENT_PAGE_SIZE, MESSAGE_TYPES } from "../../lib/constants"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/nc-action"
import type { CompareEvent, Verdict } from "../../lib/types"
import { createWatchUrl } from "../../lib/url"
import { CategorySelect } from "../components/CategorySelect"
import { EventVideoLabel } from "../components/EventVideoLabel"
import { ExportMenu } from "../components/ExportMenu"
import { Pagination } from "../components/Pagination"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { useSessionState } from "../hooks/useSessionState"
import { buildCategoryOptions } from "../utils/categories"
import { buildDelimitedText, downloadDelimitedFile } from "../utils/export"
import { scrollIntoViewIfNeeded } from "../utils/scroll"

interface EventsTabProps {
  snapshot: OptionsSnapshot
  eventShowThumbnails: boolean
  onToggleEventThumbnails: (checked: boolean) => void
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

interface EventSessionState {
  search: string
  verdict: string
  includeDeleted: boolean
  categoryId: string
  showCategoryOps: boolean
  page: number
}

const SESSION_KEY = "nc_options_event_state"
const EXPORT_HEADERS = [
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
]
const DEFAULT_EVENT_SESSION_STATE: EventSessionState = {
  search: "",
  verdict: "all",
  includeDeleted: false,
  categoryId: "",
  showCategoryOps: false,
  page: 1
}

export const EventsTab = ({
  snapshot,
  eventShowThumbnails,
  onToggleEventThumbnails,
  refreshState,
  showToast
}: EventsTabProps) => {
  const { initialState, persistState } = useSessionState(
    SESSION_KEY,
    DEFAULT_EVENT_SESSION_STATE
  )
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [eventSearch, setEventSearch] = useState(initialState.search)
  const [eventVerdict, setEventVerdict] = useState(initialState.verdict)
  const [eventIncludeDeleted, setEventIncludeDeleted] = useState(
    initialState.includeDeleted
  )
  const [showCategoryOps, setShowCategoryOps] = useState(
    initialState.showCategoryOps
  )
  const [eventCategoryId, setEventCategoryId] = useState(
    initialState.categoryId || snapshot.settings.activeCategoryId
  )
  const [eventPage, setEventPage] = useState(initialState.page)
  const paginationTopRef = useRef<HTMLDivElement | null>(null)
  const [eventBusyId, setEventBusyId] = useState<number | null>(null)
  const [moveTargets, setMoveTargets] = useState<Record<number, string>>({})
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState(
    snapshot.categories.defaultId
  )
  const categoryOptions = buildCategoryOptions(snapshot.categories)
  const bulkMoveTargets = categoryOptions.filter(
    (option) => option.id !== eventCategoryId
  )

  const resetToFirstPage = useCallback(() => {
    setEventPage(1)
  }, [])

  useEffect(() => {
    persistState({
      search: eventSearch,
      verdict: eventVerdict,
      includeDeleted: eventIncludeDeleted,
      showCategoryOps,
      categoryId: eventCategoryId,
      page: eventPage
    })
  }, [
    persistState,
    eventSearch,
    eventVerdict,
    eventIncludeDeleted,
    showCategoryOps,
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
    if (!bulkMoveTargets.some((option) => option.id === bulkMoveTargetId)) {
      setBulkMoveTargetId(bulkMoveTargets[0].id)
    }
  }, [bulkMoveTargetId, bulkMoveTargets])

  const filteredEvents = useMemo(
    () =>
      filterEvents({
        events: snapshot.events.items,
        includeDeleted: eventIncludeDeleted,
        verdict: eventVerdict,
        categoryId: eventCategoryId,
        defaultCategoryId: snapshot.categories.defaultId,
        search: eventSearch,
        videos: snapshot.videos,
        authors: snapshot.authors
      }),
    [
      snapshot.events.items,
      snapshot.categories.defaultId,
      snapshot.videos,
      snapshot.authors,
      eventIncludeDeleted,
      eventSearch,
      eventVerdict,
      eventCategoryId
    ]
  )

  const start = (eventPage - 1) * EVENT_PAGE_SIZE
  const pagedEvents = filteredEvents.slice(start, start + EVENT_PAGE_SIZE)

  const eventTotalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE)
  )

  const handlePageChange = (nextPage: number) => {
    if (nextPage === eventPage) {
      return
    }
    setEventPage(nextPage)
    requestAnimationFrame(() => {
      scrollIntoViewIfNeeded(paginationTopRef.current, { block: "nearest" })
    })
  }

  // Handlers
  const handleCategoryChange = (categoryId: string) => {
    setEventCategoryId(categoryId)
    resetToFirstPage()
  }

  const handleExport = (format: "csv" | "tsv", withBom: boolean) => {
    const exportRows = buildExportRows({ events: filteredEvents, snapshot })
    const delimiter = format === "csv" ? "," : "\t"
    const content = buildDelimitedText({
      header: EXPORT_HEADERS,
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

  const handleBulkMove = async (targetCategoryId: string) => {
    if (!targetCategoryId) {
      return
    }
    const count = filteredEvents.length
    const targetName = snapshot.categories.items[targetCategoryId]?.name ?? ""
    const includeLabel = eventIncludeDeleted
      ? "無効化済みを含む"
      : "無効化済みは除外"
    const confirmed = confirm(
      `検索条件に一致する ${count} 件（${includeLabel}）を [${targetName}] カテゴリに移動します。よろしいですか？`
    )
    if (!confirmed) {
      return
    }
    const response = await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.bulkMoveEvents,
          payload: {
            eventIds: filteredEvents.map((event) => event.id),
            targetCategoryId
          }
        }),
      {
        context: "ui:options:events:bulk-move",
        errorMessage: "一括移動に失敗しました。",
        successMessage: "カテゴリを一括移動しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
    if (!response) {
      return
    }
  }

  const handleMoveEvent = async (eventId: number, targetCategoryId: string) => {
    if (!targetCategoryId) {
      return
    }
    setEventBusyId(eventId)
    try {
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.bulkMoveEvents,
            payload: {
              eventIds: [eventId],
              targetCategoryId
            }
          }),
        {
          context: "ui:options:events:move",
          errorMessage: "カテゴリの移動に失敗しました。",
          successMessage: "カテゴリを移動しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    } finally {
      setEventBusyId(null)
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
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.recordEvent,
            payload: {
              currentVideoId: target.currentVideoId,
              opponentVideoId: target.opponentVideoId,
              verdict,
              eventId: target.id
            }
          }),
        {
          context: "ui:options:events:update",
          errorMessage: "評価の更新に失敗しました。",
          successMessage: "評価を更新しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    } finally {
      setEventBusyId(null)
    }
  }

  const handleDeleteEvent = async (eventId: number) => {
    setEventBusyId(eventId)
    try {
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.deleteEvent,
            payload: { eventId }
          }),
        {
          context: "ui:options:events:disable",
          errorMessage: "評価の無効化に失敗しました。",
          successMessage: "評価を無効化しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    } finally {
      setEventBusyId(null)
    }
  }

  const handleRestoreEvent = async (eventId: number) => {
    setEventBusyId(eventId)
    try {
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.restoreEvent,
            payload: { eventId }
          }),
        {
          context: "ui:options:events:restore",
          errorMessage: "評価の有効化に失敗しました。",
          successMessage: "評価を有効化しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
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
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.purgeEvent,
            payload: { eventId }
          }),
        {
          context: "ui:options:events:purge",
          errorMessage: "評価の削除に失敗しました。",
          successMessage: "評価を削除しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    } finally {
      setEventBusyId(null)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4 dark:bg-slate-900 dark:border-slate-700">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          評価一覧
        </h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">
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
        <label className="text-sm flex flex-col gap-1 min-w-[220px] text-slate-700 dark:text-slate-200">
          検索
          <input
            value={eventSearch}
            onChange={(event) => {
              setEventSearch(event.target.value)
              resetToFirstPage()
            }}
            className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="ID・タイトル・動画ID・投稿者で検索"
          />
        </label>
        <label className="text-sm flex flex-col gap-1 min-w-[140px] text-slate-700 dark:text-slate-200">
          評価
          <select
            value={eventVerdict}
            onChange={(event) => {
              setEventVerdict(event.target.value)
              resetToFirstPage()
            }}
            className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="all">全て</option>
            <option value="better">勝ち</option>
            <option value="same">引き分け</option>
            <option value="worse">負け</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1 min-w-[140px] text-slate-700 dark:text-slate-200">
          カテゴリ
          <CategorySelect
            value={eventCategoryId}
            onChange={handleCategoryChange}
            options={categoryOptions}
            className="w-[15ch] max-w-[15ch]"
          />
        </label>
        <label className="text-sm flex items-center gap-2 mb-1 text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={eventIncludeDeleted}
            onChange={(event) => {
              setEventIncludeDeleted(event.target.checked)
              resetToFirstPage()
            }}
          />
          無効化済みも表示
        </label>
        <label className="text-sm flex items-center gap-2 mb-1 text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={showCategoryOps}
            onChange={(event) => setShowCategoryOps(event.target.checked)}
          />
          カテゴリ操作
        </label>
        <label className="text-sm flex items-center gap-2 mb-1 text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={eventShowThumbnails}
            onChange={(event) => onToggleEventThumbnails(event.target.checked)}
          />
          サムネ表示
        </label>
      </div>

      {showCategoryOps && (
        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>一括移動:</span>
          <CategorySelect
            value={bulkMoveTargetId}
            onChange={setBulkMoveTargetId}
            options={bulkMoveTargets}
            className="w-[15ch] max-w-[15ch]"
          />
          <button
            type="button"
            onClick={() => handleBulkMove(bulkMoveTargetId)}
            disabled={
              filteredEvents.length === 0 || bulkMoveTargets.length === 0
            }
            className="px-3 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
            現在の条件で移動
          </button>
        </div>
      )}

      <div ref={paginationTopRef}>
        <Pagination
          current={eventPage}
          total={eventTotalPages}
          onChange={handlePageChange}
        />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden dark:border-slate-700">
        <div
          className={`grid ${
            showCategoryOps
              ? "grid-cols-[40px_70px_1fr_1fr_90px_160px_90px]"
              : "grid-cols-[40px_70px_1fr_1fr_90px_90px]"
          } gap-2 bg-slate-100 text-xs font-semibold px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>
          <div>ID</div>
          <div>日時</div>
          <div>基準</div>
          <div>比較対象</div>
          <div>評価</div>
          {showCategoryOps && <div>カテゴリ</div>}
          <div>操作</div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {pagedEvents.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
              表示できる評価がありません。
            </div>
          ) : (
            pagedEvents.map((event) => {
              const currentVideo = snapshot.videos[event.currentVideoId]
              const opponentVideo = snapshot.videos[event.opponentVideoId]
              const timestamp = new Date(event.timestamp)
              const rowCategoryId =
                event.categoryId ?? snapshot.categories.defaultId
              const rowMoveTargets = categoryOptions.filter(
                (option) => option.id !== rowCategoryId
              )
              const rowMoveTargetId =
                moveTargets[event.id] ?? rowMoveTargets[0]?.id ?? ""
              const isBusy = eventBusyId === event.id
              const currentIsWinner =
                !event.disabled && event.verdict === "better"
              const opponentIsWinner =
                !event.disabled && event.verdict === "worse"
              return (
                <EventRow
                  key={event.id}
                  event={event}
                  showCategoryOps={showCategoryOps}
                  isBusy={isBusy}
                  currentVideo={currentVideo}
                  opponentVideo={opponentVideo}
                  currentAuthorName={
                    currentVideo
                      ? snapshot.authors[currentVideo.authorUrl]?.name
                      : undefined
                  }
                  opponentAuthorName={
                    opponentVideo
                      ? snapshot.authors[opponentVideo.authorUrl]?.name
                      : undefined
                  }
                  showThumbnails={eventShowThumbnails}
                  isCurrentWinner={currentIsWinner}
                  isOpponentWinner={opponentIsWinner}
                  timestamp={timestamp}
                  rowMoveTargets={rowMoveTargets}
                  rowMoveTargetId={rowMoveTargetId}
                  onVerdictChange={handleEventVerdictChange}
                  onMoveTargetChange={(value) =>
                    setMoveTargets((prev) => ({
                      ...prev,
                      [event.id]: value
                    }))
                  }
                  onMoveEvent={handleMoveEvent}
                  onDeleteEvent={handleDeleteEvent}
                  onRestoreEvent={handleRestoreEvent}
                  onPurgeEvent={handlePurgeEvent}
                />
              )
            })
          )}
        </div>
      </div>

      <Pagination
        current={eventPage}
        total={eventTotalPages}
        onChange={handlePageChange}
      />
    </section>
  )
}

interface ExportRow {
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

interface ExportRowParams {
  events: CompareEvent[]
  snapshot: OptionsSnapshot
}

interface EventRowProps {
  event: CompareEvent
  showCategoryOps: boolean
  isBusy: boolean
  currentVideo?: OptionsSnapshot["videos"][string]
  opponentVideo?: OptionsSnapshot["videos"][string]
  currentAuthorName?: string
  opponentAuthorName?: string
  showThumbnails: boolean
  isCurrentWinner: boolean
  isOpponentWinner: boolean
  timestamp: Date
  rowMoveTargets: { id: string; name: string }[]
  rowMoveTargetId: string
  onVerdictChange: (target: CompareEvent, verdict: Verdict) => void
  onMoveTargetChange: (value: string) => void
  onMoveEvent: (eventId: number, targetCategoryId: string) => void
  onDeleteEvent: (eventId: number) => void
  onRestoreEvent: (eventId: number) => void
  onPurgeEvent: (eventId: number) => void
}

const EventRow = ({
  event,
  showCategoryOps,
  isBusy,
  currentVideo,
  opponentVideo,
  currentAuthorName,
  opponentAuthorName,
  showThumbnails,
  isCurrentWinner,
  isOpponentWinner,
  timestamp,
  rowMoveTargets,
  rowMoveTargetId,
  onVerdictChange,
  onMoveTargetChange,
  onMoveEvent,
  onDeleteEvent,
  onRestoreEvent,
  onPurgeEvent
}: EventRowProps) => {
  return (
    <div
      className={`grid ${
        showCategoryOps
          ? "grid-cols-[40px_70px_1fr_1fr_90px_160px_90px]"
          : "grid-cols-[40px_70px_1fr_1fr_90px_90px]"
      } gap-2 items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200`}>
      <div className="font-medium flex flex-col gap-1 items-center">
        <span>#{event.id}</span>
        {event.disabled && (
          <span className="text-[10px] px-2 py-[1px] rounded-full bg-slate-100 text-slate-500 border border-slate-200 w-fit dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            無効
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {timestamp.toLocaleDateString()}
        <br />
        {timestamp.toLocaleTimeString()}
      </div>
      <div
        className={isCurrentWinner ? "border-l-4 border-l-slate-400 pl-2" : ""}>
        <EventVideoLabel
          videoId={event.currentVideoId}
          video={currentVideo}
          authorName={currentAuthorName}
          showThumbnail={showThumbnails}
        />
      </div>
      <div
        className={
          isOpponentWinner ? "border-l-4 border-l-slate-400 pl-2" : ""
        }>
        <EventVideoLabel
          videoId={event.opponentVideoId}
          video={opponentVideo}
          authorName={opponentAuthorName}
          showThumbnail={showThumbnails}
        />
      </div>
      <select
        value={event.verdict}
        disabled={event.disabled || isBusy}
        onChange={(e) => onVerdictChange(event, e.target.value as Verdict)}
        className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <option value="better">勝ち</option>
        <option value="same">引き分け</option>
        <option value="worse">負け</option>
      </select>
      {showCategoryOps && (
        <div className="flex items-center gap-2">
          {rowMoveTargets.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              移動先なし
            </span>
          ) : (
            <>
              <CategorySelect
                value={rowMoveTargetId}
                onChange={onMoveTargetChange}
                options={rowMoveTargets}
                size="sm"
                className="w-[15ch] max-w-[15ch]"
              />
              <button
                type="button"
                onClick={() => onMoveEvent(event.id, rowMoveTargetId)}
                disabled={!rowMoveTargetId || isBusy}
                className="px-2 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                移動
              </button>
            </>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {!event.disabled ? (
          <button
            type="button"
            onClick={() => onDeleteEvent(event.id)}
            disabled={isBusy}
            className="px-3 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
            無効化
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onRestoreEvent(event.id)}
              disabled={isBusy}
              className="px-3 py-1 rounded border border-slate-200 text-xs bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              有効化
            </button>
            <button
              type="button"
              onClick={() => onPurgeEvent(event.id)}
              disabled={isBusy}
              className="px-3 py-1 rounded border border-rose-200 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-200 dark:hover:bg-rose-950/40">
              削除
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface FilterEventsParams {
  events: CompareEvent[]
  includeDeleted: boolean
  verdict: string
  categoryId: string
  defaultCategoryId: string
  search: string
  videos: OptionsSnapshot["videos"]
  authors: OptionsSnapshot["authors"]
}

const filterEvents = ({
  events,
  includeDeleted,
  verdict,
  categoryId,
  defaultCategoryId,
  search,
  videos,
  authors
}: FilterEventsParams) => {
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = events.filter((event) => {
    if (!includeDeleted && event.disabled) {
      return false
    }
    if (verdict !== "all" && event.verdict !== verdict) {
      return false
    }
    const resolvedCategoryId = event.categoryId ?? defaultCategoryId
    if (resolvedCategoryId !== categoryId) {
      return false
    }
    if (normalizedSearch.length === 0) {
      return true
    }
    const idMatch = String(event.id).includes(normalizedSearch)
    const current = videos[event.currentVideoId]
    const opponent = videos[event.opponentVideoId]
    const currentAuthor = current ? authors[current.authorUrl]?.name : undefined
    const opponentAuthor = opponent
      ? authors[opponent.authorUrl]?.name
      : undefined
    const text =
      `${event.currentVideoId} ${event.opponentVideoId} ` +
      `${current?.title ?? ""} ${opponent?.title ?? ""} ` +
      `${currentAuthor ?? ""} ${opponentAuthor ?? ""}`
    return idMatch || text.toLowerCase().includes(normalizedSearch)
  })
  return filtered.sort((a, b) => b.id - a.id)
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
