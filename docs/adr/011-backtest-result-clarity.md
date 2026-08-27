# ADR 011: バックテスト結果の分かりやすさ

## ステータス

Accepted（v0.3.0 / Phase 6）

## コンテキスト

v0.3.0 Ph5 までで結果タブ（サマリー・エクイティ・AnalysisChart・取引履歴）は揃っている。
一方で「どの条件で実行したか」「なぜその日に買った／売ったか」が結果画面から読み取りにくく、
チャートも指標オーバーレイ込みで売買タイミングが埋もれやすい（Issue #25）。

## 決定

### 実行条件の表示

結果タブに、選択中 `BacktestRun` のスナップショットから条件パネルを出す。

- 戦略ラベル（`strategyType` + `params` → `formatStrategyLabel`）
- 指標セット名（`indicatorSetId` 解決。無ければ空欄）
- 期間・初期資金・手数料率・スリッページ率

### 約定理由コード

Analysis のロング限定シミュレータが各約定に `entryReason` / `exitReason` を付与する。
Nest は nullable 文字列として永続化し、既存 Run は null（UI は空欄）でよい。

| code | 意味 |
| ---- | ---- |
| `sma_golden_cross` / `sma_dead_cross` | SMA クロス |
| `macd_golden_cross` / `macd_dead_cross` | MACD クロス |
| `rsi_oversold` / `rsi_overbought` | RSI 閾値 |
| `force_close_end` | 期間末強制決済 |

表示文言は shared-types の `formatTradeReason` で日本語化する（DB には安定コードのみ）。
スコア判断（現状は RSI 閾値）では `entryScore` / `exitScore` に判断値を載せ、UI は「RSI売られすぎ（28.4）」形式で併記する。
SMA/MACD クロスや期間末強制決済はスコア非採用のため null（空欄）。

### 結果チャートの表示モード

結果タブのチャートに切替トグルを置く。

| モード | 既定 | 内容 |
| ------ | ---- | ---- |
| 基本＋Buy/Sell | はい | ローソク + 売買マーカーのみ |
| 指標セット＋Buy/Sell | いいえ | 実行時指標セットのオーバーレイ + 売買マーカー |

モードはセッション内 state のみ（永続化しない）。トレンドスコア背景色は `/charts` 専用。
スコア閾値での売買自体は [ADR 012](012-trend-score-backtest.md) でバックテストに載せる。

## 理由

- 条件は Run に既にあるスナップショットで足り、再計算不要
- 理由を Analysis で付与すると期間末強制決済を正確に区別できる
- 既定を基本＋売買にすると「いつ入ったか」が最優先で見え、指標確認はトグルで足りる

## 結果

- shared-types / Prisma / Nest / Analysis / Web が同一契約で理由コードを扱う
- 結果タブで条件・判断・チャート表示モードが揃う

## 関連

- [開発ロードマップ v0.3.0](../roadmap/v0/v0.3/v0.3.0.md) Phase 6
- [ADR 009: バックテスト結果の拡張と SMA 最適化](009-backtest-enrichment.md)
- [ADR 010: 指標セット起点のシグナル導出](010-signal-from-indicator-set.md)
- Issue [#25](https://github.com/KenichiroArai/market-platform/issues/25)
