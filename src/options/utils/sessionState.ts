import {
  VIDEO_SORT_KEYS,
  type VideoSortKey,
  type VideoSortOrder
} from "./videos"

export interface EventSessionState {
  search: string
  verdict: "all" | "better" | "same" | "worse"
  includeDeleted: boolean
  categoryId: string
  showCategoryOps: boolean
  page: number
}

export interface VideoSessionState {
  search: string
  author: string
  categoryId: string
  sort: VideoSortKey
  order: VideoSortOrder
  page: number
}

export const DEFAULT_EVENT_SESSION_STATE: EventSessionState = {
  search: "",
  verdict: "all",
  includeDeleted: false,
  categoryId: "",
  showCategoryOps: false,
  page: 1
}

export const DEFAULT_VIDEO_SESSION_STATE: VideoSessionState = {
  search: "",
  author: "all",
  categoryId: "",
  sort: "rating",
  order: "desc",
  page: 1
}

export function normalizeEventSessionState(value: unknown): EventSessionState {
  const state = asRecord(value)
  return {
    search: getString(state.search, DEFAULT_EVENT_SESSION_STATE.search),
    verdict: isEventVerdict(state.verdict)
      ? state.verdict
      : DEFAULT_EVENT_SESSION_STATE.verdict,
    includeDeleted: getBoolean(
      state.includeDeleted,
      DEFAULT_EVENT_SESSION_STATE.includeDeleted
    ),
    categoryId: getString(
      state.categoryId,
      DEFAULT_EVENT_SESSION_STATE.categoryId
    ),
    showCategoryOps: getBoolean(
      state.showCategoryOps,
      DEFAULT_EVENT_SESSION_STATE.showCategoryOps
    ),
    page: getPage(state.page)
  }
}

export function normalizeVideoSessionState(value: unknown): VideoSessionState {
  const state = asRecord(value)
  return {
    search: getString(state.search, DEFAULT_VIDEO_SESSION_STATE.search),
    author: getString(state.author, DEFAULT_VIDEO_SESSION_STATE.author),
    categoryId: getString(
      state.categoryId,
      DEFAULT_VIDEO_SESSION_STATE.categoryId
    ),
    sort: isVideoSortKey(state.sort)
      ? state.sort
      : DEFAULT_VIDEO_SESSION_STATE.sort,
    order: isVideoSortOrder(state.order)
      ? state.order
      : DEFAULT_VIDEO_SESSION_STATE.order,
    page: getPage(state.page)
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {}
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function getPage(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 1
}

export function isEventVerdict(
  value: unknown
): value is EventSessionState["verdict"] {
  return (
    value === "all" ||
    value === "better" ||
    value === "same" ||
    value === "worse"
  )
}

export function isVideoSortKey(value: unknown): value is VideoSortKey {
  return (
    typeof value === "string" && VIDEO_SORT_KEYS.some((key) => key === value)
  )
}

function isVideoSortOrder(value: unknown): value is VideoSortOrder {
  return value === "asc" || value === "desc"
}
