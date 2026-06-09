# NiconiCompare 開発者ガイド

## セットアップ

[mise](https://mise.jdx.dev/) で Node.js と pnpm を導入します。

```bash
mise install
pnpm install
```

依存パッケージの build script が保留された場合は、`pnpm approve-builds` で必要なパッケージを許可します。

## 開発コマンド

| コマンド               | 用途                           |
| ---------------------- | ------------------------------ |
| `pnpm dev`             | Chrome 向け開発ビルド          |
| `pnpm dev:firefox`     | Firefox 向け開発ビルド         |
| `pnpm build`           | Chrome 向け本番ビルド          |
| `pnpm build:firefox`   | Firefox 向け本番ビルド         |
| `pnpm package`         | Chrome 向け zip 作成           |
| `pnpm zip:firefox`     | Firefox 向け zip 作成          |
| `pnpm test`            | Vitest watch                   |
| `pnpm test:run`        | Vitest 一括実行                |
| `pnpm storybook`       | Storybook 開発サーバー         |
| `pnpm storybook:build` | Storybook ビルド               |
| `pnpm lint`            | Oxlint と TypeScript typecheck |
| `pnpm lint:fix`        | Oxlint の自動修正              |
| `pnpm format`          | Oxfmt の自動整形               |
| `pnpm format:check`    | フォーマット確認               |
| `pnpm fix`             | Oxfmt と Oxlint の自動修正     |
| `pnpm check`           | lint とフォーマット確認        |

コミット前に `pnpm fix` と `pnpm check` を実行します。変更内容に応じて `pnpm test:run` と `pnpm storybook:build` も実行してください。

## 開発ビルドの読み込み

`pnpm dev` の実行後、Chrome の `chrome://extensions/` でデベロッパーモードを有効にし、`.output/chrome-mv3-dev` を読み込みます。

Firefox 向けの出力先も `.output/` 配下です。

## 環境変数

必要な場合のみ `.env.sample` を `.env` にコピーします。`WXT_PUBLIC_*` はビルド成果物から参照できる公開のビルド時設定であり、秘密情報を置いてはいけません。

| 変数                           | 用途                                | 既定値  |
| ------------------------------ | ----------------------------------- | ------- |
| `WXT_PUBLIC_KEEP_OVERLAY_OPEN` | 開発時にオーバーレイを閉じない      | `false` |
| `WXT_PUBLIC_NC_LOG_LEVEL`      | `error` / `warn` / `info` / `debug` | `warn`  |

## コード構成

| ディレクトリ      | 内容                                 |
| ----------------- | ------------------------------------ |
| `src/entrypoints` | WXT エントリポイント                 |
| `src/contents`    | Content Script と比較オーバーレイ    |
| `src/background`  | Background handlers、services、utils |
| `src/popup`       | Popup UI                             |
| `src/options`     | Options UI                           |
| `src/lib`         | 型、定数、メッセージ、共通処理       |

設計の詳細は [アーキテクチャ](architecture.md) を参照してください。

## 開発規約

- TypeScript strict mode を使用する。
- 型とコンポーネントは PascalCase、関数と変数は camelCase、Storage key は snake_case とする。
- Background へのメッセージ送信には `sendNcMessage` を使用する。
- ログ出力には `src/lib/logger.ts`、エラー処理には `src/lib/errorHandler.ts` を使用する。
- エラー context は Background で `bg:*`、UI で `ui:*` を使用する。
- UI コンポーネントの追加・変更時は、必要に応じて Storybook story を更新する。

Lint と format の設定は `oxlint.config.ts` と `.oxfmtrc.jsonc` を参照してください。

## デバッグ

- **Overlay**: watch ページの開発者ツールを使用する。必要に応じて `WXT_PUBLIC_KEEP_OVERLAY_OPEN=true` を設定する。
- **Storage**: 開発者ツールの Application > Extension Storage > Local を確認する。
- **Popup**: Popup 内で右クリックして開発者ツールを開く。
- **Service Worker**: `chrome://extensions/` の拡張機能詳細から検査する。

## 参考資料

- [WXT](https://wxt.dev/)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [Glicko-2](http://www.glicko.net/glicko/glicko2.pdf)
