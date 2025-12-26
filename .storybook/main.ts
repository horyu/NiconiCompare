import react from "@vitejs/plugin-react"
import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/contents/components/**/*.stories.@(ts|tsx)",
    "../src/options/components/**/*.stories.@(ts|tsx)",
    "../src/popup/**/*.stories.@(ts|tsx)"
  ],
  addons: [],
  async viteFinal(config) {
    config.plugins = [react(), ...(config.plugins ?? [])]
    return config
  }
}

export default config
