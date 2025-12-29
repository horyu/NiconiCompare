import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useRef } from "react"

import {
  DEFAULT_CATEGORIES,
  DEFAULT_META,
  DEFAULT_SETTINGS
} from "../../lib/constants"
import type { OptionsSnapshot } from "../hooks/useOptionsData"
import { SettingsTab } from "./SettingsTab"

const baseSnapshot: OptionsSnapshot = {
  settings: { ...DEFAULT_SETTINGS },
  state: {
    currentVideoId: undefined,
    pinnedOpponentVideoId: undefined,
    recentWindow: []
  },
  videos: {},
  authors: {},
  events: {
    items: [],
    nextId: 1
  },
  ratings: {},
  meta: { ...DEFAULT_META },
  categories: { ...DEFAULT_CATEGORIES }
}

const modifiedSettings = {
  recentWindowSize: 8,
  popupRecentCount: 8,
  overlayAutoCloseMs: 1500,
  glicko: {
    rating: 1400,
    rd: 250,
    volatility: 0.04
  }
}

const withUnsavedSettings = () => {
  const values = [
    String(modifiedSettings.recentWindowSize),
    String(modifiedSettings.overlayAutoCloseMs),
    String(modifiedSettings.glicko.rating),
    String(modifiedSettings.glicko.rd),
    String(modifiedSettings.glicko.volatility)
  ]
  return (Story: () => JSX.Element) => {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const rafId = window.requestAnimationFrame(() => {
        const inputs = ref.current?.querySelectorAll<HTMLInputElement>(
          "input[type='number']"
        )
        if (!inputs || inputs.length === 0) return
        inputs.forEach((input, index) => {
          const value = values[index]
          if (!value) return
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set
          setter?.call(input, value)
          input.dispatchEvent(new Event("input", { bubbles: true }))
          input.dispatchEvent(new Event("change", { bubbles: true }))
        })
      })
      return () => {
        window.cancelAnimationFrame(rafId)
      }
    }, [])
    return (
      <div ref={ref}>
        <Story />
      </div>
    )
  }
}

const meta: Meta<typeof SettingsTab> = {
  title: "OptionTabs/SettingsTab",
  component: SettingsTab,
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
type Story = StoryObj<typeof SettingsTab>

export const Default: Story = {}

export const UnsavedChanges: Story = {
  decorators: [withUnsavedSettings()],
  args: {
    snapshot: baseSnapshot
  }
}

export const ModifiedDefaults: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      settings: {
        ...baseSnapshot.settings,
        ...modifiedSettings
      }
    }
  }
}
