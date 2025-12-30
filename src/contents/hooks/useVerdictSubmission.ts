import { useCallback, useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import { sendNcMessage } from "../../lib/messages"
import { runNcAction } from "../../lib/nc-action"
import type { Verdict } from "../../lib/types"

export const RETRY_MESSAGE = "保存に失敗しました。再度お試しください。"

type UseVerdictSubmissionParams = {
  currentVideoId?: string
  opponentVideoId?: string
  refreshState: () => Promise<void>
  onStatusMessage?: (message?: string) => void
}

export function useVerdictSubmission({
  currentVideoId,
  opponentVideoId,
  refreshState,
  onStatusMessage
}: UseVerdictSubmissionParams) {
  const [lastVerdict, setLastVerdict] = useState<Verdict>()
  const [lastEventId, setLastEventId] = useState<number>()

  useEffect(() => {
    setLastVerdict(undefined)
    setLastEventId(undefined)
  }, [currentVideoId, opponentVideoId])

  const submitVerdict = useCallback(
    async (verdict: Verdict) => {
      if (lastVerdict === verdict) {
        if (!lastEventId) {
          setLastVerdict(undefined)
          return
        }

        try {
          const response = await runNcAction(
            () =>
              sendNcMessage({
                type: MESSAGE_TYPES.deleteEvent,
                payload: { eventId: lastEventId }
              }),
            {
              context: "ui:overlay:delete",
              errorMessage: "評価の削除に失敗しました。"
            }
          )

          setLastVerdict(undefined)
          setLastEventId(undefined)

          if (response) {
            onStatusMessage?.(undefined)
            await refreshState()
          } else {
            onStatusMessage?.(RETRY_MESSAGE)
          }
        } catch {
          onStatusMessage?.(RETRY_MESSAGE)
        }
        return
      }

      if (!opponentVideoId || !currentVideoId) return

      try {
        const response = await runNcAction(
          () =>
            sendNcMessage({
              type: MESSAGE_TYPES.recordEvent,
              payload: {
                currentVideoId,
                opponentVideoId,
                verdict,
                eventId: lastEventId
              }
            }),
          {
            context: "ui:overlay:submit",
            errorMessage: "評価の送信に失敗しました。"
          }
        )

        if (response) {
          onStatusMessage?.(undefined)
          setLastVerdict(verdict)
          setLastEventId(response.eventId)
          await refreshState()
        } else {
          onStatusMessage?.(RETRY_MESSAGE)
        }
      } catch {
        onStatusMessage?.(RETRY_MESSAGE)
      }
    },
    [
      currentVideoId,
      lastEventId,
      lastVerdict,
      onStatusMessage,
      opponentVideoId,
      refreshState
    ]
  )

  return {
    lastVerdict,
    lastEventId,
    submitVerdict
  }
}
