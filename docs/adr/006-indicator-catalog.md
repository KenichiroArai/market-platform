# ADR 006: テクニカル指標カタログ

## ステータス

Accepted（v0.2.0 / Phase 3）

## コンテキスト

v0.1.0 では SMA / EMA / RSI / MACD の 4 種と、レスポンスの固定キー（`sma` / `ema` など）で足りていた。
v0.2.0 Phase 3 で分類付きの指標カタログ（複数期間 MA、バンド、一目、出来高系、フィボナッチ、Volume Profile）を載せるにあたり、1 タイプ 1 キーでは系列を表現できない。
エリオット波動のような主観的パターン認識を同じ API に載せるかも未定だった。

## 決定

**指標の正本は `packages/shared-types` のカタログ ID とし、時系列は `values` マップ、フィボナッチ / Volume Profile は `drawings` で返す。**

- カタログ ID（例: `sma25`, `bb`, `ichimoku`）が UI トグル・GET クエリ・lookback の単一ソース
- 分類: トレンド / モメンタム / オシレーター / ボラティリティ / 出来高 / サイクル。同一指標が複数分類に出ても ID は一つ
- GET `indicators` 省略時はおすすめ構成（SMA 25/75/200・MACD・RSI・ボリンジャー・OBV・一目）
- パラメータの自由入力はしない。カタログ既定値のみ
- 生出来高ヒストグラム（`volume`）は価格バーから描画し、analysis には送らない
- エリオット波動（`elliott`）は説明のみ。計算要求は `VALIDATION_FAILED`
- VWAP / フィボナッチ / Volume Profile は表示期間（`rangeStartIndex` 以降）だけを対象にする
- 一目の先行スパンは 26 本先にずらす。レスポンスは表示開始より前を切り、雲の未来点は残す
- 計算ライブラリは引き続き pandas + numpy のみ（ADR 004）
- シグナル / バックテストの戦略セットは変更しない

## 理由

- 複数 SMA やバンド 3 本を固定フィールドで増やすと、追加のたびに契約が壊れる
- カタログを TS 正本に置くことで、Nest の許可リストと Web の分類 UI がずれない
- フィボナッチと Volume Profile は日付整列の系列ではないため、`drawings` に分離した方が描画とテストが単純
- エリオットの自動カウントは再現性が低く、Phase 3 の品質要件（数値固定の単体テスト）に合わない

## 結果・制約

- `GET /symbols/:id/indicators` と analysis `POST /indicators` は破壊的変更（固定キー廃止）
- 指標パラメータの UI 編集は対象外（ADR 005 の延長）
- 分足・月足・リアルタイム、指標結果の永続化は対象外

## 追記（v0.2.0 / Phase 4）

UI の複数分類は維持したまま、スコア合成では `scoreGroup` で 1 指標 1 グループに固定する。詳細は [ADR 007](007-trend-score.md)。

## 追記（v0.2.0 / Phase 5）

カタログ ID の ON/OFF 集合を名前付きセットとして保存する。計算結果の永続化は対象外のまま。詳細は [ADR 008](008-indicator-sets.md)。

## 追記（v0.2.0 / Phase 6）

MACD / RSI の学習用二重分類をやめ、`categories` を `scoreGroup` に揃える（MACD=`trend`、RSI=`oscillator`）。CCI や一目など Issue 対象外の複数分類は当面残す。詳細は [ADR 007](007-trend-score.md)。

## 追記（v0.3.0 / Phase 3）

「シグナル / バックテストの戦略セットは変更しない」は撤回する。カタログ ID（および IndicatorSet）から売買ルールを導出し、自由パラメータのシグナル作成 UI を廃止した。詳細は [ADR 010](010-signal-from-indicator-set.md)。

## 関連

- [開発ロードマップ](../roadmap/v0/v0.2/v0.2.0.md) Phase 3
- [ADR 004: テクニカル分析](004-technical-analysis.md)
- [ADR 005: チャート分析](005-chart-analysis.md)
- [ADR 007: トレンドスコア](007-trend-score.md)
- [ADR 008: テクニカル指標セット](008-indicator-sets.md)
- [ADR 010: 指標セット起点のシグナル導出と画面分離](010-signal-from-indicator-set.md)
