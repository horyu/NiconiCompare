// @ts-check
import eslint from "@eslint/js"
import vitest from "@vitest/eslint-plugin"
import prettierConfig from "eslint-config-prettier"
import reactPlugin from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import storybook from "eslint-plugin-storybook"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

// To debug config:
// pnpm exec eslint --inspect-config

export default defineConfig([
  {
    name: "Global Ignores",
    ignores: [
      "build/**",
      ".output/**",
      ".wxt/**",
      "dist/**",
      "storybook-static/**",
      "*.js",
      "*.mjs",
      "*.cjs",
      "!.prettierrc.mjs",
      "!eslint.config.mjs"
    ]
  },
  {
    name: "TypeScript Files",
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
  {
    name: "Base ESLint Rules",
    ...eslint.configs.recommended
  },
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    name: "React Recommended Rules",
    ...reactPlugin.configs.flat["recommended"]
  },
  {
    name: "React Hooks Recommended Rules",
    ...reactHooks.configs.flat["recommended-latest"]
  },
  {
    name: "TypeScript React Overrides",
    rules: {
      // JSX属性やプロパティに渡すハンドラはPromiseを返しても問題にならないため許容する
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false, properties: false } }
      ],
      // falsyな文字列を活用するため、文字列は対象外にする
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } }
      ],
      // React 17+ では不要
      "react/react-in-jsx-scope": "off",
      // TypeScript では PropTypes は不要
      "react/prop-types": "off",
      // .tsx ファイルで JSX を許可
      "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }]
    }
  },
  {
    ...vitest.configs.recommended,
    files: ["**/*.test.ts", "**/*.test.tsx"]
  },
  storybook.configs["flat/recommended"],
  {
    name: "Storybook Stories Overrides",
    files: ["**/*.stories.ts", "**/*.stories.tsx"],
    rules: {
      // Storybookのダミーハンドラは空実装が前提のため許可する
      "@typescript-eslint/no-empty-function": "off",
      // Storybookのラッパーコンポーネントは無名関数が多いため許可する
      "react/display-name": "off"
    }
  },
  {
    name: "Prettier Config",
    ...prettierConfig
  }
])
