---
name: implement
description: 実装タスクでは必ず使用する。設計→承認→実装→レビュー→必要なら修正を自動で進める。
---

コードは自分で書かず、サブエージェントのみを使用してください。

## タスク

$ARGUMENTS

## フロー

### Phase 0: 設計（designer は条件付き）

**判断: designer サブエージェントを使うか、Claude 自身が設計するか。**
- **designer を使う**（設計が非自明なとき）: 方向が未確定・曖昧、複数案を比較したい、仕様がゼロから、または Claude が対象ファイルの現状を十分に把握できていない。
- **designer を省略**（設計が自明なとき）: 承認済みモック/明確な仕様があり、かつ Claude が対象コードを十分把握している。この場合は Claude 自身がタイトな設計方針を起こす（コードは書かない。あくまで実装方針まで）。
- 迷ったら designer を使う側に倒す。

共通:
- `CLAUDE.md` は毎回渡さない。DB・認証・RLS・OCR・カテゴリー・集計・仕様判断に関わる場合のみ、必要な節だけ渡す
- 設計方針をユーザーに提示し、承認を得る（designer 使用有無に関わらず）
- 承認されるまで次へ進まない

**安全網は Phase 1–2 に集約する: 実装は必ず implementer、レビューは必ず codex-review + validator。ここは designer の有無に関わらず絶対に省略しない。**

### Phase 1: 実装
- `implementer` を実行
- 設計方針を渡す
- スコープ外の変更は禁止
- 完了後、変更ファイル一覧を受け取る

### Phase 2: レビュー（codex-review → validator 精査）
1. `mcp__codex-review__review_current_diff` を実行する（旧 `reviewer` サブエージェントは使わない）
   - `repo_path`: リポジトリのルート（このプロジェクトでは `/Users/daikisaito/dev/living-expenses`）
   - `doc_paths`: 毎回固定では渡さない。変更内容から必要と判断した場合のみ、関連ドキュメントを最小限渡す
      - 原則: 軽微なUI修正・文言修正・局所的なリファクタは `doc_paths` なし
      - 渡す場合: 要件・設計・DB・認証・RLS・権限・データ構造・API契約に関わる変更
      - 例: `["CLAUDE.md"]`、`["docs/database.md"]`、`["docs/architecture.md", "docs/database.md"]`
      - 判断に迷う場合は、少ない方を選ぶ
   - MCPサーバーでgit diff を取得するため、Claude 側で diff 本文を渡さない（トークン節約）
   - ユーザーから「プロジェクト全体をレビュー」等の明確な指示があるときのみ `mcp__codex-review__review_whole_project` を使う
2. `reviewer-validator` を実行し、codex-review の指摘を精査させる（維持・降格・却下／重要度調整）
   - 入力: codex-review の出力（指摘一覧）＋変更ファイル一覧・実装概要
   - validator が必要に応じて実ファイルを確認して妥当性を判断する
3. validator 精査後の結果（Critical/Warning/Suggestion）を Phase 3 の判定に使う
- 旧 `reviewer` / `reviewer-*`（5専門レビュアー）は使わない。レビュー本体は codex-review に置換済み
- 必要なら Warning / Suggestion を `docs/review-notes.md` に追記してよい（任意・git 管理対象外）

### Phase 3: 判定
- Critical が0件なら完了
- 1件以上なら Phase4

### Phase 4: 修正
- `implementer` に Critical のみ渡して修正
- 修正後は再レビュー（再度 `mcp__codex-review__review_current_diff`）
- 最大2ループまで

### Phase 5: 完了

```
【実装完了 ✅】
- ループ回数:
- 変更ファイル:
- 最終レビュー:
- 概要:
- 残Warning:
```

## ルール

- commit / push は行わない
- Warning はループ条件にしない
- Phase0以外は自律実行
