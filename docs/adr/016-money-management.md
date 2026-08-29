# ADR 016: バックテスト資金管理（マネーマネージメント）

## ステータス

Accepted（v0.4.0 / Phase 4）

## コンテキスト

既存バックテストは単一銘柄・ロング専用・全額投資で、ストップロスやユニットサイジングがない。
タートルズ投資法に近い資金管理を、売買シグナルロジックから独立して導入したい（Issue #30）。
あわせて手数料の率／固定額切替、数量の整数／小数、売買方針（ロングのみ／ショートあり）も設定可能にする。

## 決定

### モジュール分離（Analysis）

資金管理は `apps/analysis/app/money_management/` に分離し、シグナル生成とは独立したサービスとしてシミュレータから呼び出す。

| モジュール | 役割 |
| ---------- | ---- |
| PositionSizing | リスク率 × 資産 ÷ (ATR×ストップ倍率) |
| RiskManagement | ドローダウン後の実効リスク率 |
| Pyramiding | 0.5ATR 間隔の同一数量追加・最大ユニット |
| DrawdownManagement | Equity High 基準の段階的リスク縮小 |
| CorrelationManagement | 相関グループの最大ユニット／最大リスク |
| Fees | レートまたは固定額（0 可）の約定手数料 |

各モジュールは個別に ON/OFF できる。マスター OFF（または未指定）かつ `longOnly` のときは従来どおり全額ロングのみ。

### 売買方針

`tradeSidePolicy`: `longOnly` | `longShort`（デフォルト `longOnly`）。

- `longOnly`: 現行どおりフラット時の売りシグナルは無視
- `longShort`: フラット時の売りでショート建玉。保有中の反対シグナルで決済し、同一バーで反転建玉可。両建てはしない

トレード `side` はロング往復 `buy`、ショート往復 `sell`。ショート PnL は `quantity * (entry - exit)`。

### 手数料・数量

- `feeMode`: `rate`（`feeRate`）または `fixed`（`feeFixed`、銘柄通貨。約定ごと）
- `allowFractionalQuantity`: false なら数量は切り捨て整数、true なら小数可

### 相関（単一銘柄制約）

現行バックテストは単一銘柄のため、相関グループは Run スナップショット内の設定として保存し、**実行銘柄が属するグループの最大ユニット／最大リスクをその銘柄の建玉に適用**する。
複数銘柄の同時保有横断制限は、将来のポートフォリオ BT 導入時の課題とする。

### 永続化

- `BacktestRun`: `tradeSidePolicy` / `feeMode` / `feeFixed` / `moneyManagementJson` / 任意で `moneyManagementStatsJson`
- `BacktestTrade`: ATR・N・リスク率・初回数量・追加回数・ストップ・ユニット数（既存 Run は null）
- エグジット理由に `atr_stop_loss` を追加

UI は開始資金横の ModelessWindow（タブ分割）で設定し、履歴から「設定をフォームへ反映」で復元する。

## 理由

- シグナルと資金管理を分離すれば、将来の Kelly 等の方式追加がしやすい
- 単一銘柄のまま相関 UI を入れることで完了条件を満たしつつ、横断制限の過剰実装を避ける
- 手数料・数量・売買方針はバックテストの現実味に直結するため同一 Phase で揃える

## 結果・制約

- MM OFF + `longOnly` は従来結果と互換
- 既存 Run の MM 列・新コスト項目は null／デフォルト（rate + 保存済み feeRate）
- ショートは日足シグナルの反転モデルであり、空売り規制・金利はモデル外
- 分足・複数銘柄同時ポートフォリオは対象外

## 関連

- [開発ロードマップ](../roadmap/v0/v0.4/v0.4.0.md) Phase 4
- [ADR 009: バックテスト拡張](009-backtest-enrichment.md)
- [Issue #30](https://github.com/KenichiroArai/market-platform/issues/30)
