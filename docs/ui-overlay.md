# Content Overlay Implementation Snapshot

**Last Updated**: 2025-12-20

オーバーレイ UI は `src/contents/overlay.tsx` に React + Tailwind CSS v4 で実装されている。仕様書では不変要件のみを定義しており、本ドキュメントでは実装の現状を素早く把握できるよう、コンポーネント構造と状態管理、ソース参照ポイントをまとめる。UI 変更時はこのファイルを更新し、仕様との齟齬を防ぐ。

## 参考ソース

- メイン実装: `src/contents/overlay.tsx` (React Functional Component)
  - 状態管理: useState/useEffect/useRef による React hooks パターン
  - スタイリング: Tailwind CSS v4 utility classes
  - CSS注入: PlasmoGetStyle による data-text import
  - JSON-LD 監視と state 更新: extractVideoDataFromLdJson, observeLdJsonChanges
  - verdict 送信と UI 更新: submitVerdict, refreshState
  - auto-close・overlayEnabled の制御: useEffect による自動制御

> 最新の実装詳細はソースコードを直接参照すること。

## コンポーネント構造

```tsx
<Overlay> // Plasmo CSUI React Component
  <div className="fixed top-0 right-0 z-[2147483647] ...">
    <strong>NiconiCompare</strong>
    {statusMessage && <span>{statusMessage}</span>}
    {showControls && (
      <div> // verdict buttons + video comparison grid
        <button onClick={submitVerdict('better')}>再生中の動画</button>
        <button onClick={submitVerdict('same')}>引き分け</button>
        <button onClick={submitVerdict('worse')}>選択中の動画</button>
        // Video thumbnails + labels + custom select
      </div>
    )}
  </div>
</Overlay>
```

- Tailwind CSS utility classes でスタイリング（`fixed`, `top-0`, `right-0`, `z-[2147483647]` など）
- verdict ボタンは 3 つ（再生中/引き分け/選択中）で、`submitVerdict` を通じて background へ送信
- verdict ボタンは最後に押したものが選択状態になり、`currentVideoId` の切替時に解除される
- Select は `opacity-0` で透明化し、`label` 内の `span` と重ねる構造。候補ラベルは `{index}. videoId | title`
- 状態: `useState` で currentVideoId, recentWindow, selectedLeftVideoId, videoSnapshots, lastVerdict を管理

## 状態管理と通信

- **状態**: React hooks (`useState`, `useRef`) で管理
  - currentVideoId, recentWindow, selectedLeftVideoId, overlaySettings, videoSnapshots
  - autoCloseTimerRef, observerScheduledRef による参照保持
- **Storage監視**: `useEffect` + `chrome.storage.onChanged` で settings/videoSnapshots の変化に追従
- **JSON-LD監視**: `MutationObserver` + `requestIdleCallback` で watch page の metadata 変更を検知
  - 取得成功時は `registerSnapshot` & `updateCurrentVideo` メッセージを送信
- **State同期**: `refreshState` → `MESSAGE_TYPES.requestState` で最新状態を取得
- **Verdict送信**: `submitVerdict` → `MESSAGE_TYPES.recordEvent` 送信後、state を再取得して UI 更新

> スクリーンショットは任意で別資料にまとめる。必要に応じて Captured UI へのリンクを追加してよいが、このドキュメントではテキスト記述のみを保持する。
