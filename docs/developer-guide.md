# NiconiCompare 開発者ガイド

LLM による開発を前提とした環境構築・開発手順の要点をまとめる。

---

## 1. 環境セットアップ

### 1.1 mise 経由でのツールインストール

[mise](https://mise.jdx.dev/)を使用して Node.js/pnpm を管理:

```bash
# mise インストール (未導入の場合)
# Windows: https://mise.jdx.dev/installing-mise.html 参照

# プロジェクトルートで実行
mise install

# .mise.toml の内容:
# [tools]
# node = "25"
# pnpm = "latest"
```

### 1.2 依存関係インストール

```bash
pnpm install
pnpm approve-builds   # 初回のみ、esbuild/@parcel/watcher 等の build script を許可
pnpm lint             # 型チェック + ESLint + Prettier チェック（並列実行）
pnpm fix              # ESLint + Prettier 自動修正（並列実行）
```

> `pnpm approve-builds` は対話式で、依存の build script 実行を明示的に承認する必要がある。`esbuild`、`@parcel/watcher`、`@swc/core` などが選択対象として表示されるので、画面の指示に従って次工程へ進むこと。

**⚠️ コミット前の必須事項**:
- **`pnpm fix`**: コード自動修正を実行
- **`pnpm lint`**: 全チェック（型・ESLint・Prettier）に合格すること

### 1.3 環境変数の管理

- ルートの `.env.sample` を `.env` にコピーし、必要に応じて値を変更する。
- **`PLASMO_PUBLIC_KEEP_OVERLAY_OPEN`**: 開発用環境変数
  - `true` に設定すると、コンテンツオーバーレイが自動で閉じなくなり、動作確認が容易になる
  - デフォルトは `false`（通常の自動クローズ動作）
  - オーバーレイの `handleMouseLeave` イベントで参照され、開発中のデバッグに使用
- **`PLASMO_PUBLIC_NC_LOG_LEVEL`**: ログレベル設定
  - `error` / `warn` / `info` / `debug` を指定
  - デフォルトは `warn`
- Plasmo/Parcel は `.env` の内容を `process.env` に注入するため、他の `PLASMO_PUBLIC_` プレフィックス変数もこのファイルで管理する。

### 1.4 主要依存関係

- Plasmo 0.90+ (MV3 拡張ビルド)
- TypeScript 5+, React 18.2.0
- Tailwind CSS v4 (@tailwindcss/postcss 4.1.18)
  - **設定**: postcss.config.js のみ（tailwind.config.js 不要）
  - **Plasmo互換性**: scripts/patch.js により自動パッチ適用
- glicko2-lite (Glicko-2 レーティング計算)
- immer (Immutable state 更新)
- **コード品質ツール**:
  - ESLint 9.39+ (TypeScript/React/React Hooks plugins)
  - Prettier 3.2+ (コードフォーマッター)
  - npm-run-all (並列スクリプト実行)
- **UI開発**:
  - Storybook 10.1+ (React/Vite)
- **テストフレームワーク**: 現状未セットアップ（Vitest の導入は将来予定）

---

## 2. 開発・ビルド

### 2.1 開発サーバー

```bash
pnpm dev
```

Chrome: `chrome://extensions/` → デベロッパーモード → `build/chrome-mv3-dev` 読み込み

### 2.2 ディレクトリ構造

```
src/
├── background/   # Service Worker
│   ├── handlers/ # Message handlers
│   ├── services/ # Background services
│   └── utils/    # Background helpers
├── contents/     # Content Script
│   ├── components/ # Overlay components
│   └── hooks/      # Overlay hooks
├── popup/        # Popup UI
├── options/      # Options UI
│   ├── tabs/       # タブコンポーネント (Videos, Events, Settings, Data)
│   ├── hooks/      # カスタムhooks (useOptionsData)
│   ├── components/ # 共通コンポーネント (EventVideoLabel, Pagination)
│   └── utils/      # ユーティリティ (sessionStorage)
├── components/   # 共有コンポーネント
└── lib/          # ユーティリティ
```

### 2.2.1 カテゴリ機能のデータ概要

- `nc_categories` にカテゴリ一覧・表示順・オーバーレイ表示対象を保持
- `nc_settings.activeCategoryId` が現在の比較カテゴリ
- `CompareEvent.categoryId` と `nc_ratings[categoryId]` でカテゴリ単位の履歴/レーティングを分離

### 2.3 コーディング規約

TypeScript strict mode, PascalCase (型/コンポーネント), camelCase (関数/変数), snake_case (storage キー)
- エラーハンドリングは `src/lib/error-handler.ts` を使用し、`console.error` の直書きは避ける
- エラー context は `bg:*`（background）/ `ui:*`（UI）のプレフィックスで統一する
- background へのメッセージ送信は `sendNcMessage` を使用して型チェックする
- UIコンポーネントを追加した場合や props が増えた場合は、Storybook の stories も更新する

### 2.4 コード品質チェック

**ESLint**: 静的解析によりコード品質を保証
- **設定ファイル**: `eslint.config.mjs` (ESLint 9 flat config)
- **有効なルール**:
  - TypeScript 推奨ルール (@typescript-eslint/recommended)
  - React 推奨ルール (react/recommended)
  - React Hooks ルール (react-hooks/rules-of-hooks, exhaustive-deps)
- **カスタムルール**:
  - `react/react-in-jsx-scope`: off (React 17+ では不要)
  - `@typescript-eslint/no-explicit-any`: warn
  - `react-hooks/exhaustive-deps`: warn

**Prettier**: コードフォーマッター (ESLint と競合しないよう eslint-config-prettier で調整済み)

**実行コマンド**:
```bash
pnpm lint              # 型チェック + ESLint + Prettier を並列実行
pnpm fix               # ESLint + Prettier を自動修正モードで並列実行
pnpm eslint            # ESLint のみ（自動修正あり）
pnpm eslint:check      # ESLint のみ（チェックのみ）
pnpm types:check       # TypeScript 型チェックのみ
pnpm format            # Prettier のみ（自動修正あり）
pnpm format:check      # Prettier のみ（チェックのみ）
pnpm storybook         # Storybook 開発サーバー
pnpm storybook:build   # Storybook ビルド
```

**開発フロー**:
1. コード編集
2. `pnpm fix` でコード自動修正
3. `pnpm lint` で全チェック合格を確認
4. コミット

---

## 3. テスト

**現状**: テストフレームワーク（Vitest）は未導入。`pnpm test` は未定義。将来的な実装予定。
Storybook は UI プレビュー用途で導入済み。

カバレッジ目標: 80%以上（テストセットアップ後）

---

## 4. ビルド

```bash
pnpm lint   # ビルド前に型/フォーマット崩れがないかを確認
pnpm build
```

出力: `build/chrome-mv3-prod/`, `build/firefox-mv3-prod/`

ブラウザへの読み込み: chrome://extensions (開発者モード)

---

## 5. デバッグ

- **Service Worker**: chrome://extensions → サービスワーカー
- **Content Script**: watch page 上で DevTools
- **Storage 確認**: `chrome.storage.local.get(null, console.log)`

---

## 6. 参考資料

- [Plasmo Docs](https://docs.plasmo.com/)
- [Chrome MV3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Glicko-2 PDF](http://www.glicko.net/glicko/glicko2.pdf)
