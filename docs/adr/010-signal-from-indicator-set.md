# ADR 010: 指標セット起点のシグナル導出と画面分離

## ステータス

Accepted（v0.3.0 / Phase 3）

## コンテキスト

v0.3.0 Phase 2 まで、シグナル定義（`smaCross` / `rsiThreshold` / `macdCross` + 自由パラメータ）とチャート指標カタログは別系統だった。
バックテスト画面に戦略作成フォームがあり、チャートで見た指標構成をそのまま検証に回せなかった。
ユーザーは指標を変えながらチャートで即確認したいため、設定 UI をチャート分析に集約し、バックテストは実行専用にする必要があった。

## 決定

**保存済み IndicatorSet（カタログ ID 配列）をシグナル正本とし、`resolveSignalRule` で売買ルールを導出する。指標設定 UI は `/charts` のみ、`/backtests` は実行・結果のみ。**

### 導出ルール（`packages/shared-types` 正本）

優先順:

1. `sma25` / `sma75` / `sma200` がちょうど 2 本 → `smaCross`（短い period = short、長い = long）
2. それ以外で `macd` が ON → `macdCross`（カタログ既定の fast/slow/signal）
3. それ以外で `rsi` が ON → `rsiThreshold`（カタログ period + 固定閾値 30/70）
4. それ以外 → 実行不可（UI で理由を表示）

- BB・一目など売買に使わない指標はセットに残してよい（チャート用）
- RSI 閾値はカタログに無いため `DEFAULT_RSI_SIGNAL_THRESHOLDS` 定数とする（パラメータ自由編集 UI は設けない）
- SMA 最適化は総当たりをやめ、カタログペア 3 通り（25/75, 25/200, 75/200）のみ

### 画面

| パス | 役割 |
| ---- | ---- |
| `/charts` | 指標 ON/OFF・セット保存／呼び出し・チャート即反映・シグナル導出プレビュー |
| `/backtests` | シグナル有効な指標セット選択・銘柄／期間／資金・実行・結果・SMA ペア最適化 |

ナビラベルは「バックテスト」。指標編集はチャート分析へのリンクで行う。

### 永続化

- `BacktestRun` は `indicatorSetId` を参照し、実行時の `strategyType` + `paramsJson` スナップショットを保存（再現性）
- 既存 `signalDefinitionId` は nullable（過去ラン互換）。新規 UI/API は `indicatorSetId` のみ
- `/signals` CRUD API は当面残し（非推奨）。Web からは呼ばない

## 理由

- チャートで指標を確認しながら設定する体験が、検証ループの中心になる
- カタログ既定値に揃えることで、表示と売買ルールのパラメータがずれない（ADR 006 の延長）
- スナップショットを Run に残すことで、セット後編集後も過去結果を解釈できる

## 結果・制約

- Web のシグナル作成フォーム（strategyType + params）は廃止
- ADR 006「シグナル / バックテストの戦略セットは変更しない」は本 ADR で更新する
- 複合条件（SMA と RSI の AND など）やカタログ外の自由期間は対象外
- Analysis の 3 戦略エンジン（クロス / 閾値）は維持。契約変更は Nest の導出層

## 関連

- [開発ロードマップ v0.3.0](../roadmap/v0/v0.3/v0.3.0.md) Phase 3
- [Issue #22](https://github.com/KenichiroArai/market-platform/issues/22)
- [ADR 006: テクニカル指標カタログ](006-indicator-catalog.md)
- [ADR 008: テクニカル指標セット](008-indicator-sets.md)
- [ADR 009: バックテスト結果の拡張と SMA 最適化](009-backtest-enrichment.md)
