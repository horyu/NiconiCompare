import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type WxtViteConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  outDirTemplate: "{{browser}}-mv{{manifestVersion}}{{modeSuffix}}",
  manifestVersion: 3,
  targetBrowsers: ["chrome", "firefox"],
  vite: () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- WXT currently types this against an older Vite type instance
    const config = {
      plugins: [tailwindcss()]
    } as WxtViteConfig
    return config
  },
  manifest: {
    permissions: ["storage"],
    host_permissions: ["https://www.nicovideo.jp/watch/*"]
  }
})
