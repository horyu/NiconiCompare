# NiconiCompare 開発者ガイド

**Version**: 1.0.0  
**Last Updated**: 2025-12-18

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
pnpm lint             # 型チェック + Prettier チェック
```

> `pnpm approve-builds` は対話式で、依存の build script 実行を明示的に承認する必要がある。`esbuild`、`@parcel/watcher`、`@swc/core` などが選択対象として表示されるので、画面の指示に従って次工程へ進むこと。

### 1.3 主要依存関係

- Plasmo 0.90+ (MV3 拡張ビルド)
- TypeScript 5+, React 19+
- Vitest, Playwright (テスト)

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
├── contents/     # Content Script
├── popup/        # Popup UI
├── options/      # Options UI
├── components/   # 共有コンポーネント
└── lib/          # ユーティリティ
```

### 2.3 コーディング規約

TypeScript strict mode, PascalCase (型/コンポーネント), camelCase (関数/変数), snake_case (storage キー)

---

## 3. テスト

```bash
pnpm test        # 単体テスト
pnpm test:e2e    # E2Eテスト (Playwright)
```

カバレッジ目標: 80%以上

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
