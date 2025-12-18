import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"

import { MESSAGE_TYPES } from "../lib/constants"
import type { NcMeta, NcSettings } from "../lib/types"

export default function OptionsPage() {
  const [settings, setSettings] = useState<NcSettings>()
  const [meta, setMeta] = useState<NcMeta>()
  const [form, setForm] = useState({
    recentWindowSize: "5"
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    refreshState()
  }, [])

  const refreshState = async () => {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.requestState
    })
    if (response?.ok) {
      const next = response.data.settings as NcSettings
      setSettings(next)
      setForm({
        recentWindowSize: String(next.recentWindowSize)
      })
      setMeta(response.data.meta as NcMeta)
    }
  }

  const handleInputChange =
    (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(undefined)
    try {
      const payload = {
        recentWindowSize: Number(form.recentWindowSize)
      }
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.updateSettings,
        payload
      })
      if (!response?.ok) {
        throw new Error(response?.error ?? "update failed")
      }
      await refreshState()
      setMessage("設定を更新しました。")
    } catch (error) {
      console.error(error)
      setMessage("設定の更新に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  const handleAckCleanup = async () => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "ackCleanup" }
    })
    await refreshState()
  }

  const handleClearRetry = async (clearFailed = false) => {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.metaAction,
      payload: { action: "clearRetry", clearFailed }
    })
    await refreshState()
  }

  return (
    <main style={containerStyle}>
      <h1>NiconiCompare Options</h1>
      <section>
        <h2>オーバーレイ設定</h2>
        {settings ? (
          <form style={formStyle} onSubmit={handleSubmit}>
            <label style={labelStyle}>
              比較候補数 (1-10)
              <input
                type="number"
                min={1}
                max={10}
                value={form.recentWindowSize}
                onChange={handleInputChange("recentWindowSize")}
                style={inputStyle}
              />
            </label>
            <button type="submit" disabled={saving} style={buttonStyle}>
              {saving ? "保存中..." : "保存"}
            </button>
          </form>
        ) : (
          <p>読込中...</p>
        )}
        {message && <p style={messageStyle}>{message}</p>}
      </section>

      <section>
        <h2>Storage メタデータ</h2>
        {meta ? (
          <div style={metaGridStyle}>
            <div>
              <div style={metaLabelStyle}>needsCleanup</div>
              <div>{meta.needsCleanup ? "要クリーンアップ" : "OK"}</div>
              {meta.needsCleanup && (
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={handleAckCleanup}>
                  クリーンアップ完了にする
                </button>
              )}
            </div>
            <div>
              <div style={metaLabelStyle}>retryQueue</div>
              <div>{meta.retryQueue.length} 件</div>
              {meta.retryQueue.length > 0 && (
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => handleClearRetry()}>
                  再試行キューをクリア
                </button>
              )}
            </div>
            <div>
              <div style={metaLabelStyle}>failedWrites</div>
              <div>{meta.failedWrites.length} 件</div>
              {meta.failedWrites.length > 0 && (
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => handleClearRetry(true)}>
                  failedWritesもクリア
                </button>
              )}
            </div>
          </div>
        ) : (
          <p>読込中...</p>
        )}
      </section>
    </main>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 32,
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: 24
}

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  maxWidth: 320
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 14
}

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid #ccc"
}

const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600
}

const messageStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#2563eb"
}

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16
}

const metaLabelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 4
}

const secondaryButtonStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "6px 10px",
  borderRadius: 4,
  border: "1px solid #94a3b8",
  background: "transparent",
  cursor: "pointer"
}
