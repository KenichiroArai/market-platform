# ADR 014: 指標セットの拡張設定（パラメータ・スコア配点・閾値）

## ステータス

Accepted（v0.4.0 / Phase 2）

## コンテキスト

v0.2.0 以降、指標セットはカタログ ID の ON/OFF 集合のみを保存していた（[ADR 008](008-indicator-sets.md)）。
スコア配点は [ADR 007](007-trend-score.md) の固定値、指標パラメータは [ADR 006](006-indicator-catalog.md) のカタログ既定のみとし、上書き・複製・閾値の UI 編集は対象外だった。

Issue #28 により、セット管理（上書き確認・複製）と、スコア内訳のグループ配点（合計 100%）、買い売り判定閾値、指標パラメータの個別上書きが必要になった。

## 決定

### IndicatorSet の永続化フィールド拡張

| フィールド | 説明 |
| ---------- | ---- |
| `indicatorParams` | カタログ ID ごとのパラメータ上書き（差分のみ JSON） |
| `groupWeights` | 6 グループ配点。`null` は ADR 007 既定（40/20/10/10/10/10） |
| `buyThreshold` / `sellThreshold` | トレンドスコア売買閾値。`null` は 37.5 / -42.5 |

計算結果は引き続き DB に保存しない。

### API

- `POST /indicator-sets` — 新フィールド対応。同名は 409（クライアントが上書き確認後 PATCH）
- **`PATCH /indicator-sets/:id`** — 名前・指標・パラメータ・配点・閾値を一括更新
- `GET /symbols/:id/indicators` — オプション `indicatorParams`（JSON）で計算時パラメータを上書き
- `GET /symbols/:id/trend-score` — オプション `groupWeights`（JSON）で配点を上書き

### バリデーション

- グループ配点: 6 キー必須、各値 > 0、合計 **厳密に 100**
- 閾値: `buyThreshold > sellThreshold`、-100〜100
- パラメータ: カタログ定義キーのみ、shared-types の min/max 範囲内

### UI

- `/charts` 指標設定ウィンドウでパラメータ・配点・閾値を編集しセットに保存
- 同名保存時は `window.confirm` で上書き確認 → PATCH
- セット呼び出しに **複製** ボタン。クリックで指標設定を開き、元セット名をセット名欄に表示（新規保存扱い）
- バックテスト（`trendScore` モード）は選択セットの閾値をデフォルト使用

### ADR 006 / 008 からの変更

- ADR 006「パラメータの自由入力はしない」→ **IndicatorSet 経由の上書きに限定して撤回**
- ADR 008「PATCH / 上書きは対象外」→ **PATCH による上書きを採用**

トレンドスコアの指標リスト（正本セット）はサーバ固定のまま。チャートトグルとは独立（ADR 007 維持）。

## 理由

- セット単位で「どの指標をどう重み付けして売買するか」を再現可能にする
- カタログ ID を維持しつつ period 等だけ変えれば、既存の lookback・シグナル導出と整合しやすい
- 上書きは PATCH で明示し、誤削除→再作成のワークアラウンドを廃止

## 結果・制約

- パラメータ編集はカタログ定義キーと範囲内に限定（完全自由入力ではない）
- 指標計算結果・トレンドスコア時系列の DB 永続化は対象外
- 分足・月足・リアルタイムは対象外

## 関連

- [開発ロードマップ](../roadmap/v0/v0.4/v0.4.0.md) Phase 2
- [ADR 006: テクニカル指標カタログ](006-indicator-catalog.md)
- [ADR 007: トレンドスコア](007-trend-score.md)
- [ADR 008: テクニカル指標セット](008-indicator-sets.md)
- [Issue #28](https://github.com/KenichiroArai/market-platform/issues/28)
