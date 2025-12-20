import { useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../lib/constants"
import type {
  NcEventsBucket,
  NcMeta,
  NcRatings,
  NcSettings,
  NcState
} from "../lib/types"

type PopupSnapshot = {
  settings: NcSettings
  state: NcState
  events: NcEventsBucket
  ratings: NcRatings
  meta: NcMeta
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
      <main style={containerStyle}>
        <p>読込中...</p>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main style={containerStyle}>
        <p>状態を取得できませんでした。</p>
        {error && <small style={{ color: "#ff8080" }}>{error}</small>}
      </main>
    )
  }

  const lastEvents = buildRecentEvents(snapshot.events)
  const unresolvedRatings = findUnresolvedRatings(snapshot.ratings)
  const meta = snapshot.meta

  return (
    <main style={containerStyle}>
      <header style={headerStyle}>
        <strong>NiconiCompare</strong>
        <label style={toggleLabelStyle}>
          <input
            type="checkbox"
            checked={snapshot.settings.overlayEnabled}
            onChange={(e) => toggleOverlay(e.target.checked)}
          />
          オーバーレイ
        </label>
      </header>

      <section>
        <h3 style={sectionTitleStyle}>比較候補</h3>
        {snapshot.state.recentWindow.length === 0 ? (
          <p style={mutedStyle}>まだ比較イベントがありません。</p>
        ) : (
          <ul style={listStyle}>
            {snapshot.state.recentWindow.map((videoId) => (
              <li key={videoId}>{videoId}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 style={sectionTitleStyle}>直近イベント</h3>
        {lastEvents.length === 0 ? (
          <p style={mutedStyle}>イベントなし</p>
        ) : (
          <ul style={listStyle}>
            {lastEvents.map((event) => (
              <li key={event.id}>
                <strong>#{event.id}</strong> {event.currentVideoId} vs{" "}
                {event.opponentVideoId}{" "}
                <span style={verdictStyle(event.verdict)}>
                  {labelVerdict(event.verdict)}
                </span>
                <small style={timestampStyle}>
                  {new Date(event.timestamp).toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 style={sectionTitleStyle}>未確定動画 (RD &gt; 100)</h3>
        {unresolvedRatings.length === 0 ? (
          <p style={mutedStyle}>未確定なし</p>
        ) : (
          <ul style={listStyle}>
            {unresolvedRatings.map((rating) => (
              <li key={rating.videoId}>
                {rating.videoId} — Rating {rating.rating.toFixed(0)} / RD{" "}
                {rating.rd.toFixed(0)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 style={sectionTitleStyle}>Storage 状態</h3>
        <ul style={listStyle}>
          <li>
            needsCleanup:{" "}
            {meta.needsCleanup ? (
              <span style={{ color: "#dc2626" }}>要対応</span>
            ) : (
              "OK"
            )}
          </li>
          <li>retryQueue: {meta.retryQueue.length} 件</li>
          <li>failedWrites: {meta.failedWrites.length} 件</li>
        </ul>
      </section>

      {error && <small style={{ color: "#ff8080" }}>{error}</small>}
    </main>
  )
}

const containerStyle: React.CSSProperties = {
  width: 320,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  fontFamily: "system-ui, sans-serif"
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  margin: "0 0 8px"
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 13
}

const mutedStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7
}

const toggleLabelStyle: React.CSSProperties = {
  fontSize: 12,
  display: "flex",
  gap: 8,
  alignItems: "center"
}

const timestampStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  opacity: 0.6
}

function buildRecentEvents(events: NcEventsBucket) {
  return [...events.items]
    .filter((event) => !event.deleted)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)
}

function findUnresolvedRatings(ratings: NcRatings) {
  return Object.values(ratings)
    .filter((rating) => rating.rd > 100)
    .sort((a, b) => b.rd - a.rd)
    .slice(0, 5)
}

function labelVerdict(verdict: string) {
  switch (verdict) {
    case "better":
      return "良い"
    case "same":
      return "同じ"
    case "worse":
      return "悪い"
    default:
      return verdict
  }
}

function verdictStyle(verdict: string): React.CSSProperties {
  const colors: Record<string, string> = {
    better: "#16a34a",
    same: "#52525b",
    worse: "#dc2626"
  }
  return {
    display: "inline-block",
    marginLeft: 4,
    padding: "2px 6px",
    borderRadius: 999,
    fontSize: 11,
    background: colors[verdict] ?? "#64748b",
    color: "#fff"
  }
}
