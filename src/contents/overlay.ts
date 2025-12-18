import type { PlasmoCSConfig } from "plasmo"

import { MESSAGE_TYPES } from "../lib/constants"
import type {
  AuthorProfile,
  NcSettings,
  NcState,
  Verdict,
  VideoSnapshot
} from "../lib/types"

export const config: PlasmoCSConfig = {
  matches: ["https://www.nicovideo.jp/watch/*"]
}

type StateResponse = {
  settings: NcSettings
  state: NcState
}

const overlayId = "nc-compare-overlay"

const overlayRoot = document.createElement("div")
overlayRoot.id = overlayId
overlayRoot.style.position = "fixed"
overlayRoot.style.top = "12px"
overlayRoot.style.right = "12px"
overlayRoot.style.zIndex = "2147483647"
overlayRoot.style.fontFamily = "system-ui, sans-serif"
overlayRoot.style.background = "rgba(0,0,0,0.75)"
overlayRoot.style.color = "#fff"
overlayRoot.style.padding = "12px"
overlayRoot.style.borderRadius = "8px"
overlayRoot.style.boxShadow = "0 4px 30px rgba(0,0,0,0.3)"
overlayRoot.style.minWidth = "260px"
overlayRoot.style.display = "flex"
overlayRoot.style.flexDirection = "column"
overlayRoot.style.gap = "8px"

let recentWindow: string[] = []
let currentVideoId: string | undefined
let selectedLeftVideoId: string | undefined

const title = document.createElement("strong")
title.textContent = "NiconiCompare"

const statusText = document.createElement("span")
statusText.style.fontSize = "12px"
statusText.style.opacity = "0.8"

const select = document.createElement("select")
select.style.padding = "6px"
select.style.borderRadius = "4px"
select.style.border = "1px solid rgba(255,255,255,0.3)"
select.style.background = "#1f1f1f"
select.style.color = "#fff"
select.addEventListener("change", () => {
  selectedLeftVideoId = select.value
})

const buttonRow = document.createElement("div")
buttonRow.style.display = "flex"
buttonRow.style.gap = "6px"

const verdictButtons: Array<{ label: string; verdict: Verdict }> = [
  { label: "良い", verdict: "better" },
  { label: "同じ", verdict: "same" },
  { label: "悪い", verdict: "worse" }
]

verdictButtons.forEach(({ label, verdict }) => {
  const button = document.createElement("button")
  button.textContent = label
  button.style.flex = "1"
  button.style.padding = "6px"
  button.style.borderRadius = "4px"
  button.style.border = "none"
  button.style.cursor = "pointer"
  button.style.background = "rgba(255,255,255,0.2)"
  button.style.color = "#fff"
  button.addEventListener("click", () => submitVerdict(verdict))
  buttonRow.appendChild(button)
})

overlayRoot.appendChild(title)
overlayRoot.appendChild(statusText)
overlayRoot.appendChild(select)
overlayRoot.appendChild(buttonRow)

async function bootstrap() {
  const videoId = resolveVideoId()
  if (!videoId) {
    return
  }

  document.body.appendChild(overlayRoot)

  currentVideoId = videoId
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.registerSnapshot,
    payload: {
      video: buildVideoSnapshot(videoId),
      author: buildAuthorSnapshot()
    }
  })

  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.updateCurrentVideo,
    payload: { videoId }
  })

  await refreshState()
}

function resolveVideoId() {
  try {
    const url = new URL(window.location.href)
    const parts = url.pathname.split("/")
    return parts.pop()
  } catch (error) {
    console.error("failed to parse video id", error)
    return undefined
  }
}

function buildVideoSnapshot(videoId: string): VideoSnapshot {
  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
  const thumbnail = document
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content")

  return {
    videoId,
    title: ogTitle ?? document.title ?? videoId,
    authorUrl: buildAuthorSnapshot().authorUrl,
    authorName: buildAuthorSnapshot().name,
    thumbnailUrls: thumbnail ? [thumbnail] : [],
    lengthSeconds: 0,
    capturedAt: Date.now()
  }
}

function buildAuthorSnapshot(): AuthorProfile {
  const authorLink = document.querySelector(
    '[itemprop="author"] a'
  ) as HTMLAnchorElement
  const name =
    authorLink?.textContent ??
    document.querySelector('[rel="author"]')?.textContent ??
    "unknown"
  const href = authorLink?.href ?? window.location.origin
  return {
    authorUrl: href,
    name: name.trim(),
    capturedAt: Date.now()
  }
}

async function refreshState() {
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.requestState
  })

  if (!response?.ok) {
    return
  }

  const data = response.data as StateResponse
  recentWindow = data.state.recentWindow
  currentVideoId = data.state.currentVideoId
  updateUI()
}

function updateUI() {
  statusText.textContent = currentVideoId
    ? `視聴中: ${currentVideoId}`
    : "視聴中動画を検出できません"

  select.innerHTML = ""
  if (recentWindow.length === 0) {
    const option = document.createElement("option")
    option.value = ""
    option.textContent = "比較候補なし"
    select.appendChild(option)
    selectedLeftVideoId = undefined
    return
  }

  recentWindow.forEach((id, index) => {
    const option = document.createElement("option")
    option.value = id
    option.textContent = `${index + 1}. ${id}`
    select.appendChild(option)
  })
  selectedLeftVideoId = recentWindow[0]
  select.value = selectedLeftVideoId
}

async function submitVerdict(verdict: Verdict) {
  if (!selectedLeftVideoId || !currentVideoId) {
    return
  }
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.recordEvent,
    payload: {
      leftVideoId: selectedLeftVideoId,
      rightVideoId: currentVideoId,
      verdict
    }
  })
  if (response?.ok) {
    await refreshState()
  }
}

const start = () =>
  bootstrap().catch((error) => console.error("overlay bootstrap failed", error))

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start)
} else {
  start()
}
