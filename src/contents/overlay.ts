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
overlayRoot.style.top = "0px"
overlayRoot.style.right = "0px"
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

const verdictButtonElements: HTMLButtonElement[] = []

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
  verdictButtonElements.push(button)
})

overlayRoot.appendChild(title)
overlayRoot.appendChild(statusText)
overlayRoot.appendChild(select)
overlayRoot.appendChild(buttonRow)

async function bootstrap() {
  document.body.appendChild(overlayRoot)
  observeLdJsonChanges()

  const videoData = extractVideoDataFromLdJson()
  if (videoData) {
    await handleVideoChange(videoData)
  } else {
    statusText.textContent = "動画情報を取得中..."
    toggleVerdictButtons(false)
  }
}

async function handleVideoChange(videoData: {
  video: VideoSnapshot
  author: AuthorProfile
}) {
  if (currentVideoId === videoData.video.videoId) {
    return
  }

  currentVideoId = videoData.video.videoId

  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.registerSnapshot,
    payload: {
      video: videoData.video,
      author: videoData.author
    }
  })

  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.updateCurrentVideo,
    payload: { videoId: videoData.video.videoId }
  })

  await refreshState()
}

function observeLdJsonChanges() {
  const attachObserver = () => {
    const scripts = findLdJsonScripts()
    if (scripts.length === 0) {
      return
    }
    scripts.forEach((script) => {
      ldObserver.observe(script, {
        characterData: true,
        childList: true,
        subtree: true
      })
    })
  }

  const ldObserver = new MutationObserver(() => {
    const videoData = extractVideoDataFromLdJson()
    if (videoData) {
      handleVideoChange(videoData)
    }
  })

  const documentObserver = new MutationObserver(() => {
    attachObserver()
  })

  documentObserver.observe(document.head ?? document.documentElement, {
    childList: true,
    subtree: true
  })

  attachObserver()
}

function extractVideoDataFromLdJson():
  | {
      video: VideoSnapshot
      author: AuthorProfile
    }
  | undefined {
  const scripts = findLdJsonScripts()
  if (scripts.length === 0) {
    return undefined
  }

  for (const script of scripts) {
    if (!script.textContent) {
      continue
    }
    try {
      const parsed = JSON.parse(script.textContent)
      const videoObject = Array.isArray(parsed)
        ? parsed.find((item) => item?.["@type"] === "VideoObject")
        : parsed

      if (!videoObject) {
        continue
      }

      const authorData = Array.isArray(videoObject.author)
        ? videoObject.author[0]
        : videoObject.author

      const videoId =
        videoObject.identifier ||
        videoObject.videoId ||
        extractVideoIdFromUrl(videoObject.url) ||
        extractVideoIdFromUrl(window.location.pathname)

      if (!videoId) {
        continue
      }

      const author: AuthorProfile = {
        authorUrl:
          authorData?.url ||
          authorData?.["@id"] ||
          document.querySelector<HTMLAnchorElement>('[rel="author"]')?.href ||
          window.location.origin,
        name:
          authorData?.name ||
          document.querySelector('[rel="author"]')?.textContent ||
          "unknown",
        capturedAt: Date.now()
      }

      const video: VideoSnapshot = {
        videoId,
        title: videoObject.name || document.title || videoId,
        authorUrl: author.authorUrl,
        authorName: author.name,
        thumbnailUrls: Array.isArray(videoObject.thumbnailUrl)
          ? videoObject.thumbnailUrl
          : videoObject.thumbnailUrl
            ? [videoObject.thumbnailUrl]
            : [],
        lengthSeconds: Number(videoObject.duration ?? 0),
        capturedAt: Date.now()
      }

      return { video, author }
    } catch (error) {
      console.error("Failed to parse ld+json", error)
    }
  }
  return undefined
}

function findLdJsonScripts() {
  return Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
}

function extractVideoIdFromUrl(target?: string) {
  if (!target) {
    return undefined
  }
  const url = target.startsWith("http")
    ? new URL(target)
    : new URL(target, window.location.origin)
  const segments = url.pathname.split("/")
  return segments.pop() || segments.pop()
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
    toggleVerdictButtons(false)
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
  toggleVerdictButtons(true)
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

function toggleVerdictButtons(enabled: boolean) {
  verdictButtonElements.forEach((button) => {
    button.disabled = !enabled
    button.style.opacity = enabled ? "1" : "0.4"
    button.style.cursor = enabled ? "pointer" : "not-allowed"
  })
}

const start = () =>
  bootstrap().catch((error) => console.error("overlay bootstrap failed", error))

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start)
} else {
  start()
}
