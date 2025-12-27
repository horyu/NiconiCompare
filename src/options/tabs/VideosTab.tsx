import { useEffect, useMemo, useRef, useState } from "react"

import type { VideoSnapshot } from "../../lib/types"
import { ExportMenu } from "../components/ExportMenu"
import { Pagination } from "../components/Pagination"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { buildDelimitedText, downloadDelimitedFile } from "../utils/export"
import { readSessionState, writeSessionState } from "../utils/sessionStorage"

type VideosTabProps = {
  snapshot: OptionsSnapshot
}

type VideoSessionState = {
  search: string
  author: string
  sort: string
  order: "desc" | "asc"
  page: number
}

const VIDEO_PAGE_SIZE = 50
const SESSION_KEY = "nc_options_video_state"
const DEFAULT_VIDEO_SESSION_STATE: VideoSessionState = {
  search: "",
  author: "all",
  sort: "rating",
  order: "desc",
  page: 1
}

export const VideosTab = ({ snapshot }: VideosTabProps) => {
  const initialStateRef = useRef<VideoSessionState>()
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  if (!initialStateRef.current) {
    initialStateRef.current = readSessionState(
      SESSION_KEY,
      DEFAULT_VIDEO_SESSION_STATE
    )
  }
  const initialState = initialStateRef.current
  const [videoSearch, setVideoSearch] = useState(initialState.search)
  const [videoAuthor, setVideoAuthor] = useState(initialState.author)
  const [videoSort, setVideoSort] = useState(initialState.sort)
  const [videoSortOrder, setVideoSortOrder] = useState<"desc" | "asc">(
    initialState.order
  )
  const [videoPage, setVideoPage] = useState(initialState.page)
  const shouldResetPageRef = useRef(false)

  useEffect(() => {
    if (!shouldResetPageRef.current) {
      shouldResetPageRef.current = true
      return
    }
    setVideoPage(1)
  }, [videoSearch, videoAuthor, videoSort, videoSortOrder])

  useEffect(() => {
    writeSessionState(SESSION_KEY, {
      search: videoSearch,
      author: videoAuthor,
      sort: videoSort,
      order: videoSortOrder,
      page: videoPage
    })
  }, [videoSearch, videoAuthor, videoSort, videoSortOrder, videoPage])

  const authorOptions = useMemo(() => {
    return Object.values(snapshot.authors).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [snapshot.authors])

  const lastEventByVideo = useMemo(() => {
    const map = new Map<string, number>()
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
  }, [snapshot.events.items])

  const verdictCountsByVideo = useMemo(() => {
    const map = new Map<
      string,
      { wins: number; draws: number; losses: number }
    >()

    const ensure = (videoId: string) => {
      const current = map.get(videoId)
      if (current) {
        return current
      }
      const next = { wins: 0, draws: 0, losses: 0 }
      map.set(videoId, next)
      return next
    }

    for (const event of snapshot.events.items) {
      if (event.disabled) continue
      const currentStats = ensure(event.currentVideoId)
      const opponentStats = ensure(event.opponentVideoId)

      if (event.verdict === "better") {
        currentStats.wins += 1
        opponentStats.losses += 1
      } else if (event.verdict === "same") {
        currentStats.draws += 1
        opponentStats.draws += 1
      } else {
        currentStats.losses += 1
        opponentStats.wins += 1
      }
    }

    return map
  }, [snapshot.events.items])

  const filteredVideos = useMemo(() => {
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
    const compareByEvalCount = (left: VideoItem, right: VideoItem) => {
      const leftCounts = verdictCountsByVideo.get(left.videoId)
      const rightCounts = verdictCountsByVideo.get(right.videoId)
      const leftTotal = leftCounts
        ? leftCounts.wins + leftCounts.draws + leftCounts.losses
        : 0
      const rightTotal = rightCounts
        ? rightCounts.wins + rightCounts.draws + rightCounts.losses
        : 0
      return rightTotal - leftTotal
    }
    const compareByWins = (left: VideoItem, right: VideoItem) =>
      (verdictCountsByVideo.get(right.videoId)?.wins ?? 0) -
      (verdictCountsByVideo.get(left.videoId)?.wins ?? 0)
    const compareByLosses = (left: VideoItem, right: VideoItem) =>
      (verdictCountsByVideo.get(right.videoId)?.losses ?? 0) -
      (verdictCountsByVideo.get(left.videoId)?.losses ?? 0)

    const sorter =
      videoSort === "title"
        ? compareByTitle
        : videoSort === "rd"
          ? compareByRd
          : videoSort === "lastVerdict"
            ? compareByLastVerdict
            : videoSort === "evalCount"
              ? compareByEvalCount
              : videoSort === "wins"
                ? compareByWins
                : videoSort === "losses"
                  ? compareByLosses
                  : compareByRating

    const direction = videoSortOrder === "asc" ? -1 : 1
    return videos.sort((left, right) => direction * sorter(left, right))
  }, [
    snapshot,
    videoAuthor,
    videoSearch,
    videoSort,
    videoSortOrder,
    lastEventByVideo,
    verdictCountsByVideo
  ])

  const start = (videoPage - 1) * VIDEO_PAGE_SIZE
  const pagedVideos = filteredVideos.slice(start, start + VIDEO_PAGE_SIZE)

  const videoTotalPages = Math.max(
    1,
    Math.ceil(filteredVideos.length / VIDEO_PAGE_SIZE)
  )

  const hasMissingVideoData =
    snapshot.events.items.length > 0 &&
    Object.keys(snapshot.videos).length === 0
  const hasMissingAuthorData =
    snapshot.events.items.length > 0 &&
    Object.keys(snapshot.authors).length === 0
  const handleExport = (format: "csv" | "tsv", withBom: boolean) => {
    const exportRows = buildExportRows({
      videos: filteredVideos,
      snapshot,
      lastEventByVideo,
      verdictCountsByVideo
    })
    const delimiter = format === "csv" ? "," : "\t"
    const content = buildDelimitedText({
      header: [
        "動画ID",
        "サムネURL",
        "動画URL",
        "タイトル",
        "投稿者",
        "Rating",
        "RD",
        "評価数",
        "勝ち数",
        "引き分け数",
        "負け数",
        "最終判定日時"
      ],
      rows: exportRows.map((row) => [
        row.videoId,
        row.thumbnailUrl,
        row.videoUrl,
        row.title,
        row.author,
        row.rating,
        row.rd,
        row.total,
        row.wins,
        row.draws,
        row.losses,
        row.lastVerdictAt
      ]),
      delimiter
    })
    downloadDelimitedFile({
      content,
      format,
      withBom,
      filenamePrefix: "NiconiCompareVideos"
    })
    setExportMenuOpen(false)
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">評価済み動画一覧</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            {filteredVideos.length} 件
          </div>
          <ExportMenu
            open={exportMenuOpen}
            onToggle={() => setExportMenuOpen((prev) => !prev)}
            onExport={handleExport}
          />
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
            <option value="title">タイトル</option>
            <option value="rating">Rating</option>
            <option value="rd">RD</option>
            <option value="evalCount">評価数</option>
            <option value="wins">勝ち数</option>
            <option value="losses">敗け数</option>
            <option value="lastVerdict">最終判定日時</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1">
          並び順
          <button
            type="button"
            onClick={() =>
              setVideoSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
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
        <div className="grid grid-cols-[90px_1fr_130px_40px_30px_40px_50px_110px] gap-2 bg-slate-100 text-xs font-semibold px-3 py-2">
          <div>サムネ</div>
          <div>タイトル</div>
          <div>投稿者</div>
          <div>Rating</div>
          <div>RD</div>
          <div>評価数</div>
          <div>勝/分/敗</div>
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
              const verdictCounts = verdictCountsByVideo.get(video.videoId) ?? {
                wins: 0,
                draws: 0,
                losses: 0
              }
              const verdictTotal =
                verdictCounts.wins + verdictCounts.draws + verdictCounts.losses
              return (
                <div
                  key={video.videoId}
                  className="grid grid-cols-[90px_1fr_130px_40px_30px_40px_50px_110px] gap-2 items-center px-3 py-2">
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
                  <div className="text-sm">
                    {verdictTotal > 0 ? verdictTotal : "-"}
                  </div>
                  <div className="text-xs text-slate-600">
                    {verdictTotal > 0
                      ? `${verdictCounts.wins}/${verdictCounts.draws}/${verdictCounts.losses}`
                      : "-"}
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
  )
}

type ExportRow = {
  videoId: string
  thumbnailUrl: string
  videoUrl: string
  title: string
  author: string
  rating: string
  rd: string
  total: string
  wins: string
  draws: string
  losses: string
  lastVerdictAt: string
}

type ExportRowParams = {
  videos: VideoSnapshot[]
  snapshot: OptionsSnapshot
  lastEventByVideo: Map<string, number>
  verdictCountsByVideo: Map<
    string,
    { wins: number; draws: number; losses: number }
  >
}

const buildExportRows = ({
  videos,
  snapshot,
  lastEventByVideo,
  verdictCountsByVideo
}: ExportRowParams): ExportRow[] => {
  return videos.map((video) => {
    const rating = snapshot.ratings[video.videoId]
    const author = snapshot.authors[video.authorUrl]
    const counts = verdictCountsByVideo.get(video.videoId) ?? {
      wins: 0,
      draws: 0,
      losses: 0
    }
    const total = counts.wins + counts.draws + counts.losses
    const lastVerdict = lastEventByVideo.get(video.videoId)
    return {
      videoId: video.videoId,
      thumbnailUrl: video.thumbnailUrls?.[0] ?? "",
      videoUrl: `https://www.nicovideo.jp/watch/${video.videoId}`,
      title: video.title ?? "",
      author: author?.name ?? "",
      rating: rating ? String(Math.round(rating.rating)) : "",
      rd: rating ? String(Math.round(rating.rd)) : "",
      total: total ? String(total) : "0",
      wins: String(counts.wins),
      draws: String(counts.draws),
      losses: String(counts.losses),
      lastVerdictAt: lastVerdict ? new Date(lastVerdict).toLocaleString() : ""
    }
  })
}
