import { useMemo, useState, type ReactElement } from "react"

import { DEFAULT_CATEGORY_ID, MESSAGE_TYPES } from "../../lib/constants"
import { formatPaddedDateTime } from "../../lib/date"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/ncAction"
import { CategorySelect } from "../components/CategorySelect"
import { OptionButton } from "../components/OptionButton"
import type { OptionsSnapshot } from "../hooks/useOptionsData"

interface CategoriesTabProps {
  snapshot: OptionsSnapshot
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

const isValidCategoryName = (value: string): boolean => {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 50) {
    return false
  }
  if (/[\\/:*?"<>|]/u.test(trimmed)) {
    return false
  }
  return /^[\p{L}\p{N} ・_-]+$/u.test(trimmed)
}

export const CategoriesTab = ({
  snapshot,
  refreshState,
  showToast
}: CategoriesTabProps): ReactElement => {
  const [newCategoryName, setNewCategoryName] = useState("")
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({})

  const orderedCategories = useMemo(() => {
    return snapshot.categories.order.flatMap((id) => {
      const category = snapshot.categories.items[id]
      return category ? [category] : []
    })
  }, [snapshot.categories])

  const handleCreateCategory = async (): Promise<void> => {
    if (!isValidCategoryName(newCategoryName)) {
      showToast("error", "カテゴリ名は1〜50文字で入力してください。")
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.createCategory,
          payload: { name: newCategoryName.trim() }
        }),
      {
        context: "ui:options:categories:create",
        errorMessage: "カテゴリの追加に失敗しました。",
        successMessage: "カテゴリを追加しました。",
        showToast,
        refreshState: () => refreshState(true),
        onSuccess: () => setNewCategoryName("")
      }
    )
  }

  const handleUpdateName = async (
    categoryId: string,
    nextName: string
  ): Promise<void> => {
    if (!isValidCategoryName(nextName)) {
      showToast("error", "カテゴリ名は1〜50文字で入力してください。")
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.updateCategoryName,
          payload: { categoryId, name: nextName.trim() }
        }),
      {
        context: "ui:options:categories:update",
        errorMessage: "カテゴリ名の更新に失敗しました。",
        successMessage: "カテゴリ名を更新しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleDeleteCategory = async (
    categoryId: string,
    moveToCategoryId?: string
  ): Promise<void> => {
    const target = snapshot.categories.items[categoryId]
    const targetName = target?.name ?? categoryId
    const moveTargetName = moveToCategoryId
      ? (snapshot.categories.items[moveToCategoryId]?.name ?? moveToCategoryId)
      : null
    const confirmed = window.confirm(
      moveToCategoryId
        ? `カテゴリ「${targetName}」に属する評価履歴を「${moveTargetName}」へ移動して削除します。レーティングは自動で再計算されます。よろしいですか？`
        : `カテゴリ「${targetName}」に属する評価履歴とレーティング一覧を破棄して削除します。よろしいですか？`
    )
    if (!confirmed) {
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.deleteCategory,
          payload: { categoryId, moveToCategoryId }
        }),
      {
        context: "ui:options:categories:delete",
        errorMessage: "カテゴリの削除に失敗しました。",
        successMessage: "カテゴリを削除しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleToggleOverlayVisible = async (
    categoryId: string,
    checked: boolean
  ): Promise<void> => {
    const current = snapshot.categories.overlayVisibleIds
    const next = checked
      ? Array.from(new Set([...current, categoryId]))
      : current.filter((id) => id !== categoryId)
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.updateOverlayVisibleIds,
          payload: { overlayVisibleIds: next }
        }),
      {
        context: "ui:options:categories:overlay",
        errorMessage: "オーバーレイ表示の更新に失敗しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleMove = async (
    categoryId: string,
    direction: -1 | 1
  ): Promise<void> => {
    const { order } = snapshot.categories
    const index = order.indexOf(categoryId)
    const targetIndex = index + direction
    if (index === -1 || targetIndex < 0 || targetIndex >= order.length) {
      return
    }
    const nextOrder = [...order]
    const [removed] = nextOrder.splice(index, 1)
    if (!removed) {
      return
    }
    nextOrder.splice(targetIndex, 0, removed)
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.reorderCategories,
          payload: { order: nextOrder }
        }),
      {
        context: "ui:options:categories:reorder",
        errorMessage: "並び替えに失敗しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const categoryOptions = orderedCategories.map((category) => ({
    id: category.id,
    name: category.name
  }))

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <header className="flex min-h-8 items-center justify-between gap-4">
        <h2 className="text-lg leading-7 font-semibold text-slate-900 dark:text-slate-100">
          カテゴリ
        </h2>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {orderedCategories.length} 件
        </div>
      </header>

      <div className="flex items-center gap-3">
        <input
          value={newCategoryName}
          onChange={(event) => setNewCategoryName(event.target.value)}
          aria-label="新規カテゴリ名"
          className="min-w-[240px] rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="カテゴリ名を入力"
        />
        <OptionButton onClick={handleCreateCategory} size="md">
          追加
        </OptionButton>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-[1fr_140px_100px_100px_100px_190px] gap-2 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <div>カテゴリ名</div>
          <div>作成日時</div>
          <div>状態</div>
          <div>オーバーレイ</div>
          <div>並び替え</div>
          <div>操作</div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {orderedCategories.map((category, index) => {
            const isDefault = category.id === DEFAULT_CATEGORY_ID
            const isActive = snapshot.settings.activeCategoryId === category.id
            const isOverlayVisible =
              snapshot.categories.overlayVisibleIds.includes(category.id)
            const moveTarget =
              moveTargets[category.id] ?? snapshot.categories.defaultId
            const createdAt = new Date(category.createdAt)
            return (
              <div
                key={category.id}
                className="grid grid-cols-[1fr_140px_100px_100px_100px_190px] items-center gap-2 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium wrap-break-word whitespace-normal text-slate-900 dark:text-slate-100">
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {category.id}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <div>{formatPaddedDateTime(createdAt)}</div>
                </div>
                <div className="text-xs">
                  {isActive ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                      アクティブ
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      非アクティブ
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isOverlayVisible}
                      onChange={(event) =>
                        handleToggleOverlayVisible(
                          category.id,
                          event.target.checked
                        )
                      }
                    />
                    表示
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <OptionButton
                    onClick={() => handleMove(category.id, -1)}
                    disabled={index === 0}
                    size="compact">
                    ↑
                  </OptionButton>
                  <OptionButton
                    onClick={() => handleMove(category.id, 1)}
                    disabled={index === orderedCategories.length - 1}
                    size="compact">
                    ↓
                  </OptionButton>
                </div>
                <div className="flex flex-col gap-2">
                  <OptionButton
                    onClick={() => {
                      const nextName = window.prompt(
                        "カテゴリ名を入力してください。",
                        category.name
                      )
                      if (nextName === null) {
                        return
                      }
                      const trimmed = nextName.trim()
                      if (trimmed === category.name) {
                        return
                      }
                      void handleUpdateName(category.id, trimmed)
                    }}
                    size="compact">
                    名称変更
                  </OptionButton>
                  {!isDefault && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-[15ch] max-w-[15ch]">
                          <CategorySelect
                            value={moveTarget}
                            onChange={(value) =>
                              setMoveTargets((prev) => ({
                                ...prev,
                                [category.id]: value
                              }))
                            }
                            options={categoryOptions.filter(
                              (item) => item.id !== category.id
                            )}
                            size="sm"
                          />
                        </div>
                        <OptionButton
                          onClick={() =>
                            handleDeleteCategory(category.id, moveTarget)
                          }
                          size="compact">
                          移動して削除
                        </OptionButton>
                      </div>
                      <OptionButton
                        onClick={() => handleDeleteCategory(category.id)}
                        variant="danger"
                        size="compact">
                        破棄して削除
                      </OptionButton>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
