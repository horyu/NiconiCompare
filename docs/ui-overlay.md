# Content Overlay Implementation Snapshot

**Last Updated**: 2025-12-20

オーバーレイ UI は `src/contents/overlay.ts` に実装されており、仕様書では不変要件のみを定義している。本ドキュメントでは実装の現状を素早く把握できるよう、DOM 構造と状態遷移、ソース参照ポイントをまとめる。UI 変更時はこのファイルを更新し、仕様との齟齬を防ぐ。

## 参考ソース

- メイン実装: `src/contents/overlay.ts`
  - ルート DOM / スタイル定義: 行 23-120
  - 比較カード（グリッド/Select/ボタン）: 行 121-250
  - JSON-LD 監視と state 更新: 行 258-420
  - verdict 送信と UI 更新: 行 430-520
  - auto-close・overlayEnabled の制御: 行 583-612

> 最新の行番号は `rg -n` 等で検索して確認すること。

## DOM 概要

```
<div id="nc-compare-overlay">
  <strong>NiconiCompare</strong>
  <span data-role="status" />
  <div data-role="controls">
    <div data-role="comparison-grid">
      [current video button + thumbnail + label]
      [draw button + vs label]
      [selected video button + thumbnail + select]
    </div>
  </div>
</div>
```

- ルートは `position: fixed; top: 0; right: 0; z-index: 2147483647`。
- verdict ボタンは 3 つ（再生中/引き分け/選択中）で、`submitVerdict` を通じて background へ送信。
- Select は透明化して `span` と重ねる構造。候補ラベルは `{index}. videoId | title`。

## 状態と通信

- `refreshState` → `MESSAGE_TYPES.requestState` で settings/state/events/ratings/meta を取得。
- `chrome.storage.onChanged` を購読し、settings/videSnapshots の変化に追従。
- JSON-LD を `MutationObserver` + `requestIdleCallback` で監視。取得成功時は `registerSnapshot` & `updateCurrentVideo` メッセージを送信。
- verdict 送信後は state を再取得して LRU / Select を更新。

> スクリーンショットは任意で別資料にまとめる。必要に応じて Captured UI へのリンクを追加してよいが、このドキュメントではテキスト記述のみを保持する。
