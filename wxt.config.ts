import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type WxtViteConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  outDirTemplate: "{{browser}}-mv{{manifestVersion}}{{modeSuffix}}",
  manifestVersion: 3,
  targetBrowsers: ["chrome", "firefox"],
  vite: () =>
    ({
      plugins: [tailwindcss()]
    }) as WxtViteConfig,
  manifest: {
    permissions: ["storage"],
    host_permissions: ["https://www.nicovideo.jp/watch/*"]
  }
})
