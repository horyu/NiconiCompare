import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react"

import {
  DEFAULT_SETTINGS,
  MAX_RECENT_WINDOW_SIZE,
  MESSAGE_TYPES
} from "../../lib/constants"
import type { NcSettings } from "../../lib/types"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

type SettingsTabProps = {
  snapshot: OptionsSnapshot
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

export const SettingsTab = ({
  snapshot,
  refreshState,
  showToast
}: SettingsTabProps) => {
  const [settingsForm, setSettingsForm] = useState({
    recentWindowSize: "5",
    overlayAutoCloseMs: "2000",
    glickoRating: "1500",
    glickoRd: "350",
    glickoVolatility: "0.06"
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [rebuildingRatings, setRebuildingRatings] = useState(false)

  useEffect(() => {
    setSettingsForm({
      recentWindowSize: String(snapshot.settings.recentWindowSize),
      overlayAutoCloseMs: String(snapshot.settings.overlayAutoCloseMs),
      glickoRating: String(snapshot.settings.glicko.rating),
      glickoRd: String(snapshot.settings.glicko.rd),
      glickoVolatility: String(snapshot.settings.glicko.volatility)
    })
  }, [snapshot])

  const handleSettingsChange =
    (field: keyof typeof settingsForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setSettingsForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const applySettingsToForm = (settings: NcSettings) => {
    setSettingsForm({
      recentWindowSize: String(settings.recentWindowSize),
      overlayAutoCloseMs: String(settings.overlayAutoCloseMs),
      glickoRating: String(settings.glicko.rating),
      glickoRd: String(settings.glicko.rd),
      glickoVolatility: String(settings.glicko.volatility)
    })
  }

  const hasUnsavedSettings = useMemo(() => {
    return (
      settingsForm.recentWindowSize !==
        String(snapshot.settings.recentWindowSize) ||
      settingsForm.overlayAutoCloseMs !==
        String(snapshot.settings.overlayAutoCloseMs) ||
      settingsForm.glickoRating !== String(snapshot.settings.glicko.rating) ||
      settingsForm.glickoRd !== String(snapshot.settings.glicko.rd) ||
      settingsForm.glickoVolatility !==
        String(snapshot.settings.glicko.volatility)
    )
  }, [settingsForm, snapshot])

  const saveSettings = async () => {
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
      return true
    } catch (error) {
      console.error(error)
      showToast("error", "設定の更新に失敗しました。")
      applySettingsToForm(snapshot.settings)
      return false
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSettingsSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await saveSettings()
  }

  const handleDiscardSettings = () => {
    applySettingsToForm(snapshot.settings)
  }

  const handleResetSettings = () => {
    applySettingsToForm(DEFAULT_SETTINGS)
  }

  const handleRebuildRatings = async () => {
    if (hasUnsavedSettings) return
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

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold">オーバーレイ / Glicko 設定</h2>
      </header>
      <form className="grid grid-cols-2 gap-4" onSubmit={handleSettingsSubmit}>
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
            保存
          </button>
          <button
            type="button"
            onClick={handleDiscardSettings}
            disabled={!hasUnsavedSettings || savingSettings}
            title={
              hasUnsavedSettings
                ? "保存せずに変更を破棄します。"
                : "変更がありません。"
            }
            className="px-4 py-2 rounded-md border border-slate-200 text-sm disabled:opacity-50">
            変更を破棄
          </button>
          <button
            type="button"
            onClick={handleResetSettings}
            disabled={savingSettings}
            className="px-4 py-2 rounded-md border border-slate-200 text-sm disabled:opacity-50">
            デフォルト設定に戻す
          </button>
          <button
            type="button"
            onClick={handleRebuildRatings}
            disabled={rebuildingRatings || hasUnsavedSettings}
            title={hasUnsavedSettings ? "保存してから再計算してください。" : ""}
            className="px-4 py-2 rounded-md border border-slate-200 text-sm hover:bg-slate-100 disabled:opacity-50">
            レーティング再計算
          </button>
        </div>
      </form>
    </section>
  )
}
