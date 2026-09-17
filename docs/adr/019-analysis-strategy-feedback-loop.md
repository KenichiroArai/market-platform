# ADR 019: 分析と戦略のコース補正ループ

## ステータス

Accepted（v0.5.0 / Phase 3）

## コンテキスト

v0.5.0 Phase 1–2 でチャート向けエントリー助言とトレードプラン（`/strategy`）、バックテストの `exitPolicy` 共有まで揃った。
一方で実行後は数値サマリー・約定理由・日次内訳をユーザーが自力で読み、閾値や損切／利確を手で直す必要があり、「次に何を試すか」が弱い（Issue #35）。

## 決定

**バックテスト結果 DTO からルールベースのインサイトと次アクションをクライアント導出し、結果タブに「結果の読み取り」パネルを置く。再実行プリセットと戦略／チャートへのディープリンクでコース補正のクローズドループを作る。AI は使わない。**

### インサイトは非永続

- 入力は既存の `BacktestRunDto`（summary / trades / exitPolicy 等）のみ
- 所見・アクションは都度計算し、DB には保存しない（[ADR 015](015-backtest-result-analysis.md) の ZIP と同様）
- 正本ロジック: Web `lib/backtest-insights.ts`、型は shared-types

### 初期ルール

| ID | 条件の概要 | 典型アクション |
| ---- | ---- | ---- |
| `few_trades` | 取引数が極端に少ない | 買い閾値を下げるプリセット |
| `force_close_heavy` | `force_close_end` 比率が高い | 利確方式（`rr_target` 等）を有効化 |
| `stop_heavy_low_wr` | 損切系 exit が多く勝率が低い | ストップ方式変更／倍数緩和 |
| `under_buyhold` | リターンが B&H を明確に下回る | 戦略画面で判定確認 |
| `high_drawdown` | 最大 DD が高い | MM リスク率を下げる |
| `high_wr_low_pf` | 勝率は高いが PF が低い | 利確を早めるプリセット |
| `ok_baseline` | 特記なし | 戦略で同条件のプラン確認 |

### アクション種別

| `kind` | 意味 |
| ---- | ---- |
| `apply_run_preset` | 実行フォーム差分を適用し、既存 `POST /backtests/run` で再実行 |
| `open_strategy` | `/strategy` へ銘柄・損切／利確方式などをクエリ引き継ぎ |
| `open_charts` | `/charts` へ銘柄・期間を引き継ぎ |

新規 Insights API は置かない。

### `exitPolicy` の永続化

再現と比較のため `BacktestRun.exitPolicyJson` を追加する（`moneyManagementJson` と同パターン）。既存 Run は `null`。

### UI 導線（最小のまとめ）

- 結果タブ: サマリー直下に Insights パネル
- `strategyHref` / クエリ初期化で BT ↔ 戦略 ↔ チャートを繋ぐ
- 分析ハブに「検証結果から見直す」枠を追加

### 分析ハブ起点の作業コンテキスト（Ph3 続き）

- 正本は URL クエリ（`analysisHref` / `chartsHref` / `strategyHref` / `backtestsHref`）
- 分析ハブで銘柄・期間を選び、各専門画面へコンテキスト付きで遷移する（巨大画面統合はしない）
- チャート／戦略／BT に共通のワークフローバー（分析に戻る・次へ）を置き、往復してもコンテキストを保持する
- バックテストは `symbolId` / `from` / `to` / 損切利確 / 資金・リスク率もクエリから初期化する

## スコープ外

- AI 理由生成・ナラティブ
- 最適化結果の自動適用・パラメータ総当たりの拡張
- トレードプラン自体の DB 永続化
- 分析／戦略／BT の単一巨大画面への統合
- ポートフォリオ横断リスク
- sessionStorage / DB への作業コンテキスト永続化

## 関連

- [開発ロードマップ v0.5.0](../roadmap/v0/v0.5/v0.5.0.md) Phase 3
- [Issue #35](https://github.com/KenichiroArai/market-platform/issues/35)
- [ADR 015: バックテスト結果の分析しやすさ](015-backtest-result-analysis.md)
- [ADR 018: 売買戦略・トレードプラン](018-trade-strategy-plan.md)
