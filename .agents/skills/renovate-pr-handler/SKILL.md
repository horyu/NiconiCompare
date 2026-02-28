---
name: renovate-pr-handler
description: Handle Renovate pull requests in this project. Use when asked to process a Renovate PR URL, decide whether follow-up code changes are required, run verification, and proceed through staging, user confirmation, commit/push, and merge flow.
---

# Renovate PR Handler

このスキルは `Renovate` のPR対応を標準化する。

## Input

- PR URL（例: `https://github.com/horyu/NiconiCompare/pull/8`）

## Workflow

1. PRブランチへ移動する。

- `gh pr checkout <number-or-url>` を実行する。

2. PR情報を取得する。

- `gh pr view <number-or-url> --json title,body,files,commits,headRefName,baseRefName,statusCheckRollup`
- 変更ファイルと更新内容を要約する。

3. 影響範囲を判定する。

- 種別を判定する: `security` / `replacement` / `major` / `minor|patch` / `lockfile-only`。
- 実装影響を判定する: runtime 影響か、開発ツールのみか。
- 必要に応じて `rg` で依存の使用箇所を調べる。

4. 対応要否を決定する。

- 初期判定として、修正不要/修正必要の仮説を立てる。
- 修正不要（初期判定）: 根拠を具体的に示す（例: 未使用、開発時のみ、lockfile-only）。
- 修正必要（初期判定）: 依存更新に関連する範囲で、非推奨APIの置換・型安全性向上・可読性向上などのコード改善を優先する。

5. 依存関係を同期する（必須）。

- 必ず `pnpm install --frozen-lockfile` を実行する。

6. 検証する（必須）。

- `pnpm check` を実行する。
- 失敗した場合は、依存更新に関連する範囲で `pnpm check` が通るまで修正と再実行を繰り返す。
- 依存同期と検証結果を踏まえて、修正要否の最終判定を確定する。

7. 変更をステージする（必須）。

- 追加修正を実施した場合のみ、このPR対応で修正したファイルを `git add` する。
- 追加修正なしの場合は `git add` しない。
- ユーザー確認前にコミット/プッシュは実行しない。

8. 結果を報告する。

- 最終判定（修正必要/不要）
- 最終判定の根拠
- 対応結果（修正を実施/追加修正なし）
- 実施内容（編集ファイル）
- 検証結果（`pnpm check`）
- ステージ状況

9. 追加修正ありの場合（修正必要）、ユーザーに staged changes の確認を依頼する。

- 1行英語コミットメッセージ案を提示する。
- 依頼メッセージ:
  `追加修正をステージ済みです。staged changes を確認してください。コミットとプッシュしてよいでしょうか？`

10. コミット/プッシュと、マージ確認後の後処理を行う。

- 追加修正ありの場合（修正必要）は、ユーザー承認後に Codex がコミットとプッシュを実行する。
  - `git commit -m "<proposed-message>"`
  - `git push`
- 追加修正なしの場合（修正不要）は、次の確認メッセージを提示する。
  `追加差分は不要です。このままPRをマージし、mainに戻って最新化し、ローカルのPRブランチを削除しますか？`
- 追加修正ありの場合（修正必要）は、コミット/プッシュ完了後に次の確認メッセージを提示する。
  `コミットとプッシュが完了しました。このままPRをマージし、mainに戻って最新化し、ローカルのPRブランチを削除しますか？`
- 実行内容:
  - `gh pr merge <number-or-url> --merge`
  - `git switch main`
  - `git pull --ff-only`
  - `git branch -d <headRefName>`

## Constraints

- 日本語で報告する。
- `pwsh` コマンドを使う。
- 破壊的コマンドは使わない。
- 依存更新と無関係な変更を混ぜない。
- 改善は挙動互換を維持したうえで行う。
