import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react"

import "../style.css"

import { MAX_RECENT_WINDOW_SIZE, MESSAGE_TYPES } from "../lib/constants"
import type {
  CompareEvent,
  NcAuthors,
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState,
  NcVideos,
  Verdict
} from "../lib/types"

type OptionsSnapshot = {
  settings: NcSettings
  state: NcState
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
  videos: NcVideos
  authors: NcAuthors
}

type TabKey = "videos" | "events" | "settings" | "data"

type Toast = {
  tone: "success" | "error"
  text: string
}

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: "videos", label: "動画一覧" },
  { key: "events", label: "イベント一覧" },
  { key: "settings", label: "設定" },
  { key: "data", label: "データ操作" }
]

const VIDEO_PAGE_SIZE = 50
const EVENT_PAGE_SIZE = 100

export default function OptionsPage() {
  const [snapshot, setSnapshot] = useState<OptionsSnapshot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [toast, setToast] = useState<Toast | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("videos")
  const showToast = useCallback((tone: Toast["tone"], text: string) => {
    setToast({ tone, text })
  }, [])

  const [settingsForm, setSettingsForm] = useState({
    recentWindowSize: "5",
    overlayAutoCloseMs: "2000",
    glickoRating: "1500",
    glickoRd: "350",
    glickoVolatility: "0.06"
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [rebuildingRatings, setRebuildingRatings] = useState(false)

  const [videoSearch, setVideoSearch] = useState("")
  const [videoAuthor, setVideoAuthor] = useState("all")
  const [videoSort, setVideoSort] = useState("rating")
  const [videoSortOrder, setVideoSortOrder] = useState<"desc" | "asc">("desc")
  const [videoPage, setVideoPage] = useState(1)

  const [eventSearch, setEventSearch] = useState("")
  const [eventVerdict, setEventVerdict] = useState("all")
  const [eventIncludeDeleted, setEventIncludeDeleted] = useState(false)
  const [eventPage, setEventPage] = useState(1)
  const [eventBusyId, setEventBusyId] = useState<number | null>(null)
  const [eventShowThumbnails, setEventShowThumbnails] = useState(true)

  const [deletingAll, setDeletingAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [bytesInUse, setBytesInUse] = useState<number | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)

  const refreshState = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(undefined)
    }
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.requestState
    })
    if (!response?.ok) {
      setError(response?.error ?? "状態取得に失敗しました。")
      setLoading(false)
      return
    }
    const next = response.data as OptionsSnapshot
    setSnapshot(next)
    setSettingsForm({
      recentWindowSize: String(next.settings.recentWindowSize),
      overlayAutoCloseMs: String(next.settings.overlayAutoCloseMs),
      glickoRating: String(next.settings.glicko.rating),
      glickoRd: String(next.settings.glicko.rd),
      glickoVolatility: String(next.settings.glicko.volatility)
    })
    setEventShowThumbnails(next.settings.showEventThumbnails)

    // ストレージ使用量を取得
    try {
      const bytes = await chrome.storage.local.getBytesInUse()
      setBytesInUse(bytes)
    } catch (error) {
      console.error("Failed to get bytes in use:", error)
      setBytesInUse(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  useEffect(() => {
    const handler = () => {
      refreshState(true)
    }
    chrome.storage?.onChanged?.addListener(handler)
    return () => {
      chrome.storage?.onChanged?.removeListener(handler)
    }
  }, [refreshState])

  useEffect(() => {
    setVideoPage(1)
  }, [videoSearch, videoAuthor, videoSort, videoSortOrder])

  useEffect(() => {
    setEventPage(1)
  }, [eventSearch, eventVerdict, eventIncludeDeleted])
  useEffect(() => {
    setToast(null)
  }, [activeTab])

  useEffect(() => {
    const plasmoRoot = document.getElementById("__plasmo")
    const prev = {
      plasmoOverflowY: plasmoRoot?.style.overflowY,
      plasmoScrollbarGutter: plasmoRoot?.style.scrollbarGutter,
      plasmoHeight: plasmoRoot?.style.height
    }
    if (plasmoRoot) {
      plasmoRoot.style.overflowY = "scroll"
      plasmoRoot.style.scrollbarGutter = "stable"
      plasmoRoot.style.height = "100vh"
    }
    return () => {
      if (plasmoRoot) {
        plasmoRoot.style.overflowY = prev.plasmoOverflowY ?? ""
        plasmoRoot.style.scrollbarGutter = prev.plasmoScrollbarGutter ?? ""
        plasmoRoot.style.height = prev.plasmoHeight ?? ""
      }
    }
  }, [])

  const authorOptions = useMemo(() => {
    if (!snapshot) return []
    return Object.values(snapshot.authors).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [snapshot])

  const lastEventByVideo = useMemo(() => {
    const map = new Map<string, number>()
    if (!snapshot) return map
    for (const event of snapshot.events.items) {
      if (event.disabled) continue
      map.set(
        event.currentVideoId,
        Math.max(map.get(event.currentVideoId) ?? 0, event.timestamp)
      )
      map.set(
        event.opponentVideoId,
        Math.max(map.get(event.opponentVideoId) ?? 0, event.timestamp)
      )
    }
    return map
  }, [snapshot])

  const filteredVideos = useMemo(() => {
    if (!snapshot) return []
    const normalizedSearch = videoSearch.trim().toLowerCase()

    const videos = Object.values(snapshot.videos).filter((video) => {
      const hasRating = Boolean(snapshot.ratings[video.videoId])
      const matchesSearch =
        normalizedSearch.length === 0 ||
        video.videoId.toLowerCase().includes(normalizedSearch) ||
        video.title.toLowerCase().includes(normalizedSearch)
      const matchesAuthor =
        videoAuthor === "all" ||
        snapshot.authors[video.authorUrl]?.name === videoAuthor
      return hasRating && matchesSearch && matchesAuthor
    })

    type VideoItem = (typeof videos)[number]
    const compareByRating = (left: VideoItem, right: VideoItem) =>
      (snapshot.ratings[right.videoId]?.rating ?? 0) -
      (snapshot.ratings[left.videoId]?.rating ?? 0)
    const compareByTitle = (left: VideoItem, right: VideoItem) =>
      left.title.localeCompare(right.title)
    const compareByRd = (left: VideoItem, right: VideoItem) =>
      (snapshot.ratings[right.videoId]?.rd ?? 0) -
      (snapshot.ratings[left.videoId]?.rd ?? 0)
    const compareByLastVerdict = (left: VideoItem, right: VideoItem) =>
      (lastEventByVideo.get(right.videoId) ?? 0) -
      (lastEventByVideo.get(left.videoId) ?? 0)

    const sorter =
      videoSort === "title"
        ? compareByTitle
        : videoSort === "rd"
          ? compareByRd
          : videoSort === "lastVerdict"
            ? compareByLastVerdict
            : compareByRating

    const direction = videoSortOrder === "asc" ? -1 : 1
    return videos.sort((left, right) => direction * sorter(left, right))
  }, [
    snapshot,
    videoAuthor,
    videoSearch,
    videoSort,
    videoSortOrder,
    lastEventByVideo
  ])

  const pagedVideos = useMemo(() => {
    const start = (videoPage - 1) * VIDEO_PAGE_SIZE
    return filteredVideos.slice(start, start + VIDEO_PAGE_SIZE)
  }, [filteredVideos, videoPage])

  const filteredEvents = useMemo(() => {
    if (!snapshot) return []
    const normalizedSearch = eventSearch.trim().toLowerCase()
    const events = snapshot.events.items.filter((event) => {
      if (!eventIncludeDeleted && event.disabled) {
        return false
      }
      if (eventVerdict !== "all" && event.verdict !== eventVerdict) {
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
  }, [snapshot, eventIncludeDeleted, eventSearch, eventVerdict])

  const pagedEvents = useMemo(() => {
    const start = (eventPage - 1) * EVENT_PAGE_SIZE
    return filteredEvents.slice(start, start + EVENT_PAGE_SIZE)
  }, [eventPage, filteredEvents])

  const videoTotalPages = Math.max(
    1,
    Math.ceil(filteredVideos.length / VIDEO_PAGE_SIZE)
  )
  const eventTotalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE)
  )

  const handleSettingsChange =
    (field: keyof typeof settingsForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setSettingsForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleSettingsSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSavingSettings(true)
    try {
      const payload: Partial<NcSettings> = {
        recentWindowSize: Number(settingsForm.recentWindowSize),
        overlayAutoCloseMs: Number(settingsForm.overlayAutoCloseMs),
        glicko: {
          rating: Number(settingsForm.glickoRating),
          rd: Number(settingsForm.glickoRd),
          volatility: Number(settingsForm.glickoVolatility)
        }
      }
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.updateSettings,
        payload
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "update failed")
      }
      await refreshState(true)
      showToast("success", "設定を更新しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "設定の更新に失敗しました。")
      if (snapshot) {
        setSettingsForm({
          recentWindowSize: String(snapshot.settings.recentWindowSize),
          overlayAutoCloseMs: String(snapshot.settings.overlayAutoCloseMs),
          glickoRating: String(snapshot.settings.glicko.rating),
          glickoRd: String(snapshot.settings.glicko.rd),
          glickoVolatility: String(snapshot.settings.glicko.volatility)
        })
      }
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRebuildRatings = async () => {
    setRebuildingRatings(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.rebuildRatings
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "rebuild failed")
      }
      await refreshState(true)
      showToast("success", "レーティングを再計算しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "再計算に失敗しました。")
    } finally {
      setRebuildingRatings(false)
    }
  }

  const handleToggleEventThumbnails = async (checked: boolean) => {
    setEventShowThumbnails(checked)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.updateSettings,
        payload: { showEventThumbnails: checked }
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "update failed")
      }
      await refreshState(true)
    } catch (error) {
      console.error(error)
      showToast("error", "設定の更新に失敗しました。")
      setEventShowThumbnails(snapshot?.settings.showEventThumbnails ?? true)
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
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.recordEvent,
        payload: {
          currentVideoId: target.currentVideoId,
          opponentVideoId: target.opponentVideoId,
          verdict,
          eventId: target.id
        }
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "update failed")
      }
      await refreshState(true)
      showToast("success", "イベントを更新しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "イベント更新に失敗しました。")
    } finally {
      setEventBusyId(null)
    }
  }

  const handleDeleteEvent = async (eventId: number) => {
    setEventBusyId(eventId)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.deleteEvent,
        payload: { eventId }
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "delete failed")
      }
      await refreshState(true)
      showToast("success", "イベントを無効化しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "イベントの無効化に失敗しました。")
    } finally {
      setEventBusyId(null)
    }
  }

  const handleRestoreEvent = async (eventId: number) => {
    setEventBusyId(eventId)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.restoreEvent,
        payload: { eventId }
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "restore failed")
      }
      await refreshState(true)
      showToast("success", "イベントを有効化しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "イベントの有効化に失敗しました。")
    } finally {
      setEventBusyId(null)
    }
  }

  const handlePurgeEvent = async (eventId: number) => {
    const confirmed = confirm(
      "無効化済みイベントを削除します。元に戻せません。続行しますか？"
    )
    if (!confirmed) return
    setEventBusyId(eventId)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.purgeEvent,
        payload: { eventId }
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "purge failed")
      }
      await refreshState(true)
      showToast("success", "イベントを削除しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "削除に失敗しました。")
    } finally {
      setEventBusyId(null)
    }
  }

  const handleAckCleanup = async () => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "ackCleanup" }
    })
    await refreshState(true)
  }

  const handleClearRetry = async (clearFailed = false) => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "clearRetry", clearFailed }
    })
    await refreshState(true)
  }

  const handleCleanup = async () => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "cleanup" }
    })
    await refreshState(true)
  }

  const handleDeleteAllData = async () => {
    const confirmed = confirm(
      "全データを削除します。設定・履歴・レーティングも初期化されます。続行しますか？"
    )
    if (!confirmed) {
      return
    }
    setDeletingAll(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.deleteAllData
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "delete all failed")
      }
      await refreshState(true)
      showToast("success", "全データを削除しました。")
    } catch (error) {
      console.error(error)
      showToast("error", "全データの削除に失敗しました。")
    } finally {
      setDeletingAll(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.exportData
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "export failed")
      }
      const data = JSON.stringify(response.data, null, 2)
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "niconi-compare-data.json"
      anchor.click()
      URL.revokeObjectURL(url)
      showToast("success", "エクスポートしました。")
    } catch (error) {
      console.error(error)
      showToast("error", "エクスポートに失敗しました。")
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    const file = importFileRef.current?.files?.[0]
    if (!file) {
      showToast("error", "インポートするJSONを選択してください。")
      return
    }
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.importData,
        payload: { data }
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "import failed")
      }
      if (importFileRef.current) {
        importFileRef.current.value = ""
      }
      await refreshState(true)
      showToast("success", "インポートしました。")
    } catch (error) {
      console.error(error)
      showToast("error", "インポートに失敗しました。")
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8 font-sans">
        <p>読込中...</p>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main className="min-h-screen p-8 font-sans">
        <p>状態を取得できませんでした。</p>
        {error && <small className="text-red-500">{error}</small>}
      </main>
    )
  }

  const hasMissingVideoData =
    snapshot.events.items.length > 0 &&
    Object.keys(snapshot.videos).length === 0
  const hasMissingAuthorData =
    snapshot.events.items.length > 0 &&
    Object.keys(snapshot.authors).length === 0

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6 font-sans">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">NiconiCompare Options</h1>
            <p className="text-sm text-slate-500">
              設定・履歴・データ操作をまとめて管理します。
            </p>
          </div>
          <nav className="flex items-center gap-2">
            {TAB_LABELS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "px-4 py-2 rounded-md text-sm font-medium border",
                  activeTab === tab.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                ].join(" ")}>
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {toast && (
          <div className="fixed top-16 right-10 z-50">
            <div
              className={[
                "flex items-center gap-3 rounded-md px-4 py-2 text-sm",
                toast.tone === "success"
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-rose-100 text-rose-900"
              ].join(" ")}>
              {toast.text}
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="トーストを閉じる"
                className="text-base leading-none opacity-70 hover:opacity-100">
                ×
              </button>
            </div>
          </div>
        )}

        {activeTab === "videos" && (
          <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">評価済み動画一覧</h2>
              <div className="text-sm text-slate-500">
                {filteredVideos.length} 件
              </div>
            </header>

            {(hasMissingVideoData || hasMissingAuthorData) && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {hasMissingVideoData && "nc_videos のデータ未取得"}
                {hasMissingVideoData && hasMissingAuthorData && " / "}
                {hasMissingAuthorData && "nc_authors のデータ未取得"}
              </div>
            )}

            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3">
              <label className="text-sm flex flex-col gap-1">
                検索
                <input
                  value={videoSearch}
                  onChange={(event) => setVideoSearch(event.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1"
                  placeholder="タイトル・IDで検索"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                投稿者
                <div className="relative">
                  <input
                    list="nc-author-list"
                    value={videoAuthor === "all" ? "" : videoAuthor}
                    onChange={(event) => {
                      const next = event.target.value.trim()
                      setVideoAuthor(next.length === 0 ? "all" : next)
                    }}
                    className="border border-slate-200 rounded-md px-2 py-1 w-full"
                    placeholder="全て / 投稿者を入力"
                  />
                  {videoAuthor !== "all" && (
                    <button
                      type="button"
                      onClick={() => setVideoAuthor("all")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 bg-white px-1 text-base leading-none z-10"
                      aria-label="投稿者フィルタをクリア">
                      ×
                    </button>
                  )}
                </div>
                <datalist id="nc-author-list">
                  {authorOptions.map((author) => (
                    <option key={author.authorUrl} value={author.name} />
                  ))}
                </datalist>
              </label>
              <label className="text-sm flex flex-col gap-1">
                ソート
                <select
                  value={videoSort}
                  onChange={(event) => setVideoSort(event.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1">
                  <option value="rating">Rating</option>
                  <option value="rd">RD</option>
                  <option value="title">タイトル</option>
                  <option value="lastVerdict">最終判定日時</option>
                </select>
              </label>
              <label className="text-sm flex flex-col gap-1">
                並び順
                <button
                  type="button"
                  onClick={() =>
                    setVideoSortOrder((prev) =>
                      prev === "asc" ? "desc" : "asc"
                    )
                  }
                  className="border border-slate-200 rounded-md px-2 py-1 text-left hover:bg-slate-100">
                  {videoSortOrder === "asc" ? "昇順" : "降順"}
                </button>
              </label>
            </div>

            <Pagination
              current={videoPage}
              total={videoTotalPages}
              onChange={setVideoPage}
            />

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[90px_1fr_140px_40px_30px_120px] gap-2 bg-slate-100 text-xs font-semibold px-3 py-2">
                <div>サムネ</div>
                <div>タイトル</div>
                <div>投稿者</div>
                <div>Rating</div>
                <div>RD</div>
                <div>最終判定日時</div>
              </div>
              <div className="divide-y divide-slate-100">
                {pagedVideos.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">
                    表示できる動画がありません。
                  </div>
                ) : (
                  pagedVideos.map((video) => {
                    const rating = snapshot.ratings[video.videoId]
                    const author = snapshot.authors[video.authorUrl]
                    return (
                      <div
                        key={video.videoId}
                        className="grid grid-cols-[90px_1fr_140px_40px_30px_120px] gap-2 items-center px-3 py-2">
                        <a
                          href={`https://www.nicovideo.jp/watch/${video.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-20 h-12 bg-slate-200 rounded overflow-hidden block">
                          {video.thumbnailUrls?.[0] ? (
                            <img
                              src={video.thumbnailUrls[0]}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </a>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">
                            {video.title || "データ未取得"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {video.videoId}
                          </span>
                        </div>
                        <div className="text-sm text-slate-700">
                          {author?.name ?? "不明"}
                        </div>
                        <div className="text-sm">
                          {rating ? Math.round(rating.rating) : "-"}
                        </div>
                        <div className="text-sm">
                          {rating ? Math.round(rating.rd) : "-"}
                        </div>
                        <div className="text-xs text-slate-600">
                          {lastEventByVideo.get(video.videoId)
                            ? new Date(
                                lastEventByVideo.get(video.videoId) ?? 0
                              ).toLocaleString()
                            : "-"}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <Pagination
              current={videoPage}
              total={videoTotalPages}
              onChange={setVideoPage}
            />
          </section>
        )}

        {activeTab === "events" && (
          <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">評価イベント一覧</h2>
              <div className="text-sm text-slate-500">
                {filteredEvents.length} 件
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
                  <option value="better">基準が良い</option>
                  <option value="same">引き分け</option>
                  <option value="worse">比較対象が良い</option>
                </select>
              </label>
              <label className="text-sm flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={eventIncludeDeleted}
                  onChange={(event) =>
                    setEventIncludeDeleted(event.target.checked)
                  }
                />
                無効化済みも表示
              </label>
              <label className="text-sm flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={eventShowThumbnails}
                  onChange={(event) =>
                    handleToggleEventThumbnails(event.target.checked)
                  }
                />
                サムネ表示
              </label>
            </div>

            <Pagination
              current={eventPage}
              total={eventTotalPages}
              onChange={setEventPage}
            />

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[40px_70px_1fr_1fr_130px_90px] gap-2 bg-slate-100 text-xs font-semibold px-3 py-2">
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
                    表示できるイベントがありません。
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
                        className="grid grid-cols-[40px_70px_1fr_1fr_130px_90px] gap-2 items-center px-3 py-2 text-sm">
                        <div className="font-medium">#{event.id}</div>
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
                                ? snapshot.authors[opponentVideo.authorUrl]
                                    ?.name
                                : undefined
                            }
                            showThumbnail={eventShowThumbnails}
                          />
                        </div>
                        <select
                          value={event.verdict}
                          disabled={event.disabled || isBusy}
                          onChange={(e) =>
                            handleEventVerdictChange(
                              event,
                              e.target.value as Verdict
                            )
                          }
                          className="border border-slate-200 rounded-md px-2 py-1 text-sm">
                          <option value="better">基準が良い</option>
                          <option value="same">引き分け</option>
                          <option value="worse">比較対象が良い</option>
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
                          {event.disabled && (
                            <span className="text-[10px] text-rose-500">
                              無効化済み
                            </span>
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
        )}

        {activeTab === "settings" && (
          <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-6">
            <header>
              <h2 className="text-lg font-semibold">
                オーバーレイ / Glicko 設定
              </h2>
            </header>
            <form
              className="grid grid-cols-2 gap-4"
              onSubmit={handleSettingsSubmit}>
              <label className="text-sm flex flex-col gap-1">
                比較候補数 (1-{MAX_RECENT_WINDOW_SIZE})
                <input
                  type="number"
                  min={1}
                  max={MAX_RECENT_WINDOW_SIZE}
                  value={settingsForm.recentWindowSize}
                  onChange={handleSettingsChange("recentWindowSize")}
                  className="border border-slate-200 rounded-md px-2 py-1"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                オーバーレイ自動閉鎖 (ms)
                <input
                  type="number"
                  min={0}
                  value={settingsForm.overlayAutoCloseMs}
                  onChange={handleSettingsChange("overlayAutoCloseMs")}
                  className="border border-slate-200 rounded-md px-2 py-1"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                初期 rating
                <input
                  type="number"
                  value={settingsForm.glickoRating}
                  onChange={handleSettingsChange("glickoRating")}
                  className="border border-slate-200 rounded-md px-2 py-1"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                初期 RD
                <input
                  type="number"
                  value={settingsForm.glickoRd}
                  onChange={handleSettingsChange("glickoRd")}
                  className="border border-slate-200 rounded-md px-2 py-1"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                初期 volatility
                <input
                  type="number"
                  step="0.01"
                  value={settingsForm.glickoVolatility}
                  onChange={handleSettingsChange("glickoVolatility")}
                  className="border border-slate-200 rounded-md px-2 py-1"
                />
              </label>
              <div className="col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm disabled:opacity-50">
                  {savingSettings ? "保存中..." : "保存"}
                </button>
                <button
                  type="button"
                  onClick={handleRebuildRatings}
                  disabled={rebuildingRatings}
                  className="px-4 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100 disabled:opacity-50">
                  {rebuildingRatings ? "再計算中..." : "レーティング再計算"}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "data" && (
          <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-6">
            <header>
              <h2 className="text-lg font-semibold">データ操作</h2>
            </header>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  エクスポート/インポート
                </h3>
                {bytesInUse !== null && (
                  <div className="text-sm text-slate-600">
                    ストレージ使用量: {(bytesInUse / 1024).toFixed(2)} KB
                    {" / "}
                    {(chrome.storage.local.QUOTA_BYTES / 1024 / 1024).toFixed(
                      0
                    )}{" "}
                    MB
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100 disabled:opacity-50">
                  {exporting ? "書き出し中..." : "JSON エクスポート"}
                </button>
                <div className="flex flex-col gap-2">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept="application/json"
                    className="text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importing}
                    className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100 disabled:opacity-50">
                    {importing ? "読み込み中..." : "JSON インポート"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">クリーンアップ</h3>
                <div className="text-sm text-slate-600">
                  needsCleanup: {snapshot.meta.needsCleanup ? "要対応" : "OK"}
                </div>
                {snapshot.meta.needsCleanup && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100"
                    onClick={handleAckCleanup}>
                    クリーンアップ完了にする
                  </button>
                )}
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100"
                  onClick={handleCleanup}>
                  イベントから辿れない情報を削除
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">再試行キュー</h3>
                <div className="text-sm text-slate-600">
                  retryQueue: {snapshot.meta.retryQueue.length} 件
                </div>
                {snapshot.meta.retryQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleClearRetry()}
                    className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100">
                    再試行キューをクリア
                  </button>
                )}
                <div className="text-sm text-slate-600">
                  failedWrites: {snapshot.meta.failedWrites.length} 件
                </div>
                {snapshot.meta.failedWrites.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleClearRetry(true)}
                    className="px-3 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100">
                    failedWrites もクリア
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-rose-700">
                  全データ削除
                </h3>
                <p className="text-sm text-slate-600">
                  設定・履歴・レーティングを初期化します。
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAllData}
                  disabled={deletingAll}
                  className="px-3 py-2 rounded-md border border-rose-200 text-rose-700 text-sm hover:bg-rose-50 disabled:opacity-50">
                  {deletingAll ? "削除中..." : "全データ削除"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function EventVideoLabel({
  videoId,
  video,
  authorName,
  showThumbnail
}: {
  videoId: string
  video: NcVideos[string] | undefined
  authorName?: string
  showThumbnail: boolean
}) {
  const thumbnailUrl = video?.thumbnailUrls?.[0]
  if (!video) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700">
        {showThumbnail && <div className="w-10 h-7 rounded bg-amber-100" />}
        <div className="flex flex-col">
          <span>{videoId}</span>
          <span className="text-[10px] text-amber-600">データ未取得</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {showThumbnail && (
        <div className="w-10 h-7 rounded bg-slate-200 overflow-hidden shrink-0">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <div className="text-sm font-medium break-words">{video.title}</div>
        <div className="text-[11px] text-slate-500 break-words">
          {videoId}
          {authorName ? ` | ${authorName}` : ""}
        </div>
      </div>
    </div>
  )
}

function Pagination({
  current,
  total,
  onChange
}: {
  current: number
  total: number
  onChange: (next: number) => void
}) {
  const canGoPrev = current > 1
  const canGoNext = current < total
  const pageOptions = Array.from({ length: total }, (_, index) => index + 1)
  return (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={!canGoPrev}
        onClick={() => onChange(current - 1)}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">
        前へ
      </button>
      <div className="flex items-center gap-2 text-slate-500">
        <select
          value={current}
          onChange={(event) => onChange(Number(event.target.value))}
          className="border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700">
          {pageOptions.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
        <span>/ {total}</span>
      </div>
      <button
        type="button"
        disabled={!canGoNext}
        onClick={() => onChange(current + 1)}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">
        次へ
      </button>
    </div>
  )
}
