import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-themes"],
  // Storybook専用: アプリのTailwind出力をstorybook.cssに差し替え、classベースのダークモードを有効化する。
  // 却下案:
  // - preview.tsでstorybook.cssだけ読む → CSSが二重読み込みになり、prefers-color-schemeが勝つ
  // - 本体もclassベースに寄せる → 本体はOS判定を維持したい
  viteFinal(config) {
    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const storybookStyle = path.resolve(dirname, "storybook.css")
    const replaceStylePlugin = {
      name: "storybook-style-alias",
      enforce: "pre",
      transform(code: string, id: string) {
        if (!/[\\/]src[\\/]style\.css$/.test(id)) {
          return null
        }
        return fs.readFileSync(storybookStyle, "utf8")
      }
    } satisfies Plugin
    config.plugins = [
      replaceStylePlugin,
      tailwindcss(),
      react(),
      ...(config.plugins ?? [])
    ]
    return config
  }
}

export default config
