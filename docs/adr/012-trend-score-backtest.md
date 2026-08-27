# ADR 012: トレンドスコアによるバックテスト売買

## ステータス

Accepted（v0.3.0 / トレンドスコア戦略）

## コンテキスト

チャート分析（ADR 007）はサーバ側の固定採点セットで -100〜+100 のトレンドスコアを出す。
一方バックテスト（ADR 010）は IndicatorSet から SMA / MACD / RSI だけを導出し、スコアとは別系統だった。
結果として「チャートで見たスコア」と「バックテストの売買」が一致せず、スコア閾値での検証ができなかった。

## 決定

**バックテストに `trendScoreThreshold` 戦略を追加し、チャートと同系のトレンドスコア系列で閾値クロス売買できるようにする。**

### 実行モード（`RunBacktestRequest.signalMode`）

| mode | 売買 | 指標セット |
| ---- | ---- | ---------- |
| `trendScore`（UI 既定） | 固定採点セットの総合スコア閾値クロス | 任意（結果チャートのオーバーレイのみ） |
| `indicatorSet` | `resolveSignalRule`（SMA 2 本 / MACD / RSI） | 必須・シグナル導出可能であること |

### 閾値（既定）

ADR 007 の状態ラベル境界に揃える。

- 買い: 総合スコアが `buyThreshold`（既定 37.5＝上昇トレンド）を下から上へクロス
- 売り: 総合スコアが `sellThreshold`（既定 -42.5＝レンジだがやや下向き）を上から下へクロス

パラメータは Run スナップショットに保存する（`TrendScoreThresholdParams`）。

### lookback

チャートの `GET .../trend-score` と同様、採点カタログの lookback 付き日足を Analysis に渡し、`rangeStartIndex` 以降のみ売買・エクイティを計上する。

### 約定理由

| code | 意味 |
| ---- | ---- |
| `score_cross_up` | 買い閾値へのクロス |
| `score_cross_down` | 売り閾値へのクロス |

`entryScore` / `exitScore` にその時点の総合スコアを載せる。UI は既存の「ラベル（値）」形式。

### 非対象

- シグナル定義 CRUD に `trendScoreThreshold` は載せない（実行時戦略のみ）
- 結果チャートへのトレンドスコア背景色は別途（本 ADR では Buy/Sell と理由表示まで）

## 理由

- 採点セットをチャートと共有することで「見たスコアで検証」できる
- 指標セット起点（ADR 010）は残し、単一指標シグナルとの比較も可能にする
- lookback を揃えないと表示初日のスコアがチャートとずれる

## 結果

- shared-types: `trendScoreThreshold` / `BacktestSignalMode` / `resolveTrendScoreSignalRule`
- Prisma: `SignalStrategyType.TREND_SCORE_THRESHOLD`
- Analysis: スコア系列 → シグナル + decision score、`rangeStartIndex`
- Nest / Web: `signalMode=trendScore` で実行

## 関連

- [ADR 007: トレンドスコア](007-trend-score.md)
- [ADR 010: 指標セット起点のシグナル導出](010-signal-from-indicator-set.md)
- [ADR 011: バックテスト結果の分かりやすさ](011-backtest-result-clarity.md)
- [開発ロードマップ v0.3.0](../roadmap/v0/v0.3/v0.3.0.md)
