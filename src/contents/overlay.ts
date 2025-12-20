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

const keepOverlayEnvValue = `${
  process.env.PLASMO_PUBLIC_KEEP_OVERLAY_OPEN ?? ""
}`
const forceKeepOverlayOpen =
  String(keepOverlayEnvValue).toLowerCase() === "true"
console.info(
  "NiconiCompare overlay ENV: PLASMO_PUBLIC_KEEP_OVERLAY_OPEN=",
  keepOverlayEnvValue
)

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
comparisonGrid.style.gridTemplateColumns = "105px 105px 105px"
comparisonGrid.style.gridTemplateRows = "auto auto auto"
comparisonGrid.style.gap = "8px"
comparisonGrid.style.alignItems = "center"

const currentPreferredButton = document.createElement("button")
currentPreferredButton.textContent = "再生中の動画"
styleVerdictButton(currentPreferredButton)
currentPreferredButton.style.gridColumn = "1"
currentPreferredButton.style.gridRow = "1"
currentPreferredButton.addEventListener("click", () => submitVerdict("better"))
verdictButtonElements.push(currentPreferredButton)

const drawButton = document.createElement("button")
drawButton.textContent = "引き分け"
styleVerdictButton(drawButton)
drawButton.style.gridColumn = "2"
drawButton.style.gridRow = "1"
drawButton.addEventListener("click", () => submitVerdict("same"))
verdictButtonElements.push(drawButton)

const selectedPreferredButton = document.createElement("button")
selectedPreferredButton.textContent = "選択中の動画"
styleVerdictButton(selectedPreferredButton)
selectedPreferredButton.style.gridColumn = "3"
selectedPreferredButton.style.gridRow = "1"
selectedPreferredButton.style.justifySelf = "end"
selectedPreferredButton.addEventListener("click", () => submitVerdict("worse"))
verdictButtonElements.push(selectedPreferredButton)

const currentThumbnail = document.createElement("img")
currentThumbnail.style.gridColumn = "1"
currentThumbnail.style.gridRow = "2"
styleThumbnail(currentThumbnail)

const vsLabel = document.createElement("div")
vsLabel.textContent = "vs"
vsLabel.style.textAlign = "center"
vsLabel.style.fontSize = "14px"
vsLabel.style.fontWeight = "bold"
vsLabel.style.opacity = "0.7"
vsLabel.style.gridColumn = "2"
vsLabel.style.gridRow = "2"

const selectedThumbnail = document.createElement("img")
selectedThumbnail.style.gridColumn = "3"
selectedThumbnail.style.gridRow = "2"
selectedThumbnail.style.justifySelf = "end"
styleThumbnail(selectedThumbnail)

const currentVideoLabel = document.createElement("div")
currentVideoLabel.style.fontSize = "14px"
currentVideoLabel.style.opacity = "0.9"
currentVideoLabel.style.textAlign = "right"
currentVideoLabel.style.gridColumn = "1"
currentVideoLabel.style.gridRow = "3"
currentVideoLabel.style.whiteSpace = "normal"
currentVideoLabel.style.wordBreak = "break-word"
currentVideoLabel.style.overflow = "hidden"

const selectContainer = document.createElement("div")
selectContainer.style.gridColumn = "3"
selectContainer.style.gridRow = "3"
selectContainer.style.width = "100%"
selectContainer.style.display = "flex"
selectContainer.style.flexDirection = "column"
selectContainer.style.alignItems = "flex-end"
selectContainer.style.boxSizing = "border-box"
selectContainer.style.paddingTop = "2px"
selectContainer.style.paddingBottom = "2px"
const selectControl = document.createElement("label")
selectControl.style.position = "relative"
selectControl.style.width = "100%"
selectControl.style.display = "flex"
selectControl.style.alignItems = "center"
const selectDisplay = document.createElement("span")
selectDisplay.style.padding = "3px 6px"
selectDisplay.style.borderRadius = "4px"
selectDisplay.style.border = "1px solid rgba(255,255,255,0.3)"
selectDisplay.style.background = "#1f1f1f"
selectDisplay.style.color = "#fff"
selectDisplay.style.fontSize = "12px"
selectDisplay.style.display = "flex"
selectDisplay.style.alignItems = "center"
selectDisplay.style.pointerEvents = "none"
selectDisplay.style.width = "100%"
const selectTitle = document.createElement("div")
selectTitle.style.fontSize = "13px"
selectTitle.style.opacity = "0.9"
selectTitle.style.marginTop = "6px"
selectTitle.style.alignSelf = "stretch"
selectTitle.style.textAlign = "right"
selectTitle.style.whiteSpace = "normal"
selectTitle.style.wordBreak = "break-word"
selectTitle.style.overflow = "hidden"

select.style.position = "absolute"
select.style.top = "0"
select.style.left = "0"
select.style.width = "100%"
select.style.height = "100%"
select.style.opacity = "0"
select.style.cursor = "pointer"
select.style.zIndex = "5"
select.style.pointerEvents = "auto"
const selectId = "nc-select"
select.id = selectId
selectControl.htmlFor = selectId
selectControl.appendChild(selectDisplay)
selectControl.appendChild(select)
selectContainer.append(selectControl, selectTitle)

comparisonGrid.append(
  currentPreferredButton,
  drawButton,
  selectedPreferredButton,
  currentThumbnail,
  vsLabel,
  selectedThumbnail,
  currentVideoLabel,
  selectContainer
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
    return `${videoId} | ${snapshot.title}`
  }
  return videoId
}

function updateThumbnail(img: HTMLImageElement, videoId?: string) {
  if (!videoId) {
    img.style.visibility = "hidden"
    img.removeAttribute("src")
    return
  }
  const snapshot = videoSnapshots[videoId]
  const source = snapshot?.thumbnailUrls?.[0]
  if (source) {
    img.src = source
    img.style.visibility = "visible"
  } else {
    img.style.visibility = "hidden"
    img.removeAttribute("src")
  }
}

function updateComparisonLabels() {
  currentVideoLabel.textContent = currentVideoId
    ? formatVideoLabel(currentVideoId)
    : "再生中動画を検出できません"
  updateThumbnail(currentThumbnail, currentVideoId)
  updateThumbnail(selectedThumbnail, selectedLeftVideoId)
  updateSelectDisplay()
}

function updateSelectDisplay() {
  const idText = selectedLeftVideoId ?? "比較候補を選択してください"
  selectDisplay.textContent = idText
  selectTitle.textContent = selectedLeftVideoId
    ? videoSnapshots[selectedLeftVideoId]?.title ?? ""
    : ""
}

function setStatusMessage(message?: string) {
  if (message) {
    statusText.textContent = message
    statusText.style.display = "block"
    return
  }
  statusText.textContent = ""
  statusText.style.display = "none"
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

function styleThumbnail(img: HTMLImageElement) {
  img.style.width = "100%"
  img.style.maxWidth = "120px"
  img.style.aspectRatio = "16 / 9"
  img.style.objectFit = "cover"
  img.style.borderRadius = "6px"
  img.style.background = "rgba(255,255,255,0.1)"
  img.style.visibility = "hidden"
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
  if (forceKeepOverlayOpen) {
    controlsContainer.style.display = "flex"
    return
  }
  controlsContainer.style.display = "none"
}

function scheduleAutoClose(delay?: number) {
  if (forceKeepOverlayOpen) {
    showControls()
    return
  }
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
