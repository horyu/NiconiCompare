# NiconiCompare 仕様書

**Version**: 1.0.0  
**Last Updated**: 2025-12-18

本書はブラウザ拡張「NiconiCompare」の設計・実装に必要な仕様を、重複なく整理したものである。

---

## 1. 概要

- **目的**: 視聴中のニコニコ動画を直前動画と比較し続け、ユーザーの嗜好をレーティング／ランキング化して可視化する。
- **価値**: 視聴フローを妨げず好みを蓄積し、後からランキング・整理に活用できる。
- **方式**: Event sourcing で比較イベントを蓄積し、Glicko-2 でレーティングを算出。UI はブラウザ拡張として提供。

## 2. 目的と非目標

- **目的**:
  - 視聴しながら比較を素早く記録できる。
  - ログをリプレイすれば常に同じレーティング結果を得られる。
  - ランキングやフィルタで動画整理に役立てられる。
- **非目標**: KPI 計測／最適化、クラウド同期、署名・ストア公開の自動化、他サイト対応。

## 3. 対応環境・開発スタック

- **ブラウザ**: Chrome 109+ / Firefox 109+ (Manifest V3)
- **開発環境**: Node.js 25, TypeScript 5.0+, Plasmo Framework 0.90+
- **配布**: ローカル sideload 前提（開発者モードで拡張機能を読み込む）。ストア署名・公開は本仕様の対象外。
- **権限**: `activeTab`, `storage`, `scripting`, `https://www.nicovideo.jp/watch/*`

## 4. コアワークフロー

1. **視聴中比較**: 再生ページ右上の小型アイコンをホバーすると比較カードが開き、直近 N 件から比較対象を選び「良い・同じ・悪い」を登録。
2. **ログ補正**: Popup/拡張ページから直近イベントを確認し、誤ったものを無効化または verdict を修正。
3. **ランキング活用**: 保存済み動画一覧でレーティング順・未確定動画（RD が高い動画）を確認し、視聴計画や整理に活かす。

## 5. ドメイン要件

- 比較イベント（CompareEvent）を操作することで状態を決定する。純粋なイベントソーシングには固執せず、「最新の CompareEvent ログが残っていればレーティングを再計算できる」レベルを目指す（過去イベントの編集や置換を許容）。
- マイリスト等との同期は行わず、比較時点の 2 動画と verdict を永続化する。
- 動画メタ／投稿者情報は watch ページの JSON-LD (`author.url`, `thumbnailUrl`) から取得し、`authorUrl` をキーに AuthorProfile を保持。再訪時は最新メタで VideoSnapshot/AuthorProfile を上書きする。
  - **JSON-LD 取得失敗時の挙動**:
    - 該当 videoId の VideoSnapshot が既に `nc_videos` に存在する場合：既存データを使用して比較イベント登録を許可（UI には警告アイコンを表示）
    - VideoSnapshot が存在しない場合：オーバーレイにエラーメッセージを表示し、比較入力を完全に抑制
    - いずれの場合もエラーログに記録し、ユーザーはページリロードで再取得を試行できる
    - JSON-LD の構造変更やフィールド欠損（`author.url` 不在など）も同様に扱う
- `nc_state.recentWindow` として leftVideo 候補 (選択肢) の LRU を設定値の件数だけ保持する。LRU 更新は「比較イベントの storage 書き込み成功後」に行い、比較に登場した leftVideo/rightVideo を最新順に並び替える（書き込み失敗時は LRU を更新しない）。rightVideo（現在再生中の動画）は別途 `nc_state.currentVideoId` で管理する。
  - **設定値変更時の LRU 再構築**: 「直近 100 件までの CompareEvent（deleted = true を除外）を時系列逆順に走査し、登場した leftVideo を重複除去しながら新しい設定値ぶん埋める」アルゴリズムで LRU を再構築する。100 件の根拠は「最大設定値 10 × 10 倍のバッファ」として十分なイベント履歴を確保するため。`currentVideoId` は LRU に含めず、別途保持し続ける。
- 削除はまず CompareEvent に `deleted = true` をセットする論理削除とし、Options から「完全削除」操作を行うまでは `nc_events.items` から除去しない。

## 6. アーキテクチャ

- **Background (service worker)**: chrome.storage I/O、event sourcing、Glicko-2 計算、`nc_meta.needsCleanup` 管理。
- **Content overlay**: watch ページ DOM 監視、比較カード UI、ショートカット無しのマウス操作。
- **Popup**: 直近イベント表示。設定変更は不可。
- **Options / 拡張ページ**: 詳細設定（LRU、カード挙動、Glicko-2 初期値）、イベント履歴、エクスポート/インポート、クリーンアップ等のメンテナンス。

## 7. データと永続化

### 7.1 Storage 方針

- すべて `chrome.storage.local` に保存。クラウド同期は対象外。
- JSON で分割保存し、配列更新は `chrome.storage.local.set` でまとめて書き込む。
- イベント削除時に `nc_meta.needsCleanup = true` をセットし、バックグラウンドタスクまたは Options のクリーンアップ操作で孤立データを削除する。

### 7.2 キー構造

| Key           | 型                                 | 内容                                                                                                                                                                                                      | 想定最大サイズ                 |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `nc_settings` | object                             | ユーザー設定（比較対象 N、カード挙動、Glicko-2 初期値等）                                                                                                                                                 | ~2 KB                          |
| `nc_state`    | object                             | 再生状態（直近 LRU、現在の videoId など）                                                                                                                                                                 | ~5 KB                          |
| `nc_videos`   | record\<videoId, VideoSnapshot\>   | 動画スナップショット                                                                                                                                                                                      | 1 件 ~500 B、1000 件で ~500 KB |
| `nc_authors`  | record\<authorUrl, AuthorProfile\> | 投稿者情報                                                                                                                                                                                                | 1 件 ~200 B、500 件で ~100 KB  |
| `nc_events`   | object                             | `items: CompareEvent[]`, `nextId: number`（次に採番する ID。初期値は items の最大 ID + 1、空配列の場合は 1）                                                                                              | 1 件 ~150 B、1000 件で ~150 KB |
| `nc_ratings`  | record\<videoId, RatingSnapshot\>  | 最新レーティングと RD / volatility                                                                                                                                                                        | 1 件 ~100 B、1000 件で ~100 KB |
| `nc_meta`     | object                             | `lastReplayEventId`, `schemaVersion`, `needsCleanup`, `retryQueue: Array<{eventId: number, retryCount: number, lastAttempt: number}>`, `failedWrites: number[]`（リトライ上限超過イベント ID の一覧）など | ~10 KB                         |

**ストレージクォータ**: Chrome の `chrome.storage.local` は ~10 MB。1000 イベント規模で合計 ~1 MB 程度を想定。クォータ超過時は UI に警告を表示し、古いイベントの削除を促す。

### 7.3 スキーマ

```ts
type VideoSnapshot = {
  videoId: string;
  title: string;
  authorUrl: string;
  thumbnailUrls: string[]; // JSON-LD の thumbnailUrl は通常単一だが、将来的な複数対応のため配列化
  lengthSeconds: number;
  capturedAt: number;
};

type AuthorProfile = {
  authorUrl: string;
  name: string;
  capturedAt: number;
};

type CompareEvent = {
  id: number;
  timestamp: number;
  leftVideoId: string;
  rightVideoId: string;
  verdict: "better" | "same" | "worse"; // rightVideo（視聴中）視点。invalid 値は UI でバリデーション
  deleted: boolean; // Popup操作で論理削除し、Optionsから完全削除可能
  persistent?: boolean; // storage 書き込み完了フラグ（生成時 undefined、書き込み成功後に true、リトライ中は false）
};

type RatingSnapshot = {
  videoId: string;
  rating: number;
  rd: number;
  volatility: number;
  updatedFromEventId: number;
};
```

> VideoSnapshot / AuthorProfile は比較イベントを登録する瞬間に JSON-LD から取得して `nc_videos` / `nc_authors` に保存し、リプレイ時にはそこから読み出すだけで新規登録は行わない。

### 7.4 動画メタ取得 (JSON-LD)

- watch ページの `<script type="application/ld+json">` に含まれる `VideoObject` から `thumbnailUrl[]` と `author.url/name` を取得。
- 再訪時にも同 JSON-LD から最新スナップショットを取得・上書き。
- JSON-LD が取得できない場合は DOM 属性や別 API にフォールバックせず、オーバーレイにエラーメッセージを表示して比較入力を抑制する（ログにも記録）。

## 8. レーティングとリプレイ

- **アルゴリズム**: Glicko-2（初期 rating 1500 / RD 350 / volatility 0.06。Options で変更可）。各 CompareEvent を 1 rating period として扱い、逐次的に計算する。
- **verdict 解釈**: `"better"` = rightVideo 勝利、`"worse"` = leftVideo 勝利、`"same"` = 引き分け。
- **計算タイミング**: 比較イベントが追加されるたびに即時で Glicko-2 を再計算し `nc_ratings` を更新する。Options でパラメータ変更や再計算を行う場合は全イベントをリプレイする。大規模データセット（100+ イベント）の場合は Web Worker を使用して UI ブロックを回避する。
- **リプレイ手順**:
  1. `nc_events.items` から `deleted = false` の CompareEvent を抽出し、ID 昇順で走査
  2. イベントに登場する videoId の VideoSnapshot/AuthorProfile を `nc_videos`/`nc_authors` から取得し、存在しない場合はイベントをエラーログに記録してスキップする（リプレイ中に新規登録は行わない）。UI には「スキップされたイベント数」を通知
  3. 取得できた VideoSnapshot/AuthorProfile を用いて Glicko-2 計算を実行
  4. Glicko-2 計算結果を `nc_ratings` に反映
  5. `nc_meta.lastReplayEventId` を更新
  6. Options でクリーンアップを実行した場合、リプレイに登場しない videoId/authorUrl を `nc_ratings`/`nc_videos`/`nc_authors` から削除し、`needsCleanup = false` に戻す

## 9. UI 仕様

### 9.1 コンテンツオーバーレイ

- **常駐/展開**: 右上のミニアイコン（24×24px、半透明背景）をホバーするとカードが展開。マウスアウト後は即座に閉じる。Popup から `overlayEnabled` が OFF の場合はアイコン自体を表示せず、動画・author 情報の取得も行わない。
- **アクセシビリティ**: アイコンに `role="button"` と `aria-label="動画比較カードを開く"` を付与。Tab キーでフォーカス可能、Enter/Space キーでカード展開。カード内の評価ボタンもキーボード操作対応。
- **比較候補 Select**:
  - `nc_settings.recentWindow` (1〜10) は Options で設定。内部 LRU は設定値の件数だけ leftVideo を保持し、右側に表示される現動画 (rightVideo) と比較する候補を提供する。
  - Select で表示する候補数も設定値と同件数。選択するとサムネイル／メタ表示を更新。
  - 設定値変更時は LRU を再構築し、新しい設定値に合わせて truncate する。
- **評価ボタン**: 良い・同じ・悪い。チェックボックスのように常に選択状態が表示され、カードを閉じても選択内容が残る。直近イベントと同じ動画ペアであれば該当 CompareEvent の verdict を上書きし、異なるペアであれば新しい CompareEvent を追加する。
  - **選択状態の永続化**: カード内のメモリ上で保持し、ページ遷移またはリロード時はリセットされる。過去の CompareEvent を復元して表示することはしない（混乱防止のため）。
- **カードサイズとビューポート**: カード幅 320px、高さ可変（最大 400px）。ビューポート外にはみ出す場合は位置を自動調整（右端 → 左側に表示、下端 → 上に配置）。

### 9.2 Popup

- 最新レーティング概要（Top/Bottom/未確定）と直近イベント一覧（最新 10 件）を表示。**未確定動画**の定義: RD > 100 の動画（初期値 RD 350 のため、新規追加動画や比較回数の少ない動画が該当）。
- `overlayEnabled` トグルを提供し、オーバーレイ表示と動画/author 情報の取得を ON/OFF できる（デフォルト ON）。その他の詳細設定は拡張ページへ誘導。
- 直近イベントに対して `deleted` フラグの On/Off（論理削除／復活）を即時適用できる。完全削除は Options 側で実行。

### 9.3 拡張ページ / Options

1. **保存済み動画一覧**: VideoSnapshot + 最新レーティングのテーブル（ページネーション: 50 件/ページ）。投稿者フィルタ／検索、未計算バッジ（インポート直後は即時計算して解消）、レーティング順ソート。
2. **評価イベント一覧**: CompareEvent テーブル（リンク、verdict、timestamp、`deleted` 状態、ページネーション: 100 件/ページ）。行アクションで論理削除／復活・verdict 変更・ID 検索を行う。完全削除もここから実行できる（削除済みのみ対象）。
3. **Options 設定**:
   - LRU サイズ（1〜10）、オーバーレイ位置（右上/左上）、カード自動閉鎖タイムアウト（0.5〜5 秒）、Glicko-2 初期値等を編集（オーバーレイ／Popup からは編集不可）。変更後はイベントログをリプレイ。
   - イベント履歴の検索・フィルタ・削除済みイベントの閲覧／復活、レーティング再計算ボタン。削除操作はその場で `deleted` フラグを切り替え、Options で「完全削除」した際に `nc_events` から物理削除する。
   - データ操作:
   - JSON エクスポート/インポート (`nc_*` 一括)。`nc_authors`/`nc_videos` 欠如時は UI に「データ未取得」を表示。インポート後は `nc_ratings` のインポート内容に関わらず全イベントを非同期計算（プログレスバー表示）し、ローカルで `nc_ratings` を再生成する。大規模インポート（100+ イベント）では Web Worker を使用。
   - 「イベントから辿れない情報を削除」ボタンで `nc_ratings` の孤立 videoId、および参照のない `nc_videos`/`nc_authors` を削除し、結果（削除件数 or 未検出）を表示。

## 10. データ操作・メンテナンス

- **JSON エクスポート/インポート**: Options から手動実行。`nc_meta.schemaVersion`（現行: `"1.0.0"`）が不一致の場合:
  - 旧バージョン → 新バージョン: マイグレーション関数を実行してインポート（v1.0.0 では未実装）
  - 新バージョン → 旧バージョン: エラーメッセージを表示し、拒否
  - `schemaVersion` 未定義データ: 初期バージョンとみなし、デフォルト値で補完してインポート
- `nc_authors`/`nc_videos` の整合性チェックは行わないが、欠損は UI で明示。
- クリーンアップ実装:
  - バックグラウンドで定期的にチェックし、参照されない `nc_ratings`/`nc_videos`/`nc_authors` を削除して `needsCleanup = false` に戻す。ユーザーが手動でクリーンアップボタンを押した場合も同じ処理を実行する。
- 削除（論理削除）操作は CompareEvent の `deleted` を true に設定する形で即時反映し、Undo 操作で false に戻せるようにする。Options から「完全削除」を実行した場合のみ、該当イベントを `nc_events.items` から物理削除する。

## 11. エラー処理・セキュリティ

- **storage 書き込み失敗時のリトライ**:
  - `nc_meta.retryQueue` に `{eventId, retryCount, lastAttempt}` を追加し、service worker 上で定期チェック（1 分ごと）。
  - 前回の試行から 1 秒（1 回目）→3 秒（2 回目）→5 秒（3 回目）経過後に再試行。タイミングは Chrome の Alarms API で制御。
  - `persistent = true` になったイベントは retryQueue から削除。
  - 3 回失敗後は `nc_meta.failedWrites` に eventId を追加し、Options でユーザーに通知。手動で再試行または破棄を選択できる。
  - **ストレージクォータ超過時**: リトライを中止し、UI に「ストレージ容量不足」警告を即座に表示。古いイベントの削除を促す。
- **イベント ID 採番の競合回避**:
  - `nc_events.nextId` を read → increment → write のトランザクション的に扱い、`chrome.storage.local.get` と `chrome.storage.local.set` をアトミックに実行。
  - 並行書き込みが発生した場合、後続は `set` 時に他の書き込みを検出し（`nc_events` 全体を再取得して nextId を確認）、nextId を再取得して再試行（最大 3 回）。
  - Service worker の single-threaded 特性により、実際の競合は稀だが、念のため実装。
- レーティング再計算中は UI を読み取り専用にし、完了時に解除。
- 異常終了時は `nc_meta.lastReplayEventId` を基点に再開。
- データはローカル保存のみ。外部送信なし。権限は最小限 (`activeTab`, `storage`, 指定 origin)。
- デバッグログには動画タイトル等が含まれるため、ユーザー操作でのみ取得可能。

---

実装中に追加決定が生じた場合は、本書の該当章を更新すること。
