import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"

import { MESSAGE_TYPES } from "../lib/constants"
import type { NcSettings } from "../lib/types"

export default function OptionsPage() {
  const [settings, setSettings] = useState<NcSettings>()
  const [form, setForm] = useState({
    recentWindowSize: "5",
    overlayAutoCloseSeconds: "1.5"
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
        recentWindowSize: String(next.recentWindowSize),
        overlayAutoCloseSeconds: String(next.overlayAutoCloseMs / 1000)
      })
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
        recentWindowSize: Number(form.recentWindowSize),
        overlayAutoCloseMs: Number(form.overlayAutoCloseSeconds) * 1000
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
            <label style={labelStyle}>
              自動閉鎖 (秒)
              <input
                type="number"
                min={0.5}
                max={5}
                step={0.5}
                value={form.overlayAutoCloseSeconds}
                onChange={handleInputChange("overlayAutoCloseSeconds")}
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
