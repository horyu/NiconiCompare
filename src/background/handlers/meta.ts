import { performCleanup } from "../services/cleanup"
import { getStorageData, setStorageData } from "../services/storage"

type MetaActionPayload =
  | { action: "clearRetry"; clearFailed?: boolean }
  | { action: "cleanup" }

export async function handleMetaAction(payload: MetaActionPayload) {
  const { meta } = await getStorageData(["meta"])

  if (payload.action === "cleanup") {
    await performCleanup()
    return
  }

  if (payload.action === "clearRetry") {
    await setStorageData({
      meta: {
        ...meta,
        retryQueue: [],
        failedWrites: payload.clearFailed ? [] : meta.failedWrites
      }
    })
  }
}
