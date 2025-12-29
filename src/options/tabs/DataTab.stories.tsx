import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useRef } from "react"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENTS_BUCKET,
  DEFAULT_META,
  DEFAULT_SETTINGS,
  DEFAULT_STATE
} from "../../lib/constants"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { DataTab } from "./DataTab"

const withImportFileSelected = () => {
  return (Story: () => JSX.Element) => {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const input = ref.current?.querySelector<HTMLInputElement>(
        'input[type="file"][accept="application/json"]'
      )
      if (!input) return
      const file = new File(["{}"], "dummy.json", {
        type: "application/json"
      })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      input.files = dataTransfer.files
      input.dispatchEvent(new Event("change", { bubbles: true }))
    }, [])
    return (
      <div ref={ref}>
        <Story />
      </div>
    )
  }
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

const meta: Meta<typeof DataTab> = {
  component: DataTab,
  decorators: [
    (Story) => {
      globalThis.chrome = {
        storage: {
          local: {
            QUOTA_BYTES: 1024 * 1024 * 5
          }
        }
      } as typeof chrome
      return <Story />
    },
    (Story) => (
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <Story />
      </div>
    )
  ],
  args: {
    snapshot: baseSnapshot,
    bytesInUse: null,
    refreshState: async () => {},
    showToast: () => {}
  }
}

export default meta
type Story = StoryObj<typeof DataTab>

export const Default: Story = {}

export const WithStorageUsage: Story = {
  args: {
    bytesInUse: 1024 * 1024 * 1.5
  }
}

export const ImportFileSelected: Story = {
  decorators: [withImportFileSelected()]
}

export const CleanupCompleted: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      meta: {
        ...baseSnapshot.meta,
        lastCleanupAt: Date.now() - 1000 * 60 * 60 * 3
      }
    }
  }
}
