# ドキュメント運用ルール

本ガイドは NiconiCompare のドキュメント責務と更新ルールを定義する。

## 各文書の責務

- `docs/spec.md`: 機能仕様（ユーザーに見える挙動）
- `docs/architecture.md`: 技術設計（データフロー・責務分担）
- `docs/developer-guide.md`: 開発手順（環境構築・ビルド・テスト）
- `README.md`: プロジェクト概要・クイックスタート・ドキュメントリンク

## 内容の重複禁止ルール

- 機能仕様は `docs/spec.md` のみに記載する
- 技術設計は `docs/architecture.md` のみに記載する
- 開発手順は `docs/developer-guide.md` のみに記載する
- `README.md` は要約とリンクのみを記載する

## 更新ルール

- 新機能追加・UI挙動変更: `docs/spec.md` を更新する
- 設計変更・データフロー変更: `docs/architecture.md` を更新する
- ツール/環境/コマンド変更: `docs/developer-guide.md` を更新する
- 文書責務や導線の変更: `README.md` と `docs/README.md` を更新する

## 変更時チェックリスト

1. 変更内容に対応する正しい文書だけを更新したか
2. 同じ内容を複数文書に重複記載していないか
3. 参照リンク（相対パス・見出しアンカー）に切れがないか
4. 実装と文書の挙動説明に齟齬がないか
