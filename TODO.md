# NiconiCompare リファクタリング TODO

このファイルは、しばらく継続するリファクタリング作業で Codex と共有する作業リストです。

- リファクタリング期間中は、このファイルの更新を含めてコミットしない。
- 原則として、各項目を小さな単位に分けて実施し、既存挙動を維持する。
- 挙動変更が必要な不具合修正は、先にテストで現在の問題を再現してから修正する。
- 各作業後に最低限 `pnpm check` と関連テストを実行する。
- Background、永続データ、共通型に影響する変更では `pnpm test:run` と Chrome / Firefox build も実行する。

## 現在の基準状態

2026-06-10 時点で以下を確認済み。

- `pnpm check`: 成功
- `pnpm test:run`: 17ファイル、69テスト成功
- `pnpm build`: 成功
- `pnpm build:firefox`: 成功
- `pnpm storybook:build`: 成功
- Storybook build には 500 kB 超チャンク警告がある
- Firefox build には `data_collection_permissions` 警告がある
- ローカル `main` は `origin/main` より2コミット遅れている

---

## P0: Storage 更新の競合を防止する

### 状態

完了（2026-06-11）

### 実施内容

- `storage.ts` に失敗後も後続処理を継続する Promise ベースの Storage 操作キューを追加した。
- `withStorageUpdates` の read-modify-write 全体を単一 transaction として直列化した。
- Storage key が存在しない状態を扱う `withRawStorageUpdates` を追加し、初期値生成を transaction 化した。
- 直接全置換する import・全削除の `setStorageData` も同じキューで直列化した。
- 公開 Storage 読み取りも同じキューを経由させ、進行中 transaction より古い snapshot を返さないようにした。
- snapshot、settings、ratings、cleanup、状態正規化の個別 `get` → `set` 更新を transaction へ移行した。
- 同時 transaction、失敗後の後続 transaction、更新なし、直接書き込みとの順序、同時イベント登録を検証するテストを追加した。

### 問題

`src/background/services/storage.ts` の `withStorageUpdates` は、Storage を読み込み、メモリ上で更新し、Storage へ書き戻す read-modify-write を行っている。しかし、この処理を直列化する仕組みがない。

Background の `chrome.runtime.onMessage` は複数メッセージを並行処理できるため、次のような競合が発生し得る。

1. 処理Aと処理Bが同じ古い Storage 値を読む。
2. 処理Aが更新を書き込む。
3. 処理Bが古い値を元にした更新を書き込み、処理Aの変更を失わせる。

特にイベント登録が同時実行された場合、`events.nextId` の重複やイベント消失につながる。

### 対象

- `src/background/services/storage.ts`
- `src/background/index.ts`
- `src/background/handlers/snapshot.ts`
- `src/background/handlers/settings.ts`
- `src/background/services/cleanup.ts`
- その他 `getStorageData` の後に `setStorageData` を行う処理

### 方針

- Background 内に Promise ベースの書き込みキューを導入する。
- read-modify-write を行う処理は、共通 transaction 関数を経由させる。
- transaction 内では必要なキーを読み込み、更新関数を実行し、まとめて書き込む。
- 読み取り専用処理はキュー対象にする必要があるかを判断する。
- 全データ削除、import、cleanup など広範囲更新との競合も考慮する。
- エラー発生後もキューが停止しない実装にする。

### テスト

- 同時に複数イベントを登録しても、すべて保存され `nextId` が一意になること。
- 異なるハンドラーが同じ Storage キーを更新しても、先行更新を失わないこと。
- transaction が失敗した後も、後続 transaction が実行されること。
- 更新がない場合は Storage へ書き込まないこと。

### 完了条件

- Background の read-modify-write が共通の直列化処理を経由している。
- Storage 競合を再現するテストが追加され、修正後に成功する。
- `pnpm check`、`pnpm test:run`、Chrome / Firefox build が成功する。

---

## P0: 動画一覧のソート方向を統一する

### 状態

完了（2026-06-29）

### 問題

`src/options/tabs/VideosTab.tsx` の comparator は、項目によって返す方向が異なる。

- Rating、RD、評価数、勝敗数、最終判定日時は実質的に降順 comparator。
- タイトルと投稿者は `localeCompare` による昇順 comparator。
- 最後に `order === "asc" ? -1 : 1` を掛けている。

そのため、同じ「昇順」「降順」指定でも、選択したソート項目によって表示方向が逆転する。

### 対象

- `src/options/tabs/VideosTab.tsx`
- 新規の一覧ロジック用モジュールとテスト

### 方針

- すべての comparator が同じ基準方向を返すよう統一する。
- 推奨は comparator をすべて昇順として定義し、最後に `asc` / `desc` を適用する方法。
- 同値時の安定した副ソートを定義する。候補は動画IDまたはタイトル。
- 可能ならソート型を文字列ではなく union 型にする。

### テスト

- タイトルの昇順・降順。
- 投稿者の昇順・降順。
- Rating、RD、評価数、勝ち数、負け数、最終判定日時の昇順・降順。
- 値が欠ける動画の並び順。
- 同値時の並び順。

### 完了条件

- すべてのソート項目で昇順・降順の意味が一致する。
- ソートロジックが UI コンポーネント外で単体テストされている。

---

## P0: Storage 読み取り失敗を正常な空データとして扱わない

### 問題

次の処理は Storage 読み取り失敗時にデフォルトの空データを返す。

- `src/background/handlers/data.ts` の `handleExportData`
- `src/background/handlers/state.ts` の `readStateSnapshot`

一時的な Storage 障害でも正常応答に見えるため、ユーザーが空のバックアップを保存したり、UI が全データ消失と誤認したりする可能性がある。

### 方針

- Storage 読み取り失敗は例外として Background のメッセージ処理へ伝播させる。
- UI では既存表示を維持し、取得失敗として通知する。
- export は必ず失敗させ、空データのファイルを生成しない。
- 初回起動時のデフォルト生成と、障害時の fallback を明確に分離する。

### テスト

- Storage 読み取り失敗時に export が失敗応答になること。
- 状態取得失敗時に空スナップショットを正常応答しないこと。
- UI が既存状態を不必要に空データへ置き換えないこと。

### 完了条件

- Storage 障害がユーザー操作上の成功として扱われない。
- エラー時の挙動がテストされている。

### 状態

- 対応済み。
- `handleExportData` と `readStateSnapshot` は Storage 読み取り失敗時に空データへ fallback せず、例外を上位へ伝播する。
- Background の共通 message handler が失敗応答へ変換するため、export / state 取得は成功扱いにならない。
- Options の状態再取得失敗時は既存 `snapshot` を維持し、エラー表示だけ更新する。
- `src/background/handlers/data.test.ts`、`src/background/handlers/state.test.ts`、`src/options/hooks/useOptionsData.test.tsx` で回帰テストを追加済み。

---

## P1: Options の一覧ロジックを UI から分離する

### 問題

- `src/options/tabs/EventsTab.tsx`: 約876行
- `src/options/tabs/VideosTab.tsx`: 約748行

コンポーネント内に表示、状態管理、フィルタ、ソート、集計、export、Background 操作が混在している。純粋ロジックが UI に埋まっているため単体テストがなく、ソート不整合などを見逃しやすい。

### 分離候補

- `EventsTab`
  - イベントのフィルタ・検索・ソート
  - export 行生成
  - イベント操作をまとめる hook
  - フィルタ UI
  - `EventRow`
- `VideosTab`
  - 動画のフィルタ・ソート
  - 最終イベント集計
  - 勝敗数集計
  - export 行生成
  - フィルタ UI
  - `VideoRow`

### 方針

- 最初に副作用のない純粋関数を `src/options/utils` へ移す。
- 次に Row コンポーネントを `src/options/components` へ移す。
- 最後に必要なら操作系を custom hook にまとめる。
- 一度に全面書き換えせず、移動ごとにテストを追加する。

### テスト

- Events の検索、カテゴリ、判定、無効化済みフィルタ。
- Events の export 行。
- Videos の検索、投稿者フィルタ、カテゴリ別集計。
- Videos のソートと export 行。

### 完了条件

- 各 Tab コンポーネントが主に画面構成と状態接続を担当する。
- 純粋ロジックに単体テストがある。
- `max-lines` の無効化を削除できる、または大幅に縮小できる。

### 状態

- 一部対応済み。
- `VideosTab` のフィルタ、ソート、カテゴリ別集計、export 行生成を `src/options/utils/videos.ts` へ分離。
- `EventsTab` のフィルタ、検索、ソート、export 行生成を `src/options/utils/events.ts` へ分離。
- `VideoRow` と `EventRow` を `src/options/components` へ分離。
- `src/options/utils/videos.test.ts` に動画検索、投稿者フィルタ、カテゴリ別集計、ソート、export 行の単体テストを追加。
- `src/options/utils/events.test.ts` にイベント検索、カテゴリ、判定、無効化済みフィルタ、export 行の単体テストを追加。
- `VideosTab` は約 419 行まで縮小済み。
- `EventsTab` は約 614 行まで縮小し、`max-lines` 無効化を削除済み。
- 残課題は操作系 hook 分離と、必要ならフィルタ UI 分離。

---

## P1: ページネーション状態を共通化し、範囲外ページを防ぐ

### 状態

- 対応済み。
- `EventsTab` と `VideosTab` のページ計算、範囲補正、ページ変更時スクロールを `usePagination` へ分離。
- sessionStorage 復元値や件数減少で現在ページが範囲外になっても、有効な最終ページを表示する。
- `src/options/hooks/usePagination.test.tsx` に初期ページ補正、件数減少時補正、空一覧、ページ変更時スクロールの単体テストを追加。

### 問題

`EventsTab` と `VideosTab` は、フィルタ結果やデータ件数が減って総ページ数が小さくなっても現在ページを補正しない。

例:

1. 5ページ目を表示する。
2. フィルタやイベント削除で結果が1ページになる。
3. ページ番号は5のままで、データが存在するのに空一覧を表示する。

また、両コンポーネントにページ計算とスクロール処理が重複している。

### 方針

- `usePagination` のような共通 hook を作る。
- 常に `1 <= currentPage <= totalPages` を保証する。
- フィルタ変更時の1ページ目へのリセットを共通化する。
- ページ変更後のスクロール処理も必要に応じて共通化する。
- sessionStorage から復元した範囲外ページも補正する。

### テスト

- 件数減少時に最終有効ページへ補正されること。
- 空一覧時は1ページ目になること。
- sessionStorage の範囲外ページが補正されること。

### 完了条件

- データが存在するのに範囲外ページのため空表示になる状態がない。
- Events と Videos のページング処理の重複が減っている。

---

## P1: メッセージごとのレスポンス型を自動推論できるようにする

### 問題

`src/lib/messages.ts` の `BackgroundResponse` は、すべての操作の戻り値を任意フィールドとしてまとめている。

```ts
{
  data?: TData
  eventId?: number
  deleted?: boolean
  restored?: boolean
  purged?: boolean
}
```

また、`sendNcMessage<TResponse>` は呼び出し側が自由に戻り値型を指定できるため、実際の Background 応答と異なる型を指定してもコンパイルできる。

### 方針

- メッセージ type ごとの request / success response 型マップを定義する。
- `sendNcMessage(message)` の引数から戻り値型を自動推論する。
- 成功レスポンスは操作ごとに必要なフィールドだけを持つ。
- Background の message switch は、可能なら型付き handler map へ分離する。
- unknown message の runtime 処理は残す。

### 検討例

```ts
interface MessageMap {
  recordEvent: {
    request: RecordEventPayload
    response: { eventId: number }
  }
}
```

実際の設計では現在の `MESSAGE_TYPES` と discriminated union を活かし、型定義の重複を増やさないこと。

### テスト

- runtime の成功・失敗レスポンス。
- 型テストで、メッセージごとの戻り値が正しく推論されること。
- 不正な payload や不正な戻り値がコンパイルエラーになること。

### 完了条件

- 呼び出し側で `sendNcMessage<BackgroundResponse<...>>` を手動指定する必要がない。
- `response.eventId` 等が対応するメッセージでのみ参照できる。
- Background router の complexity 無効化を削除または縮小できる。

---

## P1: import データを実行時スキーマで検証する

### 問題

`src/options/tabs/DataTab.tsx` は JSON のルートが object であることだけ確認し、`StorageShape` 相当として Background へ送る。

`src/background/handlers/data.ts` も主に `schemaVersion` を検証しており、events、settings、state、videos、authors、categories の内部構造は十分に検証していない。

TypeScript の型は外部 JSON には適用されないため、壊れたデータによって import 処理中や後続画面で例外が発生する可能性がある。

### 方針

- Background 側を信頼境界とし、StorageShape 全体を runtime 検証する。
- Valibot、Zod、または手書き validator を比較して選ぶ。
- バンドルサイズと保守性を考慮する。
- `schemaVersion` 検証、マイグレーション、正規化、保存を明確な段階に分ける。
- 不正箇所をユーザーへ説明できるエラーメッセージを検討する。

### 検証対象

- settings の数値範囲と boolean
- state の動画IDと recentWindow
- event の ID、timestamp、verdict、categoryId
- `events.nextId`
- video / author の必須フィールド
- category の items、order、defaultId、overlayVisibleIds
- meta の schemaVersion

### テスト

- 各 Storage key の不正型を拒否すること。
- 壊れた event を拒否すること。
- 存在しない categoryId の扱い。
- 正常な過去データを正規化して取り込めること。
- 拒否時に既存 Storage を変更しないこと。

### 完了条件

- import 前に入力全体が runtime 検証される。
- unsafe assertion が import 境界から除去または局所化される。

---

## P1: イベント変更とレーティング再構築処理を集約する

### 問題

イベントの無効化、復活、削除、カテゴリ移動、カテゴリ削除、評価変更で、次の処理が繰り返されている。

1. events を変更する。
2. 全イベントから ratings を再構築する。
3. events と ratings を Storage へ書き込む。

処理ごとの更新キーや meta 更新に差異があり、将来的な修正漏れにつながりやすい。

### 対象

- `src/background/handlers/eventLifecycle.ts`
- `src/background/handlers/event.ts`
- `src/background/handlers/categories.ts`
- `src/background/handlers/ratings.ts`

### 方針

- 「イベントを変換し、必要なら ratings を再構築して保存する」共通 helper を作る。
- helper がイベント未変更時の不要な再構築を避けられるようにする。
- `meta.lastReplayEventId` など派生状態の意味を確認し、更新方針を統一する。
- P0 の Storage transaction 導入後に実施する。

### テスト

- 無効化、復活、削除、カテゴリ移動後の ratings。
- イベントが見つからない場合に更新しないこと。
- 対象イベントが既に期待状態の場合に冪等であること。

### 完了条件

- イベント変更後の派生データ再構築が一つの経路にまとまっている。
- 各 handler は操作固有の検証と変換に集中している。

---

## P2: Storage 変更購読と状態取得を整理する

### 問題

Options、Popup、Overlay で状態取得と Storage 変更購読の実装が分散している。

- `useOptionsData` は Storage の任意変更ごとに全状態と使用量を再取得する。
- Popup は初期取得のみで、Storage 変更を購読していない。
- Overlay は一部キーを直接購読し、残りは Background から再取得する。
- 同じ「非同期 Storage なので `useSyncExternalStore` を直接使いにくい」というコメントが複数箇所にある。

### 方針

- UI ごとに必要な snapshot 範囲を整理する。
- Storage 変更の対象 key を確認し、不要な全再取得を避ける。
- 必要なら debounce または再取得の合流を行う。
- 共通 hook を作る場合でも、各 UI が不要な巨大 snapshot を受け取らないようにする。
- Popup をリアルタイム更新すべきか仕様を確認する。

### 完了条件

- 各 UI の状態取得・購読方針が明確で重複が減っている。
- 連続 Storage 更新時に不要な全再取得が抑えられている。

---

## P2: sessionStorage の復元値を検証する

### 問題

`src/options/utils/sessionStorage.ts` は `JSON.parse(raw) as T` で値を返す。古い形式、不正値、手動変更された値でもそのまま UI state として利用される。

### 方針

- 各 session state に小さな parser / normalizer を用意する。
- 不正な sort、order、page、categoryId などは既定値に戻す。
- P1 のページネーション共通化と合わせて実施する。

### テスト

- 不正 JSON は fallback を返すこと。
- 部分的に古い形式でも有効値を維持し、不正値だけ補正すること。
- page が0、負数、文字列の場合に補正されること。

### 完了条件

- sessionStorage の値が UI state に入る前に正規化される。
- unsafe assertion が除去または parser 内へ局所化される。

---

## P2: 不要な Props と重複 UI 処理を削減する

### 対象例

- `VideosTabProps` の `refreshState` と `showToast` は現在未使用。
- Popup の overlay toggle と verdict count toggle は、ほぼ同じ action 実行処理を持つ。
- Loading / error 用の `<main>` レイアウトが複数箇所で重複している。
- Toast tone / ShowToast 型が複数ファイルで重複している。

### 方針

- 未使用 Props を削除する。
- 共通化は、意味のある重複だけを対象にする。
- 単なる JSX の短縮を目的に過剰な抽象化を行わない。

### 完了条件

- コンポーネント API が実際の責務と一致する。
- action 実行とエラー表示の重複が適切に減っている。

---

## P2: CI と検証コマンドを整備する

### 問題

- `pnpm check` は lint と format check のみで、テストや build を含まない。
- リポジトリに `.github/workflows` がない。
- 型チェックは oxlint type-aware lint に統合されているが、実際の本番 build とテストは別途実行が必要。

### 方針

- CI で最低限、次を実行する。
  - `pnpm install --frozen-lockfile`
  - `pnpm check`
  - `pnpm test:run`
  - `pnpm build`
  - `pnpm build:firefox`
- Storybook build を毎回実行するか、UI 変更時または別 job にするか検討する。
- ローカル向けに全検証コマンドを追加する場合、`check` の意味を変えるか、`verify` を追加するかを決める。

### 完了条件

- Pull Request 上で主要検証が自動実行される。
- 開発ドキュメントと実際の検証コマンドが一致する。

---

## P3: Build 警告と依存解決を整理する

### Storybook チャンク警告

`pnpm storybook:build` で 500 kB 超チャンク警告が出る。

- Storybook の開発用途だけなら許容可能か確認する。
- 警告抑制だけを目的とした閾値変更は避ける。
- 実際のロード時間やキャッシュに問題がある場合のみ code splitting を検討する。

### Firefox data collection warning

`pnpm build:firefox` で `data_collection_permissions` 警告が出る。

- Firefox の現行要件を確認する。
- 外部送信を行わない拡張として適切な宣言を追加する。
- 単に `suppressWarnings.firefoxDataCollection` を有効化する前に、manifest 上の正しい対応を確認する。

### Vite の二重解決

WXT build は Vite 8.0.14、ルートと Storybook は Vite 8.0.16 を使用している。

- `vite` direct dependency は Storybook、Vitest、plugin の peer dependency を満たすため現状必要。
- `wxt.config.ts` では異なる Vite patch version の型を局所的に橋渡ししている。
- WXT 更新等で Vite が揃ったら、型 assertion と lint 無効化を削除する。
- override で強制的に揃える場合は WXT、Storybook、Vitest、Chrome / Firefox build をすべて検証する。

---

## 実施順序

依存関係とリスクを考慮し、次の順序で進める。

1. Storage 更新キューと競合テスト
2. Storage 障害時のエラー伝播
3. 動画一覧ソート修正と一覧純粋ロジックの分離
4. ページネーション共通化
5. Events / Videos のコンポーネント分割
6. 型付きメッセージと Background router 整理
7. import runtime validation
8. イベント変更と ratings 再構築の共通化
9. UI の Storage 購読整理
10. sessionStorage 検証
11. 不要 Props と小規模重複の整理
12. CI と build 警告対応

---

## 作業ログ

作業を開始したら、各項目の下またはこのセクションに次を追記する。

- 着手日
- 変更方針
- 実施した変更
- 実行した検証
- 残課題
- 次に着手する項目

### 2026-06-11: Storage 更新の競合防止

- 変更方針: Background 内の Storage 書き込みを単一キューで直列化し、read-modify-write を transaction 単位で保護する。
- 実施した変更: `withStorageUpdates` と `withRawStorageUpdates` を transaction 化し、既存の個別更新経路を移行した。
- 実行した検証: Storage 専用テスト、全テスト、lint、format、Chrome / Firefox build。
- 残課題: なし。
- 次に着手する項目: Storage 読み取り失敗を正常な空データとして扱わない。

### 2026-06-30: Storage 読み取り失敗のエラー伝播

- 変更方針: Storage 読み取り失敗時に handler 側で空データへ fallback せず、Background の共通 message handler へ例外を伝播させる。
- 実施した変更: `handleExportData` と `readStateSnapshot` の fallback catch を削除し、Options の状態再取得失敗時は既存 `snapshot` を維持してエラー表示だけ更新するようにした。
- 実行した検証: `pnpm check`、`pnpm test:run`、Chrome / Firefox build。
- 残課題: なし。
- 次に着手する項目: ページネーション状態を共通化し、範囲外ページを防ぐ。

### 2026-07-01: Options 一覧ロジックの純粋関数分離

- 変更方針: `EventsTab` / `VideosTab` から副作用のない一覧ロジックを `src/options/utils` へ移し、単体テストを追加する。
- 実施した変更: 動画のフィルタ、ソート、カテゴリ別集計、export 行生成を `videos.ts` へ、イベントのフィルタ、検索、export 行生成を `events.ts` へ分離した。
- 実行した検証: `pnpm check`、`pnpm test:run`、Chrome / Firefox build。
- 残課題: `EventsTab` の `max-lines` 無効化削除には Row コンポーネント分離と操作系 hook 分離が必要。
- 次に着手する項目: ページネーション状態を共通化し、範囲外ページを防ぐ。
