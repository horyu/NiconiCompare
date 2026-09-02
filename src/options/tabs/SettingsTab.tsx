import {
  useEffect,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
  type ReactElement
} from "react"

import {
  DEFAULT_SETTINGS,
  MAX_OVERLAY_AUTO_CLOSE_MS,
  MAX_POPUP_RECENT_COUNT,
  MAX_RECENT_WINDOW_SIZE,
  MESSAGE_TYPES
} from "../../lib/constants"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/ncAction"
import type { NcSettings } from "../../lib/types"
import { OptionButton } from "../components/OptionButton"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

interface SettingsTabProps {
  snapshot: OptionsSnapshot
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

export const SettingsTab = ({
  snapshot,
  refreshState,
  showToast
}: SettingsTabProps): ReactElement => {
  const [settingsForm, setSettingsForm] = useState({
    recentWindowSize: "5",
    popupRecentCount: "5",
    overlayAutoCloseMs: "2000",
    showClosedOverlayVerdict: true,
    glickoRating: "1500",
    glickoRd: "350",
    glickoVolatility: "0.06"
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [rebuildingRatings, setRebuildingRatings] = useState(false)

  useEffect(() => {
    setSettingsForm({
      recentWindowSize: String(snapshot.settings.recentWindowSize),
      popupRecentCount: String(snapshot.settings.popupRecentCount),
      overlayAutoCloseMs: String(snapshot.settings.overlayAutoCloseMs),
      showClosedOverlayVerdict: snapshot.settings.showClosedOverlayVerdict,
      glickoRating: String(snapshot.settings.glicko.rating),
      glickoRd: String(snapshot.settings.glicko.rd),
      glickoVolatility: String(snapshot.settings.glicko.volatility)
    })
  }, [snapshot])

  const handleSettingsChange =
    (field: keyof typeof settingsForm) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setSettingsForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleCheckboxChange =
    (field: "showClosedOverlayVerdict") =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setSettingsForm((prev) => ({ ...prev, [field]: event.target.checked }))
    }

  const applySettingsToForm = (settings: NcSettings): void => {
    setSettingsForm({
      recentWindowSize: String(settings.recentWindowSize),
      popupRecentCount: String(settings.popupRecentCount),
      overlayAutoCloseMs: String(settings.overlayAutoCloseMs),
      showClosedOverlayVerdict: settings.showClosedOverlayVerdict,
      glickoRating: String(settings.glicko.rating),
      glickoRd: String(settings.glicko.rd),
      glickoVolatility: String(settings.glicko.volatility)
    })
  }

  const hasUnsavedSettings =
    settingsForm.recentWindowSize !==
      String(snapshot.settings.recentWindowSize) ||
    settingsForm.popupRecentCount !==
      String(snapshot.settings.popupRecentCount) ||
    settingsForm.overlayAutoCloseMs !==
      String(snapshot.settings.overlayAutoCloseMs) ||
    settingsForm.showClosedOverlayVerdict !==
      snapshot.settings.showClosedOverlayVerdict ||
    settingsForm.glickoRating !== String(snapshot.settings.glicko.rating) ||
    settingsForm.glickoRd !== String(snapshot.settings.glicko.rd) ||
    settingsForm.glickoVolatility !==
      String(snapshot.settings.glicko.volatility)

  const saveSettings = async (): Promise<boolean> => {
    setSavingSettings(true)
    try {
      const payload: Partial<NcSettings> = {
        recentWindowSize: Number(settingsForm.recentWindowSize),
        popupRecentCount: Number(settingsForm.popupRecentCount),
        overlayAutoCloseMs: Number(settingsForm.overlayAutoCloseMs),
        showClosedOverlayVerdict: settingsForm.showClosedOverlayVerdict,
        glicko: {
          rating: Number(settingsForm.glickoRating),
          rd: Number(settingsForm.glickoRd),
          volatility: Number(settingsForm.glickoVolatility)
        }
      }
      const response = await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.updateSettings,
            payload
          }),
        {
          context: "ui:options:settings:update",
          errorMessage: "設定の更新に失敗しました。",
          successMessage: "設定を更新しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
      if (!response) {
        applySettingsToForm(snapshot.settings)
        return false
      }
      return true
    } catch {
      applySettingsToForm(snapshot.settings)
      return false
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSettingsSubmit = async (
    event: SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    await saveSettings()
  }

  const handleDiscardSettings = (): void => {
    applySettingsToForm(snapshot.settings)
  }

  const handleResetSettings = (): void => {
    applySettingsToForm(DEFAULT_SETTINGS)
  }

  const handleRebuildRatings = async (): Promise<void> => {
    if (hasUnsavedSettings) return
    setRebuildingRatings(true)
    try {
      await runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.rebuildRatings
          }),
        {
          context: "ui:options:settings:rebuild",
          errorMessage: "再計算に失敗しました。",
          successMessage: "レーティングを再計算しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    } finally {
      setRebuildingRatings(false)
    }
  }

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <header className="flex min-h-8 items-center">
        <h2 className="text-lg leading-7 font-semibold text-slate-900 dark:text-slate-100">
          設定
        </h2>
      </header>
      <form className="flex flex-col gap-6" onSubmit={handleSettingsSubmit}>
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                オーバーレイ
              </h3>
              <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                比較候補数 (1-{MAX_RECENT_WINDOW_SIZE})
                <input
                  type="number"
                  min={1}
                  max={MAX_RECENT_WINDOW_SIZE}
                  value={settingsForm.recentWindowSize}
                  onChange={handleSettingsChange("recentWindowSize")}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                自動非表示 (ms, 0-{MAX_OVERLAY_AUTO_CLOSE_MS})
                <input
                  type="number"
                  min={0}
                  max={MAX_OVERLAY_AUTO_CLOSE_MS}
                  value={settingsForm.overlayAutoCloseMs}
                  onChange={handleSettingsChange("overlayAutoCloseMs")}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settingsForm.showClosedOverlayVerdict}
                  onChange={handleCheckboxChange("showClosedOverlayVerdict")}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                閉じたオーバーレイに直近の勝敗記号（&lt; / = / &gt;）を表示
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                ポップアップ
              </h3>
              <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                表示する直近評価数 (1-{MAX_POPUP_RECENT_COUNT})
                <input
                  type="number"
                  min={1}
                  max={MAX_POPUP_RECENT_COUNT}
                  value={settingsForm.popupRecentCount}
                  onChange={handleSettingsChange("popupRecentCount")}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Glicko
            </h3>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              初期 rating
              <input
                type="number"
                value={settingsForm.glickoRating}
                onChange={handleSettingsChange("glickoRating")}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              初期 RD
              <input
                type="number"
                value={settingsForm.glickoRd}
                onChange={handleSettingsChange("glickoRd")}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              初期 volatility
              <input
                type="number"
                step="0.01"
                value={settingsForm.glickoVolatility}
                onChange={handleSettingsChange("glickoVolatility")}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <OptionButton
            type="submit"
            disabled={savingSettings}
            variant="primary"
            size="lg">
            保存
          </OptionButton>
          <OptionButton
            onClick={handleDiscardSettings}
            disabled={!hasUnsavedSettings || savingSettings}
            title={
              hasUnsavedSettings
                ? "保存せずに変更を破棄します。"
                : "変更がありません。"
            }
            size="lg">
            変更を破棄
          </OptionButton>
          <OptionButton
            onClick={handleResetSettings}
            disabled={savingSettings}
            size="lg">
            デフォルト設定に戻す
          </OptionButton>
          <OptionButton
            onClick={handleRebuildRatings}
            disabled={rebuildingRatings || hasUnsavedSettings}
            title={hasUnsavedSettings ? "保存してから再計算してください。" : ""}
            size="lg">
            レーティング再計算
          </OptionButton>
        </div>
      </form>
    </section>
  )
}
