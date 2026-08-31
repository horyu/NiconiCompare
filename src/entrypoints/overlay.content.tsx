import { createRoot } from "react-dom/client"
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root"
import { defineContentScript } from "wxt/utils/define-content-script"

import "../style.css"
import Overlay from "../contents/overlay"

const OVERLAY_Z_INDEX = 2_147_483_647

// oxlint-disable-next-line only-export-components
export default defineContentScript({
  matches: ["https://www.nicovideo.jp/watch/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "niconi-compare-overlay",
      position: "overlay",
      alignment: "top-right",
      // WXT の Shadow Root リセットが host の inline style を上書きするため。
      css: `:host { position: relative !important; z-index: ${OVERLAY_Z_INDEX} !important; }`,
      onMount: (container) => {
        const root = createRoot(container)
        root.render(<Overlay />)
        return root
      },
      onRemove: (root) => {
        root?.unmount()
      }
    })

    ui.mount()
  }
})
