# NiconiCompare アーキテクチャ

本書は、現在の実装における構成、データフロー、永続化設計を説明します。ユーザーに見える挙動は [機能仕様](spec.md) を参照してください。

## 構成

NiconiCompare は WXT で構築した Manifest V3 ブラウザ拡張機能です。

```text
ニコニコ動画 watch ページ
  └─ Content Script / Overlay
       └─ sendNcMessage
            └─ Background Service Worker
                 ├─ handlers: メッセージ単位の処理
                 ├─ services: storage・cleanup
                 └─ utils: 正規化・集約・レーティング再構築
                      └─ chrome.storage.local

Popup / Options
  └─ sendNcMessage / chrome.storage.onChanged
       └─ Background Service Worker / chrome.storage.local
```

| 領域              | 責務                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `src/entrypoints` | WXT の background、content script、Popup、Options エントリポイント |
| `src/contents`    | watch ページの監視、動画情報取得、比較オーバーレイ                 |
| `src/background`  | メッセージ処理、イベント・レーティング・Storage の更新             |
| `src/popup`       | 直近イベントの表示と簡易設定                                       |
| `src/options`     | 一覧、設定、カテゴリ、データ操作                                   |
| `src/lib`         | 型、定数、メッセージ、共通処理                                     |

UI から Background への操作は `sendNcMessage` を介し、メッセージ型を共有します。永続データの更新は Background に集約します。

## 主なデータフロー

### 動画情報の登録

1. Content Script が watch ページの URL と JSON-LD を監視する。
2. `VideoSnapshot` と `AuthorProfile` を Background へ送る。
3. Background が `nc_videos` と `nc_authors` を更新し、現在動画と比較候補を更新する。

JSON-LD を取得できない場合、Content Script は保存済み `VideoSnapshot` の有無を確認し、比較を継続できるか判断します。

### 比較イベントの登録

1. Overlay が現在動画、比較対象、判定、直前イベント ID を送る。
2. 同一の比較操作を継続している場合は既存イベントの判定と日時を更新し、レーティングを再構築する。
3. それ以外は `nc_events.nextId` を使って新規イベントを追加する。
4. アクティブカテゴリのレーティングと `recentWindow` を更新する。
5. Storage の変更を Popup、Options、Overlay が監視して表示を更新する。

### レーティング再構築

- 有効なイベントを ID 順に処理し、カテゴリ別に Glicko-2 レーティングを再計算する。
- イベントの無効化、復活、判定変更、削除、インポート、Glicko-2 初期値変更時に再構築する。
- 各イベントを 1 rating period として扱う。

## 永続化

永続データは `chrome.storage.local` に保存します。

| Key             | 内容                                                           |
| --------------- | -------------------------------------------------------------- |
| `nc_settings`   | 表示、比較候補数、アクティブカテゴリ、Glicko-2 初期値          |
| `nc_state`      | 現在動画、ピン留め対象、直近比較候補                           |
| `nc_videos`     | videoId ごとの動画スナップショット                             |
| `nc_authors`    | authorUrl ごとの投稿者情報                                     |
| `nc_events`     | 比較イベントと次のイベント ID                                  |
| `nc_ratings`    | カテゴリ・動画ごとの最新レーティング                           |
| `nc_categories` | カテゴリ本体、並び順、オーバーレイ表示対象                     |
| `nc_meta`       | スキーマバージョン、最終再計算イベント、最終クリーンアップ日時 |

型定義と既定値は `src/lib/types.ts` と `src/lib/constants.ts` を正とします。

Storage 更新には `withStorageUpdates` を使用し、必要なキーを読み込んで更新結果をまとめて書き込みます。ネストしたデータの更新には Immer を使用します。

## イベントとレーティング

`CompareEvent` は、イベント ID、日時、現在動画、比較対象、判定、無効化フラグ、カテゴリ ID を持ちます。

- イベントは編集・無効化を許容する実用的なイベントログとして扱う。
- `nc_events` を再生すれば `nc_ratings` を再構築できる。
- `nc_ratings` は読み取りを高速化するための派生データであり、インポート時には再生成する。
- イベント ID は Background が `nc_events.nextId` から採番する。永続データの更新を Background に集約し、同一拡張内の書き込み経路を限定する。

## カテゴリ

- 1イベントは1カテゴリに属する。
- `nc_settings.activeCategoryId` が新規イベントのカテゴリを決める。
- `nc_ratings` は `categoryId -> videoId -> RatingSnapshot` の構造を持つ。
- カテゴリ削除時は、所属イベントを別カテゴリへ移動するか破棄する。

## クリーンアップとインポート

- Background は起動時に自動クリーンアップの要否を確認し、`chrome.alarms` が利用可能な場合は 24 時間周期でも確認する。
- クリーンアップは、イベント、現在動画、比較候補、ピン留め対象から参照されないデータを削除する。
- JSON インポートではデータを正規化し、イベント ID とレーティングを再構築する。
- `nc_meta.schemaVersion` でインポートデータの互換性を判断する。

## エラー処理

- Background と UI は `src/lib/errorHandler.ts` の共通処理を使用する。
- Storage 更新失敗は呼び出し元へ返し、UI でユーザーへ通知する。
- エラーログの context は `bg:*` または `ui:*` のプレフィックスを使用する。
- 書き込み失敗時のリトライキューは持たず、ユーザーが再操作できる状態を維持する。

## セキュリティ

- 権限は `storage` と `https://www.nicovideo.jp/watch/*` に限定する。
- データは `chrome.storage.local` に保存し、外部サーバーへ送信しない。
- エクスポートはユーザーの明示操作でのみ実行する。
