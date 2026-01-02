import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import OptionsPage from "../../options"

const container = document.getElementById("app")

if (container) {
  createRoot(container).render(
    <StrictMode>
      <OptionsPage />
    </StrictMode>
  )
}
