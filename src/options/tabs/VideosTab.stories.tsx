import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useEffect } from "react"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type {
  AuthorProfile,
  CompareEvent,
  NcAuthors,
  NcRatings,
  NcVideos,
  RatingSnapshot,
  VideoSnapshot
} from "../../lib/types"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { writeSessionState } from "../utils/sessionStorage"
import { VideosTab } from "./VideosTab"

interface VideoSessionState {
  search: string
  author: string
  categoryId: string
  sort: string
  order: "desc" | "asc"
  page: number
}

const SESSION_KEY = "nc_options_video_state"
const DEFAULT_SESSION_STATE: VideoSessionState = {
  search: "",
  author: "all",
  categoryId: DEFAULT_CATEGORY_ID,
  sort: "rating",
  order: "desc",
  page: 1
}

const baseSnapshot: OptionsSnapshot = {
  settings: { ...DEFAULT_SETTINGS },
  state: { ...DEFAULT_STATE },
  videos: {},
  authors: {},
  events: { ...DEFAULT_EVENTS_BUCKET },
  ratings: {},
  meta: { ...DEFAULT_META },
  categories: { ...DEFAULT_CATEGORIES }
}

const createVideo = (
  videoId: string,
  title: string,
  authorUrl: string
): VideoSnapshot => ({
  videoId,
  title,
  authorUrl,
  thumbnailUrls: [],
  capturedAt: 1710000000000
})

const createAuthor = (authorUrl: string, name: string): AuthorProfile => ({
  authorUrl,
  name,
  capturedAt: 1710000000000
})

const createRating = (
  videoId: string,
  rating: number,
  rd: number,
  updatedFromEventId: number
): RatingSnapshot => ({
  videoId,
  rating,
  rd,
  volatility: 0.06,
  updatedFromEventId
})

const createEvent = (
  id: number,
  currentVideoId: string,
  opponentVideoId: string,
  verdict: "better" | "same" | "worse"
): CompareEvent => ({
  id,
  timestamp: 1710000000000 - id * 1000,
  currentVideoId,
  opponentVideoId,
  verdict,
  disabled: false,
  categoryId: DEFAULT_CATEGORY_ID
})

const buildSnapshotWithVideos = (count: number): OptionsSnapshot => {
  const videos: NcVideos = {}
  const authors: NcAuthors = {}
  const ratings: NcRatings = { [DEFAULT_CATEGORY_ID]: {} }
  const events: CompareEvent[] = []

  for (let index = 1; index <= count; index += 1) {
    const videoId = `sm${1000000 + index}`
    const authorIndex = index % 5
    const authorUrl = `https://www.nicovideo.jp/user/${authorIndex}`
    const authorName = `投稿者 ${authorIndex}`
    const title = `評価済み動画 ${index}`
    videos[videoId] = createVideo(videoId, title, authorUrl)
    authors[authorUrl] = createAuthor(authorUrl, authorName)
    ratings[DEFAULT_CATEGORY_ID][videoId] = createRating(
      videoId,
      1500 + index * 3,
      200 + (index % 50),
      index
    )
  }

  for (let index = 1; index <= count; index += 1) {
    const currentVideoId = `sm${1000000 + index}`
    const opponentIndex = index === count ? 1 : index + 1
    const opponentVideoId = `sm${1000000 + opponentIndex}`
    const verdict =
      index % 3 === 0 ? "worse" : index % 2 === 0 ? "same" : "better"
    events.push(createEvent(index, currentVideoId, opponentVideoId, verdict))
  }

  return {
    ...baseSnapshot,
    videos,
    authors,
    ratings,
    categories: { ...DEFAULT_CATEGORIES },
    events: {
      items: events,
      nextId: events.length + 1
    }
  }
}

const buildSnapshotForCategorySwitch = (): OptionsSnapshot => {
  const videos: NcVideos = {}
  const authors: NcAuthors = {}
  const ratings: NcRatings = {
    [DEFAULT_CATEGORY_ID]: {},
    "11111111-1111-1111-1111-111111111111": {}
  }
  const events: CompareEvent[] = []

  for (let index = 1; index <= 6; index += 1) {
    const videoId = `sm${2000000 + index}`
    const authorIndex = index % 2
    const authorUrl = `https://www.nicovideo.jp/user/${authorIndex}`
    const authorName = `投稿者 ${authorIndex}`
    const title = `カテゴリ別動画 ${index}`
    videos[videoId] = createVideo(videoId, title, authorUrl)
    authors[authorUrl] = createAuthor(authorUrl, authorName)
  }

  for (let index = 1; index <= 6; index += 1) {
    const videoId = `sm${2000000 + index}`
    const categoryId =
      index <= 3 ? DEFAULT_CATEGORY_ID : "11111111-1111-1111-1111-111111111111"
    ratings[categoryId][videoId] = createRating(
      videoId,
      1500 + index * 10,
      220 + index,
      index
    )
    const opponentIndex = index === 6 ? 1 : index + 1
    const opponentVideoId = `sm${2000000 + opponentIndex}`
    const verdict = index % 2 === 0 ? "same" : "better"
    events.push(createEvent(index, videoId, opponentVideoId, verdict))
  }

  return {
    ...baseSnapshot,
    videos,
    authors,
    ratings,
    categories: {
      ...DEFAULT_CATEGORIES,
      items: {
        ...DEFAULT_CATEGORIES.items,
        "11111111-1111-1111-1111-111111111111": {
          id: "11111111-1111-1111-1111-111111111111",
          name: "作画",
          createdAt: 1710000000000
        },
        "33333333-3333-3333-3333-333333333333": {
          id: "33333333-3333-3333-3333-333333333333",
          name: "12345678901234567890123456789012345678901234567890",
          createdAt: 1710000200000
        }
      },
      order: [
        DEFAULT_CATEGORY_ID,
        "11111111-1111-1111-1111-111111111111",
        "33333333-3333-3333-3333-333333333333"
      ],
      overlayVisibleIds: [DEFAULT_CATEGORY_ID]
    },
    events: {
      items: events,
      nextId: events.length + 1
    }
  }
}

const withSessionState = (state: Partial<VideoSessionState>) => {
  return (Story: () => ReactElement) => {
    useEffect(() => {
      writeSessionState(SESSION_KEY, {
        ...DEFAULT_SESSION_STATE,
        ...state
      })
    }, [])

    return <Story />
  }
}

const meta: Meta<typeof VideosTab> = {
  title: "OptionTabs/VideosTab",
  component: VideosTab,
  decorators: [
    (Story) => (
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <Story />
      </div>
    )
  ],
  args: {
    snapshot: baseSnapshot,
    refreshState: async () => {},
    showToast: () => {}
  }
}

export default meta
type Story = StoryObj<typeof VideosTab>

export const Empty: Story = {
  decorators: [withSessionState({})]
}

export const MissingData: Story = {
  decorators: [withSessionState({})],
  args: {
    snapshot: {
      ...baseSnapshot,
      events: {
        items: [createEvent(1, "sm1000001", "sm1000002", "better")],
        nextId: 2
      }
    }
  }
}

export const ManyVideos: Story = {
  decorators: [withSessionState({})],
  args: {
    snapshot: buildSnapshotWithVideos(120)
  }
}

export const CategorySwitch: Story = {
  decorators: [withSessionState({})],
  args: {
    snapshot: buildSnapshotForCategorySwitch()
  }
}

export const FilteredByTitle: Story = {
  decorators: [
    withSessionState({
      search: "評価済み動画 5"
    })
  ],
  args: {
    snapshot: buildSnapshotWithVideos(20)
  }
}

export const FilteredByAuthor: Story = {
  decorators: [
    withSessionState({
      author: "投稿者 2"
    })
  ],
  args: {
    snapshot: buildSnapshotWithVideos(20)
  }
}
