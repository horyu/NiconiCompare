import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import Popup from "../../popup"

const container = document.querySelector("#app")

if (container) {
  createRoot(container).render(
    <StrictMode>
      <Popup />
    </StrictMode>
  )
}
