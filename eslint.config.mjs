// @ts-check
import eslint from "@eslint/js"
import vitest from "@vitest/eslint-plugin"
import prettierConfig from "eslint-config-prettier"
import reactPlugin from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig([
  {
    ignores: [
      "build/**",
      ".output/**",
      ".wxt/**",
      "node_modules/**",
      "dist/**",
      "*.js",
      "!eslint.config.js"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  reactPlugin.configs.flat["recommended"],
  reactHooks.configs.flat["recommended-latest"],
  {
    rules: {
      // React 17+ では不要
      "react/react-in-jsx-scope": "off",
      // TypeScript では PropTypes は不要
      "react/prop-types": "off",
      // .tsx ファイルで JSX を許可
      "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }]
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    ...vitest.configs.recommended
  },
  prettierConfig
])
