import { withThemeByDataAttribute } from "@storybook/addon-themes"

import "./storybook.css"

export const parameters = {
  actions: { argTypesRegex: "^on.*" }
}

export const decorators = [
  withThemeByDataAttribute({
    themes: {
      light: "light",
      dark: "dark"
    },
    defaultTheme: "dark",
    attributeName: "data-mode",
    parentSelector: "html"
  })
]
