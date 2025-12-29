import type { Meta, StoryObj } from "@storybook/react-vite"

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
  NcVideos,
  VideoSnapshot
} from "../../lib/types"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { writeSessionState } from "../utils/sessionStorage"
import { EventsTab } from "./EventsTab"

type EventSessionState = {
  search: string
  verdict: string
  includeDeleted: boolean
  categoryId: string
  showCategoryOps: boolean
  page: number
}

const SESSION_KEY = "nc_options_event_state"
const DEFAULT_SESSION_STATE: EventSessionState = {
  search: "",
  verdict: "all",
  includeDeleted: false,
  categoryId: DEFAULT_CATEGORY_ID,
  showCategoryOps: false,
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
  categories: {
    ...DEFAULT_CATEGORIES,
    items: {
      ...DEFAULT_CATEGORIES.items,
      "11111111-1111-1111-1111-111111111111": {
        id: "11111111-1111-1111-1111-111111111111",
        name: "作画",
        createdAt: 1710000000000
      },
      "22222222-2222-2222-2222-222222222222": {
        id: "22222222-2222-2222-2222-222222222222",
        name: "ストーリー",
        createdAt: 1710000100000
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
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333"
    ],
    overlayVisibleIds: [
      DEFAULT_CATEGORY_ID,
      "11111111-1111-1111-1111-111111111111"
    ]
  }
}

const createEvent = (
  id: number,
  overrides: Partial<CompareEvent> = {}
): CompareEvent => ({
  id,
  timestamp: 1710000000000 - id * 1000,
  currentVideoId: `sm${1000000 + id}`,
  opponentVideoId: `sm${2000000 + id}`,
  verdict: "better",
  disabled: false,
  categoryId: DEFAULT_CATEGORY_ID,
  ...overrides
})

const createVideo = (videoId: string, title: string): VideoSnapshot => ({
  videoId,
  title,
  authorUrl: `https://www.nicovideo.jp/user/${videoId}`,
  thumbnailUrls: [],
  lengthSeconds: 120,
  capturedAt: 1710000000000
})

const createAuthor = (authorUrl: string, name: string): AuthorProfile => ({
  authorUrl,
  name,
  capturedAt: 1710000000000
})

const buildSnapshotWithEvents = (events: CompareEvent[]): OptionsSnapshot => {
  const videos: NcVideos = {}
  const authors: NcAuthors = {}
  events.forEach((event) => {
    const currentTitle = `基準動画 ${event.id}`
    const opponentTitle = `比較動画 ${event.id}`
    const currentVideo = createVideo(event.currentVideoId, currentTitle)
    const opponentVideo = createVideo(event.opponentVideoId, opponentTitle)
    videos[event.currentVideoId] = currentVideo
    videos[event.opponentVideoId] = opponentVideo
    authors[currentVideo.authorUrl] = createAuthor(
      currentVideo.authorUrl,
      `投稿者 ${event.id}`
    )
    authors[opponentVideo.authorUrl] = createAuthor(
      opponentVideo.authorUrl,
      `投稿者 ${event.id + 100}`
    )
  })
  return {
    ...baseSnapshot,
    videos,
    authors,
    events: {
      items: events,
      nextId: events.length + 1
    },
    categories: baseSnapshot.categories
  }
}

const withSessionState = (state: Partial<EventSessionState>) => {
  return (Story: () => JSX.Element) => (
    <>
      {writeSessionState(SESSION_KEY, {
        ...DEFAULT_SESSION_STATE,
        ...state
      })}
      <Story />
    </>
  )
}

const withLoadingOverlay = (Story: () => JSX.Element) => (
  <div className="relative">
    <Story />
    <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm font-semibold text-slate-700">
      読み込み中...
    </div>
  </div>
)

const meta: Meta<typeof EventsTab> = {
  title: "OptionTabs/EventsTab",
  component: EventsTab,
  decorators: [
    (Story) => (
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <Story />
      </div>
    )
  ],
  args: {
    snapshot: baseSnapshot,
    eventShowThumbnails: true,
    onToggleEventThumbnails: () => {},
    refreshState: async () => {},
    showToast: () => {}
  }
}

export default meta
type Story = StoryObj<typeof EventsTab>

export const Empty: Story = {
  decorators: [withSessionState({})],
  args: {
    snapshot: buildSnapshotWithEvents([])
  }
}

export const Loading: Story = {
  decorators: [withSessionState({}), withLoadingOverlay]
}

export const ManyEvents: Story = {
  decorators: [withSessionState({ includeDeleted: true })],
  args: {
    snapshot: buildSnapshotWithEvents(
      Array.from({ length: 120 }, (_, index) => {
        const patterns = [
          { verdict: "better", disabled: false },
          { verdict: "same", disabled: false },
          { verdict: "worse", disabled: false },
          { verdict: "better", disabled: true },
          { verdict: "same", disabled: true },
          { verdict: "worse", disabled: true }
        ] as const
        const pattern = patterns[index % patterns.length]
        return createEvent(index + 1, pattern)
      })
    )
  }
}

export const FilteredByAuthor: Story = {
  decorators: [
    withSessionState({
      search: "投稿者 105",
      verdict: "better",
      includeDeleted: true,
      page: 1
    })
  ],
  args: {
    snapshot: buildSnapshotWithEvents([
      createEvent(5, { verdict: "better" }),
      createEvent(6, { verdict: "worse" }),
      createEvent(7, { verdict: "better", disabled: true }),
      createEvent(8, { verdict: "same", disabled: true })
    ])
  }
}

export const FilteredByTitle: Story = {
  decorators: [
    withSessionState({
      search: "基準動画 5",
      verdict: "better",
      includeDeleted: true,
      page: 1
    })
  ],
  args: {
    snapshot: buildSnapshotWithEvents([
      createEvent(5, { verdict: "better" }),
      createEvent(6, { verdict: "worse" }),
      createEvent(7, { verdict: "better", disabled: true }),
      createEvent(8, { verdict: "same", disabled: true })
    ])
  }
}
