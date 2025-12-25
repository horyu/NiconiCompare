import { useCallback, useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../../lib/constants"
import type { Verdict } from "../../lib/types"

type UseVerdictSubmissionParams = {
  currentVideoId?: string
  opponentVideoId?: string
  refreshState: () => Promise<void>
}

export function useVerdictSubmission({
  currentVideoId,
  opponentVideoId,
  refreshState
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

        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.deleteEvent,
          payload: { eventId: lastEventId }
        })

        setLastVerdict(undefined)
        setLastEventId(undefined)

        if (response?.ok) {
          await refreshState()
        }
        return
      }

      if (!opponentVideoId || !currentVideoId) return

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.recordEvent,
        payload: {
          currentVideoId,
          opponentVideoId,
          verdict,
          eventId: lastEventId
        }
      })

      if (response?.ok) {
        setLastVerdict(verdict)
        setLastEventId(response.eventId)
        await refreshState()
      }
    },
    [currentVideoId, lastEventId, lastVerdict, opponentVideoId, refreshState]
  )

  return {
    lastVerdict,
    submitVerdict
  }
}
