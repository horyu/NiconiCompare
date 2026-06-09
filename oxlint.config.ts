import { defineConfig } from "oxlint"

export default defineConfig({
  plugins: [
    "eslint",
    "oxc",
    "promise",
    "react",
    "typescript",
    "unicorn",
    "vitest"
  ],
  categories: {
    correctness: "error",
    suspicious: "warn",
    pedantic: "warn",
    perf: "warn",
    // 無効にするルールが多いため、個別にルールを有効化する
    style: "off",
    restriction: "error",
    nursery: "error"
  },
  env: {
    builtin: true,
    browser: true,
    webextensions: true
  },
  options: {
    typeAware: true,
    typeCheck: true
  },
  ignorePatterns: [".output/**", ".wxt/**", "dist/**", "storybook-static/**"],
  rules: {
    // suspicious
    "no-array-sort": "off",
    "no-underscore-dangle": "off",
    "react-in-jsx-scope": "off",
    // pedantic
    "max-lines": "off",
    "max-lines-per-function": "off",
    "no-inline-comments": "off",
    "no-negated-condition": "off",
    "no-useless-undefined": "off",
    "typescript/no-confusing-void-expression": [
      "error",
      {
        ignoreArrowShorthand: true
      }
    ],
    "typescript/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          attributes: false,
          properties: false
        }
      }
    ],
    "typescript/prefer-nullish-coalescing": [
      "error",
      {
        ignorePrimitives: {
          string: true
        }
      }
    ],
    "typescript/prefer-readonly-parameter-types": "off",
    "typescript/strict-boolean-expressions": "off",
    "typescript/strict-void-return": "off",
    // style
    "prefer-destructuring": "error",
    "typescript/consistent-type-imports": "error",
    "unicorn/consistent-existence-index-check": "error",
    "unicorn/filename-case": [
      "error",
      {
        cases: { camelCase: true, pascalCase: true }
      }
    ],
    "unicorn/no-negated-condition": "off",
    "unicorn/numeric-separators-style": "error",
    "unicorn/prefer-logical-operator-over-ternary": "error",
    "unicorn/switch-case-braces": ["error", "avoid"],
    // restriction
    "no-alert": "off",
    "no-plusplus": "off",
    "no-undefined": "off",
    "no-use-before-define": [
      "error",
      {
        functions: false
      }
    ],
    "no-void": "off",
    "oxc/no-async-await": "off",
    "oxc/no-optional-chaining": "off",
    "oxc/no-rest-spread-properties": "off",
    "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
    "typescript/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowTypedFunctionExpressions: true
      }
    ],
    "typescript/no-dynamic-delete": "off",
    "typescript/promise-function-async": [
      "error",
      {
        checkArrowFunctions: false
      }
    ],
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-reduce": "off",
    // validation ライブラリ導入後に有効化する
    "typescript/no-unnecessary-condition": "off"
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        // テストでは関数スコープを気にする必要はない
        "consistent-function-scoping": "off",
        "jest/require-hook": "error",
        // 既存テストの mock 記法に対してコストが高く、型安全性向上の実益が小さいため強制しない
        "vitest/require-mock-type-parameters": "off",
        // グローバルな testTimeout は静的解析で拾われないため、このリポジトリでは強制しない
        "vitest/require-test-timeout": "off",
        // chrome API の型定義省力化用
        "no-unsafe-type-assertion": "off"
      }
    },
    {
      files: ["**/*.stories.tsx"],
      plugins: ["react", "import"],
      jsPlugins: ["eslint-plugin-storybook"],
      rules: {
        // storybook向けの調整
        "import/no-default-export": "off",
        "import/no-anonymous-default-export": "off",
        "import/no-relative-parent-imports": "off",
        "no-empty-function": "off",
        "react/rules-of-hooks": "off",
        // 適当な数値を書くことが多い
        "unicorn/numeric-separators-style": "off",
        // Storybookのラッパーコンポーネントは無名関数が多いため許可する
        "react/display-name": "off",
        // chrome API の型定義省力化用
        "no-unsafe-type-assertion": "off",
        // eslint-plugin-storybook の recommended 相当（warnは error に変更）
        "storybook/await-interactions": "error",
        "storybook/context-in-play-function": "error",
        "storybook/default-exports": "error",
        "storybook/hierarchy-separator": "error",
        "storybook/no-redundant-story-name": "error",
        "storybook/no-renderer-packages": "error",
        "storybook/prefer-pascal-case": "error",
        "storybook/story-exports": "error",
        "storybook/use-storybook-expect": "error",
        "storybook/use-storybook-testing-library": "error"
      }
    },
    {
      files: [".storybook/main.ts"],
      jsPlugins: ["eslint-plugin-storybook"],
      rules: {
        // eslint-plugin-storybook の recommended 相当。
        "storybook/no-uninstalled-addons": "error"
      }
    },
    {
      files: ["src/lib/logger.ts"],
      rules: {
        "no-console": "off"
      }
    }
  ]
})
