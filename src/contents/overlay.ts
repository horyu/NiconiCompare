import type { PlasmoCSConfig } from "plasmo"

import { DEFAULT_SETTINGS, MESSAGE_TYPES, STORAGE_KEYS } from "../lib/constants"
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
overlayRoot.style.maxWidth = "555px"
overlayRoot.style.display = "flex"
overlayRoot.style.flexDirection = "column"
overlayRoot.style.gap = "8px"

let recentWindow: string[] = []
let currentVideoId: string | undefined
let selectedLeftVideoId: string | undefined
let overlaySettings: NcSettings = DEFAULT_SETTINGS
let autoCloseTimer: number | undefined
let observerScheduled = false
let videoSnapshots: Record<string, VideoSnapshot> = {}
let overlayHovered = false

if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return
    }

    if (changes[STORAGE_KEYS.settings]?.newValue) {
      overlaySettings =
        (changes[STORAGE_KEYS.settings].newValue as NcSettings) ??
        DEFAULT_SETTINGS
      applyOverlaySettings()
    }

    if (changes[STORAGE_KEYS.videos]?.newValue) {
      videoSnapshots =
        (changes[STORAGE_KEYS.videos].newValue as Record<
          string,
          VideoSnapshot
        >) ?? {}
      updateUI()
    }
  })
}

const title = document.createElement("strong")
title.textContent = "NiconiCompare"
title.style.width = "100%"
title.style.textAlign = "right"

const statusText = document.createElement("span")
statusText.style.fontSize = "12px"
statusText.style.opacity = "0.8"
statusText.style.display = "none"
statusText.style.width = "100%"
statusText.style.textAlign = "right"

const controlsContainer = document.createElement("div")
controlsContainer.style.display = "flex"
controlsContainer.style.flexDirection = "column"
controlsContainer.style.gap = "8px"

const verdictButtonElements: HTMLButtonElement[] = []

const select = document.createElement("select")
select.style.padding = "6px"
select.style.borderRadius = "4px"
select.style.border = "1px solid rgba(255,255,255,0.3)"
select.style.background = "#1f1f1f"
select.style.color = "#fff"
select.style.width = "100%"
select.style.textAlign = "right"
select.addEventListener("change", () => {
  selectedLeftVideoId = select.value
  updateComparisonLabels()
  scheduleAutoClose()
})
select.addEventListener("blur", () => {
  if (!autoCloseTimer) {
    scheduleAutoClose()
  }
})

const comparisonGrid = document.createElement("div")
comparisonGrid.style.display = "grid"
comparisonGrid.style.gridTemplateColumns = "1fr auto"
comparisonGrid.style.gap = "4px 8px"
comparisonGrid.style.alignItems = "center"

const currentVideoLabel = document.createElement("div")
currentVideoLabel.style.fontSize = "14px"
currentVideoLabel.style.opacity = "0.9"
currentVideoLabel.style.textAlign = "right"

const currentPreferredButton = document.createElement("button")
currentPreferredButton.textContent = "再生中の動画"
styleVerdictButton(currentPreferredButton)
currentPreferredButton.addEventListener("click", () => submitVerdict("better"))
verdictButtonElements.push(currentPreferredButton)

const vsLabel = document.createElement("div")
vsLabel.textContent = "vs"
vsLabel.style.textAlign = "center"
vsLabel.style.fontSize = "14px"
vsLabel.style.fontWeight = "bold"
vsLabel.style.opacity = "0.7"

const drawButton = document.createElement("button")
drawButton.textContent = "引き分け"
styleVerdictButton(drawButton)
drawButton.addEventListener("click", () => submitVerdict("same"))
verdictButtonElements.push(drawButton)

const selectedPreferredButton = document.createElement("button")
selectedPreferredButton.textContent = "選択中の動画"
styleVerdictButton(selectedPreferredButton)
selectedPreferredButton.addEventListener("click", () => submitVerdict("worse"))
verdictButtonElements.push(selectedPreferredButton)

comparisonGrid.append(
  currentVideoLabel,
  currentPreferredButton,
  vsLabel,
  drawButton,
  select,
  selectedPreferredButton
)

overlayRoot.appendChild(title)
overlayRoot.appendChild(statusText)
controlsContainer.appendChild(comparisonGrid)
overlayRoot.appendChild(controlsContainer)

overlayRoot.addEventListener("mouseenter", () => {
  if (!overlaySettings.overlayEnabled) {
    return
  }
  overlayHovered = true
  showControls()
  clearAutoClose()
})

overlayRoot.addEventListener("mouseleave", () => {
  if (!overlaySettings.overlayEnabled) {
    return
  }
  overlayHovered = false
  scheduleAutoClose()
})

async function bootstrap() {
  document.body.appendChild(overlayRoot)
  observeLdJsonChanges()

  const videoData = extractVideoDataFromLdJson()
  if (videoData) {
    await handleVideoChange(videoData)
  } else {
    setStatusMessage("動画情報を取得中...")
    toggleVerdictButtons(false)
  }
}

function scheduleLdJsonProcessing() {
  if (observerScheduled) {
    return
  }
  observerScheduled = true
  const runner = () => {
    observerScheduled = false
    const videoData = extractVideoDataFromLdJson()
    if (videoData) {
      handleVideoChange(videoData)
    }
  }
  if ("requestIdleCallback" in window) {
    ;(window.requestIdleCallback as (cb: () => void) => number)(runner)
  } else {
    setTimeout(runner, 0)
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
  const head = document.head
  if (!head) {
    console.error("document.head is missing; ld+json observer disabled.")
    setStatusMessage("動画情報を取得できません")
    toggleVerdictButtons(false)
    return
  }
  const observer = new MutationObserver(() => scheduleLdJsonProcessing())
  observer.observe(head, {
    childList: true,
    subtree: true
  })
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
  overlaySettings = data.settings
  applyOverlaySettings()
  recentWindow = data.state.recentWindow
  currentVideoId = data.state.currentVideoId
  await loadVideoSnapshots()
  updateUI()
}

async function loadVideoSnapshots() {
  if (!chrome.storage?.local) {
    return
  }
  const result = await chrome.storage.local.get(STORAGE_KEYS.videos)
  videoSnapshots =
    (result?.[STORAGE_KEYS.videos] as Record<string, VideoSnapshot>) ?? {}
}

function updateUI() {
  if (currentVideoId) {
    setStatusMessage()
  } else {
    setStatusMessage("視聴中動画を検出できません")
  }

  select.innerHTML = ""
  if (recentWindow.length === 0) {
    const option = document.createElement("option")
    option.value = ""
    option.textContent = "比較候補なし"
    select.appendChild(option)
    selectedLeftVideoId = undefined
    toggleVerdictButtons(false)
    updateComparisonLabels()
    return
  }

  recentWindow.forEach((id, index) => {
    const option = document.createElement("option")
    option.value = id
    option.textContent = `${index + 1}. ${formatVideoLabel(id)}`
    select.appendChild(option)
  })
  selectedLeftVideoId = recentWindow[0]
  select.value = selectedLeftVideoId
  toggleVerdictButtons(true)
  updateComparisonLabels()
}

function formatVideoLabel(videoId?: string) {
  if (!videoId) {
    return ""
  }
  const snapshot = videoSnapshots[videoId]
  if (snapshot?.title) {
    return `${snapshot.title} | ${videoId}`
  }
  return videoId
}

function updateComparisonLabels() {
  currentVideoLabel.textContent = currentVideoId
    ? formatVideoLabel(currentVideoId)
    : "再生中動画を検出できません"
}

function setStatusMessage(message?: string) {
  if (message) {
    statusText.textContent = message
    statusText.style.display = "block"
  } else {
    statusText.textContent = ""
    statusText.style.display = "none"
  }
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

function styleVerdictButton(button: HTMLButtonElement) {
  button.style.padding = "6px 12px"
  button.style.borderRadius = "4px"
  button.style.border = "none"
  button.style.cursor = "pointer"
  button.style.background = "rgba(255,255,255,0.2)"
  button.style.color = "#fff"
  button.style.whiteSpace = "nowrap"
  button.style.width = "105px"
}

function applyOverlaySettings() {
  if (!overlaySettings.overlayEnabled) {
    overlayRoot.style.display = "none"
    hideControls()
    clearAutoClose()
    return
  }
  overlayRoot.style.display = "flex"
  showControls()
  scheduleAutoClose()
}

function showControls() {
  controlsContainer.style.display = "flex"
}

function hideControls() {
  controlsContainer.style.display = "none"
}

function scheduleAutoClose(delay?: number) {
  clearAutoClose()
  const timeout = delay ?? overlaySettings.overlayAutoCloseMs ?? 2000
  autoCloseTimer = window.setTimeout(() => {
    if (overlayHovered) {
      autoCloseTimer = undefined
      return
    }
    hideControls()
    autoCloseTimer = undefined
  }, timeout)
}

function clearAutoClose() {
  if (autoCloseTimer) {
    window.clearTimeout(autoCloseTimer)
    autoCloseTimer = undefined
  }
}

const start = () =>
  bootstrap().catch((error) => console.error("overlay bootstrap failed", error))

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start)
} else {
  start()
}
