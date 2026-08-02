import { useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/ncAction"
import type { CompareEvent, Verdict } from "../../lib/types"

interface UseEventActionsOptions {
  refreshState: (silent?: boolean) => Promise<void>
  showToast: (tone: "success" | "error", text: string) => void
}

interface EventActionHandlers {
  eventBusyId: number | null
  handleBulkMove: (
    eventIds: number[],
    targetCategoryId: string
  ) => Promise<void>
  handleDeleteEvent: (eventId: number) => Promise<void>
  handleEventVerdictChange: (
    target: CompareEvent,
    verdict: Verdict
  ) => Promise<void>
  handleMoveEvent: (eventId: number, targetCategoryId: string) => Promise<void>
  handlePurgeEvent: (eventId: number) => Promise<void>
  handleRestoreEvent: (eventId: number) => Promise<void>
}

export function useEventActions({
  refreshState,
  showToast
}: UseEventActionsOptions): EventActionHandlers {
  const [eventBusyId, setEventBusyId] = useState<number | null>(null)

  const runEventAction = async (
    eventId: number,
    action: () => Promise<unknown>
  ): Promise<void> => {
    setEventBusyId(eventId)
    try {
      await action()
    } finally {
      setEventBusyId(null)
    }
  }

  const handleBulkMove = async (
    eventIds: number[],
    targetCategoryId: string
  ): Promise<void> => {
    if (!targetCategoryId) {
      return
    }
    await runNcAction(
      () =>
        sendNcMessage({
          type: MESSAGE_TYPES.bulkMoveEvents,
          payload: { eventIds, targetCategoryId }
        }),
      {
        context: "ui:options:events:bulk-move",
        errorMessage: "一括移動に失敗しました。",
        successMessage: "カテゴリを一括移動しました。",
        showToast,
        refreshState: () => refreshState(true)
      }
    )
  }

  const handleMoveEvent = async (
    eventId: number,
    targetCategoryId: string
  ): Promise<void> => {
    if (!targetCategoryId) {
      return
    }
    await runEventAction(eventId, () =>
      runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.bulkMoveEvents,
            payload: { eventIds: [eventId], targetCategoryId }
          }),
        {
          context: "ui:options:events:move",
          errorMessage: "カテゴリの移動に失敗しました。",
          successMessage: "カテゴリを移動しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    )
  }

  const handleEventVerdictChange = async (
    target: CompareEvent,
    verdict: Verdict
  ): Promise<void> => {
    if (target.disabled) {
      return
    }
    await runEventAction(target.id, () =>
      runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.recordEvent,
            payload: {
              currentVideoId: target.currentVideoId,
              opponentVideoId: target.opponentVideoId,
              verdict,
              eventId: target.id
            }
          }),
        {
          context: "ui:options:events:update",
          errorMessage: "評価の更新に失敗しました。",
          successMessage: "評価を更新しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    )
  }

  const handleDeleteEvent = async (eventId: number): Promise<void> => {
    await runEventAction(eventId, () =>
      runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.deleteEvent,
            payload: { eventId }
          }),
        {
          context: "ui:options:events:disable",
          errorMessage: "評価の無効化に失敗しました。",
          successMessage: "評価を無効化しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    )
  }

  const handleRestoreEvent = async (eventId: number): Promise<void> => {
    await runEventAction(eventId, () =>
      runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.restoreEvent,
            payload: { eventId }
          }),
        {
          context: "ui:options:events:restore",
          errorMessage: "評価の有効化に失敗しました。",
          successMessage: "評価を有効化しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    )
  }

  const handlePurgeEvent = async (eventId: number): Promise<void> => {
    await runEventAction(eventId, () =>
      runNcAction(
        () =>
          sendNcMessage({
            type: MESSAGE_TYPES.purgeEvent,
            payload: { eventId }
          }),
        {
          context: "ui:options:events:purge",
          errorMessage: "評価の削除に失敗しました。",
          successMessage: "評価を削除しました。",
          showToast,
          refreshState: () => refreshState(true)
        }
      )
    )
  }

  return {
    eventBusyId,
    handleBulkMove,
    handleDeleteEvent,
    handleEventVerdictChange,
    handleMoveEvent,
    handlePurgeEvent,
    handleRestoreEvent
  }
}
