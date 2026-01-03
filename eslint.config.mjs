// @ts-check
import eslint from "@eslint/js"
import vitest from "@vitest/eslint-plugin"
import prettierConfig from "eslint-config-prettier"
import reactPlugin from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import storybook from "eslint-plugin-storybook"
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
    files: ["**/*.test.ts", "**/*.test.tsx"],
    ...vitest.configs.recommended
  },
  storybook.configs["flat/recommended"],
  {
    files: ["**/*.stories.ts", "**/*.stories.tsx"],
    rules: {
      // Storybookのダミーハンドラは空実装が前提のため許可する
      "@typescript-eslint/no-empty-function": "off",
      // Storybookのラッパーコンポーネントは無名関数が多いため許可する
      "react/display-name": "off"
    }
  },
  prettierConfig
])
