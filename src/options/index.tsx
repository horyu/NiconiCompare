import { useCallback, useEffect, useState } from "react"

import "../style.css"

import { MESSAGE_TYPES } from "../lib/constants"
import { handleUIError, NcError } from "../lib/error-handler"
import { sendNcMessage } from "../lib/messages"
import { useOptionsData } from "./hooks/useOptionsData"
import { CategoriesTab } from "./tabs/CategoriesTab"
import { DataTab } from "./tabs/DataTab"
import { EventsTab } from "./tabs/EventsTab"
import { SettingsTab } from "./tabs/SettingsTab"
import { VideosTab } from "./tabs/VideosTab"

type TabKey = "videos" | "events" | "categories" | "settings" | "data"

type Toast = {
  tone: "success" | "error"
  text: string
}

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: "videos", label: "動画一覧" },
  { key: "events", label: "評価一覧" },
  { key: "categories", label: "カテゴリ" },
  { key: "settings", label: "設定" },
  { key: "data", label: "データ操作" }
]

export default function OptionsPage() {
  const { snapshot, loading, error, bytesInUse, refreshState } =
    useOptionsData()
  const [toast, setToast] = useState<Toast | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("videos")
  const showToast = useCallback((tone: Toast["tone"], text: string) => {
    setToast({ tone, text })
  }, [])

  const [eventShowThumbnails, setEventShowThumbnails] = useState(true)

  useEffect(() => {
    if (!snapshot) {
      return
    }
    setEventShowThumbnails(snapshot.settings.showEventThumbnails)
  }, [snapshot])
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

  const handleToggleEventThumbnails = async (checked: boolean) => {
    setEventShowThumbnails(checked)
    try {
      const response = await sendNcMessage({
        type: MESSAGE_TYPES.updateSettings,
        payload: { showEventThumbnails: checked }
      })
      if (!response.ok) {
        throw new NcError(
          response.error ?? "update failed",
          "options:toggle-event-thumbnails",
          "設定の更新に失敗しました。"
        )
      }
      await refreshState(true)
    } catch (error) {
      handleUIError(error, "options:toggle-event-thumbnails", showToast)
      setEventShowThumbnails(snapshot?.settings.showEventThumbnails ?? true)
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
          <VideosTab
            snapshot={snapshot}
            refreshState={refreshState}
            showToast={showToast}
          />
        )}

        {activeTab === "events" && (
          <EventsTab
            snapshot={snapshot}
            eventShowThumbnails={eventShowThumbnails}
            onToggleEventThumbnails={handleToggleEventThumbnails}
            refreshState={refreshState}
            showToast={showToast}
          />
        )}

        {activeTab === "categories" && (
          <CategoriesTab
            snapshot={snapshot}
            refreshState={refreshState}
            showToast={showToast}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            snapshot={snapshot}
            refreshState={refreshState}
            showToast={showToast}
          />
        )}

        {activeTab === "data" && (
          <DataTab
            snapshot={snapshot}
            bytesInUse={bytesInUse}
            refreshState={refreshState}
            showToast={showToast}
          />
        )}
      </div>
    </main>
  )
}
