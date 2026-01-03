import { performCleanup } from "../services/cleanup"

interface MetaActionPayload {
  action: "cleanup"
}

export async function handleMetaAction(payload: MetaActionPayload) {
  if (payload.action === "cleanup") {
    await performCleanup()
  }
}
