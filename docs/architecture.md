# NiconiCompare アーキテクチャ設計書

本書は NiconiCompare の技術アーキテクチャ、コンポーネント設計、データフローを詳述する。

---

## 1. システムアーキテクチャ概要

NiconiCompare は、Chrome/Firefox Manifest V3 対応のブラウザ拡張機能として実装され、イベントログ中心の設計と Glicko-2 レーティングアルゴリズムを組み合わせた分散型システムである。

### 1.1 アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                  ニコニコ動画 (nicovideo.jp)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Watch Page (HTML + JSON-LD)                         │   │
│  └────────────────┬─────────────────────────────────────┘   │
└───────────────────┼─────────────────────────────────────────┘
                    │ DOM監視 & メタデータ取得
                    ▼
┌─────────────────────────────────────────────────────────────┐
│            Content Script (contents/)                       │
│  - DOM Injection (オーバーレイパネル)                        │
│  - JSON-LD パース → VideoSnapshot 生成                       │
│  - 比較カードUI (React)                                      │
└────────────────┬────────────────────────────────────────────┘
                 │ chrome.runtime.sendMessage
                 ▼
┌─────────────────────────────────────────────────────────────┐
│         Service Worker (background/)                        │
│  - イベントログ管理 (CompareEvent)                            │
│  - Glicko-2 計算エンジン                                     │
│  - Storage I/O (chrome.storage.local)                       │
│  - リトライキュー & エラーハンドリング                        │
└────────────────┬────────────────────────────────────────────┘
                 │ chrome.storage.local
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           Chrome Storage Local (~10 MB)                     │
│  nc_events | nc_ratings | nc_videos | nc_authors | ...     │
└─────────────────────────────────────────────────────────────┘
                 ▲
                 │ chrome.storage.onChanged
┌────────────────┴─────────────────┬──────────────────────────┐
│  Popup (popup/)                  │  Options (options/)      │
│  - 直近イベント表示              │  - 設定編集              │
│  - overlayAndCaptureEnabled トグル │  - データ管理            │
│                                 │  - Export/Import         │
└──────────────────────────────────┴──────────────────────────┘
```

### 1.2 コンポーネント責務

| コンポーネント     | 責務                                           | 技術スタック                        |
| ------------------ | ---------------------------------------------- | ----------------------------------- |
| **Content Script** | DOM 監視、オーバーレイ UI、JSON-LD 取得        | React 18.2.0, TypeScript, Tailwind CSS v4, Plasmo CSUI |
| **Service Worker** | イベントログ管理、Glicko-2 計算、Storage I/O | TypeScript, chrome.storage API      |
| **Popup**          | 直近イベント表示、overlayAndCaptureEnabled トグル | React 18.2.0, TypeScript            |
| **Options**        | 詳細設定、データ操作、エクスポート/インポート  | React 18.2.0, TypeScript            |
| **Storage**        | 永続化層                                       | chrome.storage.local (Key-Value)  |

---

## 2. データフロー

### 2.1 比較イベント登録フロー

```
[1] ユーザーがwatch pageを訪問
     ↓
[2] Content Script: JSON-LDからメタデータ取得
     ↓ 成功
[3] VideoSnapshot/AuthorProfileをService Workerに送信
     ↓
[4] Service Worker: nc_videos/nc_authorsに保存
     ↓
[5] Content Script: オーバーレイパネルを表示
     ↓
[6] ユーザーがホバー → 比較カード展開 → 評価ボタンクリック
     ↓
[7] Content Script: CompareEventをService Workerに送信
     ↓
[8] Service Worker: nc_events.nextIdを採番 → CompareEvent生成
     ↓
[9] Storage書き込み試行
     ├─ 成功 → persistent: true, LRU更新
     └─ 失敗 → retryQueueに追加 (persistent: false)
     ↓
[10] Glicko-2即時計算 → nc_ratingsに反映
     ↓
[11] chrome.storage.onChanged通知 → Popup/Optionsが更新
```

### 2.2 リプレイフロー

```
[1] Options: 「レーティング再計算」ボタンクリック
     ↓
[2] Service Worker: nc_eventsからdisabled=falseのイベントを抽出
     ↓
[3] ID昇順でループ開始
     ├─ [3.1] VideoSnapshot/AuthorProfile取得 (nc_videos/nc_authors)
     │   ├─ 存在 → Glicko-2計算へ
     │   └─ 不在 → エラーログ記録 & スキップ
    ├─ [3.2] Glicko-2計算実行 (currentVideo vs opponentVideo)
     └─ [3.3] 計算結果をnc_ratingsに書き込み
     ↓
[4] nc_meta.lastReplayEventIdを最終イベントIDに更新
     ↓
[5] needsCleanup=trueの場合、孤立データを削除
     ↓
[6] UI更新通知 (chrome.storage.onChanged)
```

### 2.3 JSON-LD 取得失敗時のフォールバック

```
[1] Content Script: JSON-LD取得試行
     ├─ 成功 → VideoSnapshot生成
     └─ 失敗
         ↓
[2] nc_videosに該当videoIdのスナップショット存在確認
    ├─ 存在 → 既存データを使用（UIはメッセージ表示のみ）
    │         比較イベント登録は許可
     └─ 不在 → エラーメッセージ表示
               比較入力を完全抑制
     ↓
[3] エラーログ記録 (background console.error)
     ↓
[4] ユーザーはページリロードで再試行可能
```

---

## 3. イベントログ設計

### 3.1 イベント駆動アーキテクチャ

NiconiCompare は厳密なイベント再生モデルではなく、**実用的なイベントログ運用**を採用:

- **イベントログ (nc_events)**: CompareEvent を時系列で蓄積
- **マテリアライズドビュー (nc_ratings)**: 最新レーティングをキャッシュ
- **編集許容**: 過去イベントの verdict 変更や削除を許可（無効化）

### 3.2 イベント型定義

```typescript
type CompareEvent = {
  id: number; // グローバル一意ID (nextIdから採番)
  timestamp: number; // UnixタイムスタンプHIRO
  currentVideoId: string; // 比較対象 (現在動画)
  opponentVideoId: string; // 比較対象 (選択動画)
  verdict: "better" | "same" | "worse"; // currentVideo視点の評価
  disabled: boolean; // 無効化フラグ
  persistent?: boolean; // Storage書き込み完了フラグ
};
```

### 3.3 イベント ID 採番戦略

**課題**: Service Worker の並行実行による競合

**解決策**: Read-Modify-Write トランザクション

```typescript
async function allocateEventId(): Promise<number> {
  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    // [1] 現在のnextIdを読み取り
    const { nc_events } = await chrome.storage.local.get("nc_events");
    const currentNextId = nc_events.nextId;

    // [2] 新しいnextIdを書き込み (楽観的ロック)
    const newNextId = currentNextId + 1;

    // [3] 書き込み後に再取得して競合チェック
    await chrome.storage.local.set({
      nc_events: { ...nc_events, nextId: newNextId },
    });

    const { nc_events: updated } = await chrome.storage.local.get("nc_events");
    if (updated.nextId === newNextId) {
      return currentNextId; // 採番成功
    }

    // 競合検出 → リトライ
    console.warn(`ID collision detected, retrying... (${i + 1}/${MAX_RETRIES})`);
  }
  throw new Error("Failed to allocate event ID after max retries");
}
```

---

## 4. Glicko-2 レーティングシステム

### 4.1 アルゴリズム概要

Glicko-2 は、Glicko 評価システムの改良版で、以下の 3 つのパラメータを管理:

- **Rating (r)**: プレイヤーの強さ（デフォルト: 1500）
- **Rating Deviation (RD)**: 不確実性（デフォルト: 350、低いほど確実）
- **Volatility (σ)**: 変動性（デフォルト: 0.06）

### 4.2 実装詳細

**ライブラリ**: `glicko2-lite` npm パッケージ

**計算フロー**:

```typescript
type GlickoPlayer = {
  rating: number;
  rd: number;
  volatility: number;
};

function updateRatings(
  currentVideo: GlickoPlayer,
  opponentVideo: GlickoPlayer,
  verdict: "better" | "same" | "worse"
): { left: GlickoPlayer; right: GlickoPlayer } {
  const outcome = verdict === "better" ? 1 : verdict === "worse" ? 0 : 0.5;

  // Glicko-2アルゴリズム適用
  const [newCurrent, newOpponent] = glicko2.calculate(
    currentVideo,
    opponentVideo,
    outcome
  );

  return { left: newLeft, right: newRight };
}
```

### 4.3 1 Rating Period = 1 Event

通常の Glicko-2 は「期間ごと」に複数対戦を集約するが、NiconiCompare は:

- **各 CompareEvent を 1 rating period として扱う**
- 即時計算により、リアルタイムでレーティング更新
- RD の減少が速いため、初期値を高めに設定 (RD 350)

### 4.4 未確定動画の定義

**未確定動画**: RD > 100 の動画

理由:

- 初期 RD 350 → 比較を重ねると RD が低下
- RD 100 以下 = 安定したレーティング
- RD 100 超 = さらなる比較が必要

---

## 5. Storage 設計

### 5.1 Key-Value 構造

Chrome Storage Local は、Key-Value 型のストレージ（JSON シリアライズ）。

**キー命名規則**: プレフィックス `nc_` で名前空間を確保

| Key           | Value 型                                | 推定サイズ |
| ------------- | --------------------------------------- | ---------- |
| `nc_settings` | Object                                  | ~2 KB      |
| `nc_state`    | Object                                  | ~5 KB      |
| `nc_videos`   | Map<string, VideoSnapshot>              | 500 B/件   |
| `nc_authors`  | Map<string, AuthorProfile>              | 200 B/件   |
| `nc_events`   | {items: CompareEvent[], nextId: number} | 150 B/件   |
| `nc_ratings`  | Map<string, RatingSnapshot>             | 100 B/件   |
| `nc_meta`     | Object                                  | ~10 KB     |

### 5.2 データ更新の不変性管理

**ライブラリ**: `immer` を使用して Immutable な state 更新を実現

```typescript
import { produce } from "immer"

// 例: イベント追加時の不変更新
const updatedEvents = produce(events, (draft) => {
  draft.items.push(newEvent)
  draft.nextId += 1
})
```

**メリット**:
- 複雑なネストしたオブジェクトの更新が直感的
- 意図しない副作用を防止
- リプレイやロールバックが容易

### 5.3 設定値の正規化

`normalizeSettings` 関数により、不正な設定値を自動修正:

```typescript
function normalizeSettings(settings: NcSettings): NcSettings {
  return {
    ...settings,
    recentWindowSize: Math.min(
      10,
      Math.max(1, Math.floor(settings.recentWindowSize || 5))
    ),
    overlayAutoCloseMs: Math.min(
      5000,
      Math.max(500, settings.overlayAutoCloseMs || 1500)
    ),
    showEventThumbnails:
      settings.showEventThumbnails ?? DEFAULT_SETTINGS.showEventThumbnails,
    glicko: settings.glicko || DEFAULT_SETTINGS.glicko
  }
}
```

**バリデーション範囲**:
- `recentWindowSize`: 1〜10 の整数
- `overlayAutoCloseMs`: 500?5000ms
- `showEventThumbnails`: boolean
- `glicko`: 初期値の妥当性チェック

### 5.4 書き込みパフォーマンス最適化

**課題**: 頻繁な小規模書き込みは遅い

**解決策**: バッチ書き込み

```typescript
async function saveCompareEvent(event: CompareEvent) {
  const { nc_events, nc_videos, nc_authors } = await chrome.storage.local.get([
    "nc_events",
    "nc_videos",
    "nc_authors",
  ]);

  // 複数キーを1回のsetでまとめて書き込み
  await chrome.storage.local.set({
    nc_events: { items: [...nc_events.items, event], nextId: nc_events.nextId + 1 },
    nc_videos: { ...nc_videos, [event.currentVideoId]: newSnapshot },
    nc_authors: { ...nc_authors, [newSnapshot.authorUrl]: newProfile },
  });
}
```

---

## 6. UI/UX 設計

### 6.1 Content Overlay

実装は Plasmo CSUI で DOM に直接マウントされる。UI レイアウトやアニメーションは頻繁に変わるため本書では「守るべき機能要件」のみを列挙し、詳細な構造は `src/contents/overlay.ts` と `docs/ui-overlay.md`（DOM/状態まとめ）を正とする。仕様レイヤー（docs/spec.md §9.1）との関係は以下。

**不変要件（仕様で固定）**

- watch ページ右上付近に常駐し、`overlayAndCaptureEnabled` が true の間は常に比較操作が可能。
- `nc_state.recentWindow` の LRU 候補と `currentVideoId` を同一カード内で確認でき、任意のペアに対して verdict を一手で送信できる。
- verdict 送信後は `MESSAGE_TYPES.recordEvent` → `MESSAGE_TYPES.requestState` の順で state を再取得し最新 UI に追従する。
- 直前と同一の verdict を送信した場合は該当イベントを削除し、UI を再同期する。
- JSON-LD が取得できない場合はステータスメッセージ表示と verdict ボタン無効化を行い、メタデータが復旧したら自動で再有効化する。
- `overlayAndCaptureEnabled` / `overlayAutoCloseMs` は chrome.storage に保存された設定値を唯一の情報源として参照し、マウスの hover/out に応じて自動開閉できる。

**実装依存の要素（コード参照）**

- 表示位置の微調整・カードレイアウト・アクセシビリティ属性・hover での展開方法など、UI の細部は `src/contents/overlay.ts` を参照する。変更時はコードと合わせてスクリーンショット資料を更新し、仕様書では改めて定義しない。
- Select のラベル表記、ステータス文言、auto-close アニメーションなども実装ベースで運用し、アーキテクチャ文書では管理対象外とする。
- `PLASMO_PUBLIC_KEEP_OVERLAY_OPEN` が true の場合、auto-close を無効化する。

### 6.2 Popup

**サイズ**: 幅 320px、高さ可変

**レイアウト**:

```
┌────────────────────────────────────┐
│  [NiconiCompare]  [overlayAndCaptureEnabled] │ ← ヘッダー
├────────────────────────────────────┤
│  #106   [thumb]   >   [thumb]      │
│  2025/12/21                         │
│  22:29:56                           │
├────────────────────────────────────┤
│  Storage 状態                      │
└────────────────────────────────────┘
```

**補足**:
- Storage 状態として `needsCleanup` / `retryQueue` / `failedWrites` を表示する。

### 6.3 Options

**レイアウト**: タブ切り替え

```
[動画一覧] [イベント一覧] [設定] [データ操作]

<動画一覧タブ>
┌─────────────────────────────────────────────────┐
│ 検索: [_________] 投稿者: [入力/候補]  ソート: [▼] │
│ 並び順: [昇順/降順]                               │
├─────────────────────────────────────────────────┤
│ サムネ | タイトル      | 投稿者 | Rating | RD | 最終判定日時 │
│ [img]  | Example Video | Alice  | 1650   | 50 | 2025/01/01 │
│ ...                                             │
└─────────────────────────────────────────────────┘
ページネーション: < 前へ [1..N] 次へ >
```

動画一覧は最新レーティングがある動画のみ表示し、ソートは Rating / RD / タイトル / 最終判定日時。

**イベント一覧タブ**: 検索、評価フィルタ、無効化済み/サムネ表示切替、無効化/復活/評価変更/削除などの行アクションを提供。詳細は実装を参照。

---

## 7. セキュリティ設計

### 7.1 権限最小化

**manifest.json**:

```json
{
  "permissions": [
    "activeTab", // 現在のタブのみアクセス
    "storage" // chrome.storage.local
  ],
  "host_permissions": [
    "https://www.nicovideo.jp/watch/*" // ニコニコ動画のみ
  ]
}
```

**非許可項目**:

- `<all_urls>`: 全サイトアクセス（不要）
- `tabs`: タブ情報収集（不要）
- `webRequest`: ネットワーク傍受（不要）

### 7.2 Content Security Policy (CSP)

**manifest.json** (MV3 デフォルト):

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

- `'unsafe-eval'` 禁止 → XSS 対策
- インラインスクリプト禁止 → 全 JS 外部ファイル化

### 7.3 データプライバシー

- **ローカル保存のみ**: 外部サーバーへのデータ送信なし
- **デバッグログ**: タイトル/URL 含む → ユーザー操作でのみ取得可能
- **エクスポート**: 明示的な操作で JSON ダウンロード

---

## 8. エラーハンドリング

### 8.1 Storage 書き込みリトライ

**戦略**: Exponential Backoff

```typescript
const RETRY_DELAYS = [1000, 3000, 5000]; // ms

async function writeWithRetry(data: any, eventId: number) {
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    try {
      await chrome.storage.local.set(data);
      return; // 成功
    } catch (error) {
      console.error(`Write failed (attempt ${i + 1}):`, error);

      if (i < RETRY_DELAYS.length - 1) {
        await sleep(RETRY_DELAYS[i]);
      } else {
        // 3回失敗 → failedWritesに追加
        addToFailedWrites(eventId);
      }
    }
  }
}
```

### 8.2 JSON-LD 取得失敗

**原因別対応**:

| 原因                       | 対応                                  |
| -------------------------- | ------------------------------------- |
| JSON-LD 要素が存在しない   | エラーログ + 既存スナップショット使用 |
| JSON パースエラー          | エラーログ + UI に警告表示            |
| `author.url`フィールド欠損 | エラーログ + 比較入力抑制             |

### 8.3 Service Worker 停止対策

**課題**: 非アクティブ時に Service Worker が停止

**解決策**: chrome.alarms API で定期実行

```typescript
chrome.alarms.create("retryQueueCheck", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "retryQueueCheck") {
    processRetryQueue();
  }
});
```

---

## 9. パフォーマンスベンチマーク

### 9.1 目標値

| 操作                    | 目標時間 | 測定方法                       |
| ----------------------- | -------- | ------------------------------ |
| オーバーレイ表示        | < 100ms  | performance.now()              |
| 比較イベント登録        | < 200ms  | chrome.storage.local.set()     |
| リプレイ (100 イベント) | < 1s     | 全イベント走査 + Glicko-2 計算 |
| Options ページ初回表示  | < 500ms  | DOMContentLoaded               |

### 9.2 最適化手法

1. **メモリキャッシュ**: `nc_videos`/`nc_authors`を最大 100 件キャッシュ
2. **仮想スクロール**: Options のテーブルで 1000 件以上の表示時

---

## 10. 将来の拡張性

### 10.1 マルチサイト対応

**設計方針**:

- `videoId`のプレフィックスで識別 (`nico:sm12345678`, `yt:dQw4w9WgXcQ`)
- `nc_settings.enabledSites: string[]` で有効サイトを管理

### 10.2 クラウド同期

**候補技術**:

- Chrome Sync Storage (100 KB 制限) → 小規模データのみ
- Firebase Firestore → フル同期対応

**スキーマ変更**:

- `userId` フィールド追加
- 競合解決: Last-Write-Wins または Operational Transform

### 10.3 プラグインシステム

**アイデア**: カスタムレーティングアルゴリズムの追加

```typescript
interface RatingPlugin {
  name: string;
  calculate(events: CompareEvent[]): Map<string, number>;
}

// Elo, TrueSkill等を追加可能
```
