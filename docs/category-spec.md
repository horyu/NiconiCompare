# カテゴリ導入 仕様まとめ

## 1. 背景と目的
- 比較を「どの観点で行ったか」を明示して記録できるようにする。
- ユーザーはカテゴリを自由な分類軸として使える（評価軸としても、任意の分類としても使える）。

## 2. 非目標
- カテゴリの自動推定・自動付与。
- クラウド同期や外部共有。
- 複数カテゴリの同時付与（1イベント=1カテゴリのみ）。

## 3. 用語
- **カテゴリ**: 比較の観点。内部的には ID を持つ独立エンティティ。
- **アクティブカテゴリ**: 現在選択されているカテゴリ。比較イベント登録・一覧表示の基準になる。

## 4. データ構造（案）
### 4.1 新規ストレージ
- `nc_categories`:
  - `items: Record<string, Category>`（キーは `Category.id`）
  - `order: string[]`（Optionsでの表示順。全カテゴリの並び順を保持）
  - `overlayVisibleIds: string[]`（オーバーレイに表示するカテゴリIDの集合）
  - `defaultId: string`
- `Category`:
  - `id: string` (UUIDv4)
  - `name: string`
  - `createdAt: number`
  - カテゴリ名は以下の入力ルールに従う。
    - 許容文字: Unicode の文字/数字、半角スペース、`・`、`_`、`-`
    - 禁止文字: `\\ / : * ? " < > |`
    - 長さ: 1〜50 文字
  - UI入力バリデーション・保存値・エクスポート対象の名称はこのルールで統一する（保存値は入力値そのまま）。

### 4.2 既存データの拡張
- `nc_settings`:
  - `activeCategoryId: string` を追加
- `CompareEvent`:
  - `categoryId: string` を追加
- `nc_ratings`:
  - `ratingsByCategory[categoryId][videoId]` に分離

## 5. 初期値・制約
- デフォルトカテゴリ:
  - `id = "00000000-0000-0000-0000-000000000000"`
  - `name = "総合"`
- `overlayVisibleIds` の初期値は `defaultId` のみ。空になった場合は `defaultId` を使用する。
- 表示時に `overlayVisibleIds` が空の場合は `[defaultId]` として扱う（フォールバック）。
- `defaultId` は削除不可、名称変更は可。
- カテゴリ数の上限は設けない。
- `order` は Options とオーバーレイの表示順に共通で利用。
- オーバーレイは `order` に従い、`overlayVisibleIds` に含まれるIDのみ表示する。

## 6. UI仕様
### 6.1 Options: カテゴリタブ
- カテゴリ一覧表示（現在のアクティブカテゴリを明示）。
- 新規カテゴリ追加。
- 既存カテゴリの名称変更。
- 削除:
  - 「別カテゴリへ移動して削除」
  - 「移動せず削除（破棄）」
  を明確に分ける。
- オーバーレイに表示するカテゴリを選択できる。
- アクティブカテゴリの切替はオーバーレイのみで行う（カテゴリタブは表示のみ）。

### 6.2 Options: 評価一覧タブ
- カテゴリフィルタ（表示用の選択。`activeCategoryId` は変更しない）。
- 初期表示は `activeCategoryId` を使用し、以降の選択状態は sessionStorage を使用する（`activeCategoryId` は更新しない）。
- 一括移動:
  - 「現在のフィルタ条件に一致する全件を移動」ボタンを用意。
  - 移動先カテゴリを選択。
  - 対象件数は検索文字列・評価フィルタ・無効化表示の条件に一致する全件（無効化済みはフィルタに従う）。

### 6.3 Options: 動画一覧タブ
- カテゴリは列としては表示しない。フィルターで選択するのみとする。
- 初期表示は `activeCategoryId` を使用し、以降の選択状態は sessionStorage を使用する（`activeCategoryId` は更新しない）。
- Rating/RD/評価数はアクティブカテゴリの集計を表示。

### 6.4 オーバーレイ
- 展開時の「NiconiCompare」左側余白にカテゴリドロップダウンを表示。
- カテゴリ切替後は以降の比較イベントに反映。
- 切替時に `activeCategoryId` を即座に保存し、リロード後も状態を維持する。
- 評価済み状態でカテゴリを切替した場合、直近の比較イベントを切替先カテゴリへ移動する。
- ドロップダウンは長いカテゴリ名を見切る（省略表示）前提で設計する。

## 7. エクスポート
- 評価一覧と動画一覧は、出力ファイル名にカテゴリ名を含める。
- 評価一覧・動画一覧の CSV/TSV にはカテゴリ列を含めない。
- JSON エクスポートに `nc_categories` を含める。
- カテゴリ名の入力ルールは「4.1 新規ストレージ」に記載した許容文字・禁止文字・長さ制限をそのまま適用する。
- ファイル名に含めるカテゴリ名のサニタイズは **出力時のみ** 行い、保存値は変更しない。
  - OSで無効な文字（`[\\/:*?"<>|]`）を削除する。
  - 削除後にカテゴリ名が空文字になった場合は空文字のまま使用する。

## 8. 挙動詳細
- 比較イベント登録時:
  - `activeCategoryId` を `categoryId` として必ず付与。
- Rating 更新:
  - `categoryId` 単位で更新する。
- 評価一覧のフィルタ:
  - `categoryId` 一致のイベントのみ表示。
- カテゴリ移動:
  - 移動対象イベントの `categoryId` を移動先に書き換える。

## 9. 移行方針
- カテゴリ導入時は `schemaVersion` を **1.0.0 → 1.1.0 などに引き上げる**。
- 起動時に schemaVersion をチェックし、`1.0.0` の場合は以下を実施する（旧バージョンからのマイグレーションは**開発中のみ有効**）。
  - 既存イベントに `categoryId = "00000000-0000-0000-0000-000000000000"` を付与。
  - 既存 `nc_ratings` を `ratingsByCategory["00000000-0000-0000-0000-000000000000"]` に移行。
  - `nc_categories` を生成し、`defaultId` と `activeCategoryId` を設定。
- 補足: 開発者のマイグレーションが完了した後、旧バージョン移行処理を削除し、`schemaVersion` を 1.0.0 に戻す。
- 巻き戻しが必要なのは、開発中の暫定対応としてのみ旧バージョンの移行を許容するためであり、リリース前にバージョン運用と処理を整理する前提とする。

## 10. 実装時の決定事項
### 10.1 カテゴリ削除時の処理
- 移動する場合は対象イベントの `categoryId` を移動先に書き換える。
- 移動・削除後はレーティングを自動で再計算する。
- `order` と `overlayVisibleIds` から削除対象のIDを除去する。
- 並び替えは `order` を更新することで行う。

### 10.2 一括移動の確認ダイアログ
- 表示内容に対象件数と移動先カテゴリ名を明示する。
- 対象件数は「検索文字列 + 評価フィルタ + 無効化表示」の条件に一致する件数とする。
- 表示例: 「検索条件に一致する 123 件を [作画] カテゴリに移動します。よろしいですか？」

### 10.3 エクスポート列仕様
- 動画一覧・評価一覧の CSV/TSV にはカテゴリ列を含めない（ファイル名で識別）。
- JSON エクスポートには `nc_categories` を含める。

## 11. 実装ステップ

### Phase 1: 型定義とデータ層の準備
1. `Category` 型を `src/lib/types.ts` に追加
2. `NcCategories` 型を定義 (`items`, `order`, `overlayVisibleIds`, `defaultId`)
3. `CompareEvent` に `categoryId: string` を追加
4. `NcSettings` に `activeCategoryId: string` を追加
5. `NcRatings` を `Record<categoryId, Record<videoId, Rating>>` 構造に変更（旧型は削除）
6. STORAGE_KEYS に `categories: "nc_categories"` を追加
7. デフォルトカテゴリの定数を `constants.ts` に定義

### Phase 2: マイグレーション機能
1. `src/background/services/migration.ts` を作成
2. `schemaVersion` チェック機能を実装
3. 1.0.0 → カテゴリ対応版のマイグレーション関数を実装:
   - 既存イベントに `categoryId` を付与
   - `nc_ratings` 構造の移行 (既存データを defaultId 配下に配置)
   - `nc_categories` の初期化
4. background/index.ts の起動時にマイグレーション実行（冪等）。`onInstalled`/`onStartup` で呼び出し、他のハンドラ処理より前に完了させる。

### Phase 3: Background - カテゴリ操作ハンドラ
1. `src/background/handlers/categories.ts` を作成
2. メッセージタイプを `lib/messages.ts` と `lib/constants.ts` に追加:
   - `createCategory`
   - `updateCategoryName`
   - `deleteCategory` (移動先指定あり/なし)
   - `reorderCategories`
   - `updateOverlayVisibleIds`
   - `updateActiveCategory`
3. カテゴリCRUD操作の実装
4. カテゴリ削除時のレーティング再計算処理

### Phase 4: Background - Rating計算のカテゴリ対応
1. `src/background/handlers/ratings.ts` を修正
2. `rebuildRatings` をカテゴリ単位で実行するように変更
3. Rating取得時に `activeCategoryId` を考慮
4. カテゴリ移動時の再計算トリガー実装

### Phase 5: Background - イベント操作のカテゴリ対応
1. `src/background/handlers/event.ts` を修正
2. `recordEvent` で `activeCategoryId` を `categoryId` として付与
3. `updateEvent` でカテゴリ移動に対応
4. 一括移動機能のメッセージハンドラ追加

### Phase 6: Options - カテゴリタブ
1. `src/options/tabs/CategoriesTab.tsx` を作成
2. カテゴリ一覧表示 (アクティブ表示含む)
3. 新規追加UI (名前入力、バリデーション)
4. 名称変更UI
5. 削除UI (移動先選択 / 破棄選択)
6. オーバーレイ表示設定 (チェックボックス一覧)
7. 並び替えUIは調整しながら決定（上下移動ボタンをベースにし、必要ならドラッグ&ドロップを追加）。`order` を更新する。

### Phase 7: Options - 評価一覧タブのカテゴリ対応
1. `src/options/tabs/EventsTab.tsx` を修正
2. カテゴリフィルタUIを追加 (ドロップダウン)
3. `activeCategoryId` は更新しない
4. 一括移動ボタンと移動先選択UI
5. 確認ダイアログ (対象件数表示)
6. フィルタリング処理を `categoryId` 考慮に変更

### Phase 8: Options - 動画一覧タブのカテゴリ対応
1. `src/options/tabs/VideosTab.tsx` を修正
2. カテゴリフィルタUIを追加
3. Rating/RD/評価数の集計を `activeCategoryId` ベースに変更
4. `lastEventByVideo` と `verdictCountsByVideo` の計算を修正

### Phase 9: オーバーレイのカテゴリ対応
1. `src/contents/overlay.tsx` を修正
2. カテゴリドロップダウンコンポーネントを作成
3. `overlayVisibleIds` に基づくカテゴリ一覧表示
4. `order` に従った並び順
5. カテゴリ切替時の `activeCategoryId` 保存
6. 長いカテゴリ名の省略表示 (CSS: text-overflow: ellipsis)
7. 切替後の比較イベント登録で新しい `categoryId` を使用

### Phase 10: エクスポート機能のカテゴリ対応
1. `src/options/utils/export.ts` を修正
2. `buildExportFilename` にカテゴリ名を含める
3. カテゴリ名のサニタイズ処理 (OSで無効な文字削除)
4. JSON エクスポートに `nc_categories` を含める
5. CSV/TSV はカテゴリ列を含めない (現状維持)

### Phase 11: テストとデバッグ
1. マイグレーション処理のテスト (既存データでの動作確認)
2. カテゴリ作成・変更・削除の動作確認
3. カテゴリ切替時のRating表示確認
4. 一括移動機能のテスト
5. エクスポート機能のテスト (ファイル名、内容)
6. オーバーレイでのカテゴリ切替確認
7. エッジケース確認:
   - defaultId カテゴリの削除阻止
   - overlayVisibleIds が空の場合のフォールバック
   - 不正なカテゴリIDの処理

### Phase 12: ドキュメント更新
1. `docs/architecture.md` にカテゴリ機能を追記
2. `docs/developer-guide.md` にカテゴリ関連の開発ガイド追加
3. README.md の機能説明にカテゴリを追加

## 12. 実装状況

以下は実装完了状況のサマリ。完了済みの Phase は ✅、未着手は ⬜︎ で示す。

- ✅ Phase 1: 型定義とデータ層の準備
- ✅ Phase 2: マイグレーション機能
- ✅ Phase 3: Background - カテゴリ操作ハンドラ
- ✅ Phase 4: Background - Rating計算のカテゴリ対応
- ✅ Phase 5: Background - イベント操作のカテゴリ対応
- ✅ Phase 6: Options - カテゴリタブ
- ✅ Phase 7: Options - 評価一覧タブのカテゴリ対応
- ✅ Phase 8: Options - 動画一覧タブのカテゴリ対応
- ✅ Phase 9: オーバーレイのカテゴリ対応
- ✅ Phase 10: エクスポート機能のカテゴリ対応
- ✅ Phase 11: テストとデバッグ（`pnpm fix` / `pnpm lint` 実行済み）
- ✅ Phase 12: ドキュメント更新（README / architecture / developer-guide 反映済み）
