# ADR 009: バックテスト結果の拡張と SMA 最適化

## ステータス

Accepted（v0.3.0 / Phase 2）

## コンテキスト

v0.1 Phase 5 でシグナル定義・ロング限定バックテスト・結果永続化は揃っている。
一方で Web は開始資金固定・結果の平文表示のみで、Issue #21 が求める検証 UX（マーカー・エクイティ・統計・Buy&Hold・最適化）が不足していた。

計算は Analysis、永続化は Nest、表示は Web という既存責務は維持する。

## 決定

### 拡張サマリー

`BacktestSummary` / `BacktestRun` に次を追加し、実行時に Analysis が算出し Nest が永続化する。

| フィールド | 定義 |
| ---------- | ---- |
| `sharpeRatio` | 日次エクイティ収益率の年率シャープ（リスクフリー 0、×√252）。点数が不足または標準偏差 0 なら 0 |
| `profitFactor` | 勝ちトレード純損益合計 / \|負け合計\|。負け 0 かつ勝ちありなら勝ち合計（無限大の代わり）。勝ちなしなら 0 |
| `buyHoldReturnRate` / `buyHoldFinalEquity` | 初日終値で全額買い・末日終値で評価（fee/slippage なし） |

既存の `finalEquity` / `totalReturnRate` / `maxDrawdownRate` / `totalTrades` / `winRate` は維持する。

### Buy & Hold 比較の描画

エクイティチャート上の Buy & Hold 曲線は、Web が `initialCash` と日足終値から再構成する（系列の永続化はしない）。

### SMA 最適化

- Analysis: `POST /backtests/optimize`
- Nest: `POST /backtests/optimize`（価格取得 → Analysis 委譲）
- 対象は `smaCross` のみ。既定レンジは `5 ≤ short < long ≤ 50`
- 各組み合わせで既存シミュレーションを再利用し、`totalReturnRate` 降順で返す
- **中間結果は DB に保存しない**（ランキングのみ。通常の `POST /backtests/run` とは分離）

### Web

`/backtests` に開始資金入力・戦略パラメータフォーム・マーカー付き分析チャート・エクイティ・サマリーカード・取引履歴・最適化結果表を載せる。価格チャートは `/charts` と同じ `AnalysisChart` を共用する（v0.3.0 Ph5）。

## 理由

- サマリー列を永続化すると、一覧再取得時に再計算不要で既存 `BacktestRun` の扱いと揃う
- 最適化の全組み合わせ永続化は件数が多い（最大約 1035）ため、最小実装ではランキング応答に留める
- Buy & Hold 曲線は価格と開始資金から一意に決まるため、DB 重複を避ける

## 結果

- shared-types / Prisma / Nest / Analysis / Web が同一契約で拡張サマリーを扱う
- 手数料・スリッページの UI 編集は対象外（既定 0.001 のまま）

## 関連

- [開発ロードマップ v0.3.0](../roadmap/v0/v0.3/v0.3.0.md) Phase 2
- [ADR 004: テクニカル分析](004-technical-analysis.md)
- Issue [#21](https://github.com/KenichiroArai/market-platform/issues/21)
