# ADR 018: 売買戦略・トレードプランとバックテスト共通化

## ステータス

Accepted（v0.5.0 / Phase 2）

## コンテキスト

v0.5.0 Phase 1（ADR 017）でチャート向けエントリー助言と資金管理水準を導入したが、ユーザー向けには「分析結果」と「今どう判断するか」が別体験のままである。
Issue #33 により、分析結果から売買判定・損切／利確・ポジションサイズ・リスク評価までを一貫したトレードプランとして提示し、バックテストからも同一ロジックを利用できる必要がある。

## 決定

**Strategy 層を Analysis に新設し、トレードプラン API と UI（`/strategy`）を正本とする。損切／利確の複数方式は Strategy モジュールに集約し、バックテストの `exitPolicy` からも同じ関数を呼び出す。**

### Strategy モジュール（正本）

| モジュール | 責務 |
| ---- | ---- |
| `judgment` | 複数指標 + トレンドスコア → 5 段階判定 + 0–100 スコア |
| `entry_price` | 現在価格と推奨エントリー（押し目等） |
| `stop_loss` | ATR / ATR×2 / 直近安値 / 近似サポート / Donchian 下限 / MA の候補と推奨 |
| `take_profit` | ATR 倍数 / RR / 近似レジスタンス / フィボ / Donchian 上限の候補と推奨 |
| `risk_reward` | Entry / Stop / Target → RR |
| `position_plan` | 総資産・許容損失・Entry・Stop → 株数・必要資金・最大損失 |
| `risk_rating` | ATR%・ボラ・出来高・ADX/スコア・ギャップ → 低/普通/高 |
| `reasons` | 買い/売り理由の説明可能リスト |
| `trade_plan` | Facade（`compute_trade_plan`） |

ATR ストップ幅とユニット数量は既存 `MoneyManagementService` / `position_sizing` を再利用する（二重実装しない）。

### 不足指標のみ追加

- **Donchian**: 上限・下限・中央（損切／利確候補）
- **ADX**: トレンド強度（リスク評価・売買理由）

サポート／レジスタンス専用インジは作らず、直近スイング高安・フィボナッチ・出来高プロファイル POC から近似候補を生成する。

### API

| 層 | エンドポイント |
| ---- | -------------- |
| Nest | `GET /symbols/:symbolId/trade-plan` |
| Analysis | `POST /analysis/trade-plan` |

シグナル正本は ADR 017 と同系（`resolveSignalRule` → 未確定時はトレンドスコア閾値）。

### バックテスト共通化

`simulate_backtest` に `exitPolicy` を追加する。

- `stopMethod`: 既定は現状互換の ATR×`stopMultiple`。Strategy の損切方式を選択可能。
- `takeProfitMethod`: 既定はなし（シグナル／強制終了のみ）。選択時は Strategy の利確水準ヒットで決済。

### UI

- メニュー: 分析（ハブ）/ 戦略（新規）を追加。チャート分析は分析配下へ誘導しつつ `/charts` は互換維持。
- `/strategy`: トレードプラン一画面（判定・Entry/Stop/Target・RR・株数・リスク・理由・総合評価）。
- Ph1 の `/charts` entry-advice は維持し、戦略画面への導線を付与する。

## スコープ外

- 自動売買・注文執行
- マルチタイムフレーム / セクター / 市場全体比較 / AI 理由生成
- ポートフォリオ全体のリスク分析
- チャート画面の全面作り直し

## 関連

- [開発ロードマップ v0.5.0](../roadmap/v0/v0.5/v0.5.0.md) Phase 2
- [Issue #33](https://github.com/KenichiroArai/market-platform/issues/33)
- [ADR 016: 資金管理](016-money-management.md)
- [ADR 017: チャート分析 × MM](017-chart-analysis-money-management.md)
