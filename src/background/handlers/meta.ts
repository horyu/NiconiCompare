import { performCleanup } from "../services/cleanup"

interface MetaActionPayload {
  action: "cleanup"
}

export async function handleMetaAction(
  payload: MetaActionPayload
): Promise<void> {
  if (payload.action === "cleanup") {
    await performCleanup()
  }
}
