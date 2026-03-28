import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, type ComponentProps, type ReactElement } from "react"

import { ClearableTextInput } from "./ClearableTextInput"

const ControlledClearableTextInput = (
  args: ComponentProps<typeof ClearableTextInput>
): ReactElement => {
  const [value, setValue] = useState(args.value ?? "")
  return <ClearableTextInput {...args} value={value} onValueChange={setValue} />
}

const meta: Meta<typeof ClearableTextInput> = {
  title: "OptionComponents/ClearableTextInput",
  component: ClearableTextInput,
  decorators: [
    (Story) => (
      <div className="bg-white p-4 rounded-lg border border-slate-200 max-w-[360px]">
        <Story />
      </div>
    )
  ],
  args: {
    placeholder: "タイトル・IDで検索",
    clearLabel: "検索条件をクリア"
  },
  render: (args) => <ControlledClearableTextInput {...args} />
}

export default meta
type Story = StoryObj<typeof ClearableTextInput>

export const Empty: Story = {
  args: {
    value: ""
  }
}

export const Filled: Story = {
  args: {
    value: "sm9"
  }
}
