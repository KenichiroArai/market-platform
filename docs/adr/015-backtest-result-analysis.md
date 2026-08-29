# ADR 015: バックテスト結果の分析しやすさ

## ステータス

Accepted（v0.4.0 / Phase 3）

## コンテキスト

v0.3.0 / [ADR 011](011-backtest-result-clarity.md) / [ADR 012](012-trend-score-backtest.md) までで、結果タブの条件表示・約定理由・トレンドスコア売買は揃っている。
一方で期間初期値がチャートとずれやすい、エクイティの読み方が説明不足、トレンドスコア時の指標別内訳が結果から追えない、日次の突き合わせが手作業になりやすい、という課題がある（Issue #29）。

## 決定

### 実行期間の初期値共有

`/backtests` の検証期間初期値は、チャート分析と同じ `defaultChartFromDate` / `defaultChartToDate`（`chart-date-range`）を使う。

### エクイティカーブのホバー説明

見出し横に汎用 `HoverHelp` を置き、戦略／Buy & Hold の意味をホバー／フォーカスで表示する（`BacktestEquityHelp`）。

### スコア内訳と日次スコアの永続化

| 場所 | フィールド | 説明 |
| ---- | ---------- | ---- |
| `BacktestTrade` | `entryScoreBreakdown` / `exitScoreBreakdown` | エントリー／エグジット時点のトレンドスコア内訳 Json。非トレンド・既存 Run は null |
| `BacktestEquityPoint` | `decisionScore` | その日の判断に使った総合スコア。非トレンド・既存 Run は null |
| `BacktestEquityPoint` | `scoreBreakdown` | その日のトレンドスコア内訳 Json。非トレンド・既存 Run は null |

Analysis が算出し、Nest が永続化・DTO で返す。

### UI のスコア列

- 取引履歴: 総合スコア列（エントリー／エグジット）
- `trendScoreThreshold` 時はグループ寄与列（`scoreGroupCategoryIds`）と `scoringCatalogIds` の各指標についてエントリー／エグジット列を追加（内訳 Json から表示）
- 日次データタブ: `equityPoints` × 価格の明細表。`decisionScore` に加え `scoreBreakdown` からグループ寄与・指標列を表示

### 日次詳細 ZIP（クライアント生成）

新規エクスポート API は置かない。Web が既存の run 詳細・価格を使い、`fflate` で ZIP を生成してダウンロードする。ダウンロード導線は主に「日次データ」タブ。

| ファイル | 内容 |
| -------- | ---- |
| `daily_detail.csv` | 日次の価格・エクイティ・`decisionScore`・`group_*`・指標 ID 列を結合した主表 |
| `summary.csv` / `trades.csv` / `prices.csv` | 補足（trades は `entry_group_*` / `exit_group_*` と指標列も平坦化） |

## 理由

- 期間・説明・内訳・日次突き合わせを UI 側で揃えれば、分析の往復が減る
- 内訳と `decisionScore` を永続化すれば、再計算なしで過去 Run を再表示・エクスポートできる
- ZIP をクライアント生成にすれば API 面を増やさず、既存詳細取得で足りる

## 結果・制約

- 既存 Run（マイグレーション前）の内訳・`decisionScore` / `scoreBreakdown` は null（UI / CSV は空欄）
- エクスポート専用エンドポイントは追加しない
- 分足・月足・リアルタイムは対象外

## 関連

- [開発ロードマップ](../roadmap/v0/v0.4/v0.4.0.md) Phase 3
- [ADR 011: バックテスト結果の分かりやすさ](011-backtest-result-clarity.md)
- [ADR 012: トレンドスコアによるバックテスト売買](012-trend-score-backtest.md)
- [Issue #29](https://github.com/KenichiroArai/market-platform/issues/29)