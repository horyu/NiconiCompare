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
- changelog から、breaking change・非推奨・設定変更・新機能などの変更点を確認する。
- changelog だけで差分の中身が十分に分からない場合は、`gh api repos/<owner>/<repo>/compare/<base>...<head> --jq '{commits: [.commits[].commit.message], files: [.files[] | {filename: .filename, status: .status, patch: .patch}]}'` のように `--jq` を使って、必要な差分情報だけを確認する。

3. 依存関係を同期する。

- 必ず `pnpm install --frozen-lockfile` を実行する。
- 依存同期に失敗した場合は、失敗内容と想定原因を簡潔に報告し、ユーザーの反応を待つ。

4. `main` との差分を確認し、必要なら PR ブランチを最新化する。

- `package.json` または `pnpm-lock.yaml` を更新するPRでは、依存同期の直後に `main` との差分を確認し、`main` で既に上げた依存バージョンをこのPRブランチが巻き戻していないかを早めに確認する。
- 依存巻き戻しが見つかった場合は、更新内容の評価を続ける前に「PRブランチが古く、`main` の依存更新を巻き戻す」ことを明確に報告し、ユーザー確認を挟んだうえで以下を実施する。
  - `git pull origin main`
  - conflict が出た場合は、その場で解消せず Renovate の rebase/retry に委ねる方針を報告して停止する
  - `pnpm install --frozen-lockfile`
  - `git push origin <pr-branch>`

5. 影響範囲を判定する。

- 種別を判定する: `security` / `replacement` / `major` / `minor|patch` / `lockfile-only`。
- 実装影響を判定する: runtime 影響か、開発ツールのみか。
- changelog を踏まえ、このプロジェクトの既存コード・設定・story・テストに影響がないか確認する。
- 必要に応じて `rg` で依存の使用箇所を調べる。

6. 対応要否を判定し、必要な変更を実施する。

- changelog、使用箇所、依存同期後の状態を踏まえて、追加修正の要否を判断する。
- 影響がない場合は、根拠を具体的に示せる状態にする（例: 未使用、開発時のみ、lockfile-only、changelog 上も該当機能に影響なし）。
- 影響がある場合は、既存コードが壊れないよう、依存更新に必要な追随修正を行う。
- そのうえで、新しいAPI・型・設定を使うことで既存コードの可読性向上やコード総量削減ができる場合は、依存更新に関連する範囲に限って改善を取り込む。

7. 検証する（必須）。

- `pnpm check` を実行する。
- 失敗した場合は、依存更新に関連する範囲で `pnpm check` が通るまで修正と再実行を繰り返す。
- 依存同期と検証結果を踏まえて、追加修正の要否を確定する。

8. 変更をステージする（必須）。

- 追加修正を実施した場合のみ、このPR対応で修正したファイルを `git add` する。
- 追加修正なしの場合は `git add` しない。
- ユーザー確認前にコミット/プッシュは実行しない。

9. 結果を報告する。

- 対応判断（追加変更あり/なし）
- 根拠
- 実施内容（編集ファイル）
- 検証結果（`pnpm check`）

10. 追加変更ありの場合、ユーザーに staged changes の確認を依頼する。

- 1行英語コミットメッセージ案を提示する。
- 依頼メッセージ:
  `追加修正をステージ済みです。staged changes を確認してください。コミットとプッシュしてよいでしょうか？`

11. コミット/プッシュと、マージ確認後の後処理を行う。

- 追加変更ありの場合は、ユーザー承認後に Codex がコミットとプッシュを実行する。
  - `git commit -m "<proposed-message>"`
  - `git push`
- 追加変更なしの場合は、次の確認メッセージを提示する。
  `追加差分は不要です。このままPRをマージし、mainに戻って最新化しますか？`
- 追加変更ありの場合は、コミット/プッシュ完了後に次の確認メッセージを提示する。
  `コミットとプッシュが完了しました。このままPRをマージし、mainに戻って最新化しますか？`
- 実行内容:
  - `gh pr merge <number-or-url> --merge --delete-branch`
  - `git switch main`
  - `git pull --ff-only`

## Constraints

- 日本語で報告する。
- `pwsh` コマンドを使う。
- 破壊的コマンドは使わない。
- 依存更新と無関係な変更を混ぜない。
- 改善は挙動互換を維持したうえで行う。
