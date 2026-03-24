// @ts-check
import eslint from "@eslint/js"
import prettierConfig from "eslint-config-prettier"
import oxlint from "eslint-plugin-oxlint"
import storybook from "eslint-plugin-storybook"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

// oxlint では import.meta.dirname が any 扱いになるため、文字列化して扱う
const tsconfigRootDir = String(import.meta.dirname)

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
      "!eslint.config.mjs"
    ]
  },
  {
    name: "TypeScript Files",
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    name: "Storybook TypeScript Files",
    files: [".storybook/**/*.ts", ".storybook/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.json",
        tsconfigRootDir
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
      ]
    }
  },
  storybook.configs["flat/recommended"],
  {
    name: "Storybook Stories Overrides",
    files: ["**/*.stories.ts", "**/*.stories.tsx"],
    rules: {
      // Storybookのダミーハンドラは空実装が前提のため許可する
      "@typescript-eslint/no-empty-function": "off"
    }
  },
  {
    name: "Prettier Config",
    ...prettierConfig
  },
  // oxlint と重複しているルールを無効化
  // https://github.com/oxc-project/eslint-plugin-oxlint?tab=readme-ov-file#eslint-plugin-oxlint
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json")
])
