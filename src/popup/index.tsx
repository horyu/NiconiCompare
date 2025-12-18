import { useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../lib/constants"
import type {
  NcEventsBucket,
  NcRatings,
  NcSettings,
  NcState
} from "../lib/types"

type PopupSnapshot = {
  settings: NcSettings
  state: NcState
  events: NcEventsBucket
  ratings: NcRatings
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

  const lastEvents = [...snapshot.events.items]
    .filter((event) => !event.deleted)
    .slice(-5)
    .reverse()

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
                #{event.id} {event.leftVideoId} vs {event.rightVideoId} →{" "}
                {event.verdict}
              </li>
            ))}
          </ul>
        )}
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
