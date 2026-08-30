# ADR 017: チャート分析への資金管理とエントリー助言

## ステータス

Accepted（v0.5.0 / Phase 1）

## コンテキスト

v0.4.0 でバックテスト専用のマネーマネージメント（ADR 016）を導入したが、チャート分析（ADR 005）では売買タイミングの判定やストップ／ピラミッド水準の可視化がない。
Issue #32 により、チャート上で「今がエントリーか」「待つ場合の予測」「建玉時の手仕舞い・追加水準」を提示する必要がある。

## 決定

**チャート分析画面 `/charts` に MM 設定とエントリー助言 API を追加し、基準日時点の判定結果をパネルと価格線で表示する。**

### シグナル正本

チャート画面の現行設定を正本とする（保存済みセット呼び出し後も editor 内容が正本）。

1. `resolveSignalRule`（SMA / MACD / RSI）が非 null → そのルール
2. 未確定時 → `trendScoreThreshold`（チャートの `buyThreshold` / `sellThreshold` + 配点・パラメータ）

### 基準日

既存の `baseDate`（未指定時は直近有効スコア日）を「現時点」とする。

### エントリー状態（`entryTiming`）

基準日までシグナル履歴を走査（売買方針・MM ストップはバックテストと同系）:

| 値 | 意味 |
| ---- | ---- |
| `in_position` | 建玉あり（シグナル履歴から推定） |
| `entry_now` | フラット + 基準日にエントリーシグナル |
| `wait` | フラット + シグナルなし |
| `no_rule` | シグナル spec 構築不可（稀） |

建玉があるときは実建玉、フラットかつシグナル時は基準日 close を仮想エントリーとして MM 水準を算出する。

### MM 計算

`MoneyManagementService` を再利用。`initialCash` を equity とし、チャート上は DD 履歴なし（`equity_high = equity`）。
ピラミッド水準は `next_pyramid_level_price` で unit 2〜maxUnits を列挙し、現在価格との `reached` を付与。

### API

| 層 | エンドポイント |
| ---- | -------------- |
| Nest | `GET /symbols/:symbolId/entry-advice` |
| Analysis | `POST /analysis/entry-advice` |

クエリは indicators / trend-score と同様の期間・足種・指標パラメータ・配点に加え、`baseDate` / `initialCash` / `tradeSidePolicy` / `moneyManagement`（JSON）を受け取る。

### 予測エントリー（`wait` 時）

表示範囲内で次のシグナル発生日を探索し、併せて直近バーの線形外挿で参考日・価格ヒントを付与する。
**外挿は参考値であり確定予測ではない** — UI で「推定」と明記する。

### UI

- MM 設定: バックテストと同一の `BacktestMoneyManagementPanel` を ModelessWindow で再利用
- エントリー助言パネル: `entryTiming` 別表示
- チャート: ストップ（赤）・ピラミッド（青）・予測エントリー（黄）の価格線

## スコープ外

- チャート↔バックテストの MM 設定永続化
- 複数銘柄横断の相関キャップのリアルタイム反映
- 自動売買・注文執行

## 関連

- [開発ロードマップ v0.5.0](../roadmap/v0/v0.5/v0.5.0.md) Phase 1
- [Issue #32](https://github.com/KenichiroArai/market-platform/issues/32)
- [ADR 005: チャート分析](005-chart-analysis.md)
- [ADR 016: バックテスト資金管理](016-money-management.md)
