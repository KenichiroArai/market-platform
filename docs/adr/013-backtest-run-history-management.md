# ADR 013: 実行履歴の検索と論理削除

## ステータス

Accepted（v0.4.0 / Phase 1）

## コンテキスト

v0.3.0 まで実行履歴は `GET /backtests` で全件取得し、結果タブの `<select>` で切り替えるのみだった。
件数増加に伴い一覧が重くなり、不要な run を残し続ける運用も困難（Issue #27）。

## 決定

### 論理削除

- `BacktestRun.isActive Boolean @default(true)`
- 削除 API は物理 DELETE ではなく `isActive: false` へ更新
- 復元 API/UI は Ph1 スコープ外（将来 `PATCH` で拡張可能）

### 一覧と詳細の分離

| 用途 | エンドポイント | 返却 |
| ---- | -------------- | ---- |
| セレクト / 検索一覧 | `GET /backtests?…` | `BacktestRunListItemDto[]`（summary のみ） |
| 結果表示 | `GET /backtests/:id` | `BacktestRunDto`（trades + equityPoints 込み） |

### 検索クエリ（GET / DELETE 共通）

| パラメータ | 説明 |
| ---------- | ---- |
| `symbolId` | 銘柄 |
| `strategyType` | 戦略種別 |
| `indicatorSetId` | 指標セット |
| `fromDate` / `toDate` | 検証期間（Run 期間との overlap） |
| `createdFrom` / `createdTo` | 実行日時 |
| `isActive` | 省略時 `true`。`false` / `all` |

### 削除 API

- `DELETE /backtests/:id` — 活動中 run を 1 件論理削除（204）
- `DELETE /backtests?…` — 検索条件に一致する活動中 run を一括論理削除（200 + `{ deletedCount }`）

### UI

- `/backtests` 結果タブに「検索…」ボタン
- `ModelessWindow` ベースの検索パネル（charts の指標設定と同系）
- 選択 run の詳細は `fetchBacktestRun` で lazy load

## 結果

- 実行履歴の絞り込み・整理が API/UI 両方から可能
- 一覧 API の payload を軽量化し、詳細は ID 指定時のみ取得

## 参照

- [v0.4.0 Phase 1](../roadmap/v0/v0.4/v0.4.0.md)
- [Issue #27](https://github.com/KenichiroArai/market-platform/issues/27)
