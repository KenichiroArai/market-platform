# ADR 003: ウォッチリスト / ポートフォリオ

## ステータス

Accepted（Phase 3）

## コンテキスト

Phase 3 でユーザー向けの基本ドメイン機能としてウォッチリストとポートフォリオが必要になる。ロードマップは CRUD・集計 API・web UI を要求するが、詳細設計は未定だった。選択肢は次のとおりだった。

- ユーザーあたりウォッチリスト / ポートフォリオを各 1 つに固定する
- 名前付きで複数持てるようにする
- 保有の評価をリアルタイム価格で行うか、既存の日足終値で行うか
- 通貨混在時に単一合計を返すか、通貨別に返すか

## 決定

**ユーザーは複数の名前付きウォッチリストとポートフォリオを持てる。**

- `Watchlist` / `Portfolio` は `userId` で所有し、JWT のユーザー以外には `NOT_FOUND` を返す（存在漏洩を避ける）
- ウォッチリスト項目は `WatchlistItem`（`watchlistId` + `symbolId` 一意）
- 保有は `PortfolioHolding`（`quantity` + `averageCost`、`portfolioId` + `symbolId` 一意）
- 評価額・含み損益は銘柄の **最新日足終値**（`DailyPrice.close`）から算出する
- 通貨が混在しうるため、集計は **`totalsByCurrency`** で通貨別に返す（単一合計に混ぜない）
- 価格未取得の保有は `marketPrice` / `marketValue` / `unrealizedPnl` を `null` とし、その銘柄の market 側は通貨別合計に含めない（`totalCost` は常に合算）

## 理由

- 複数リストは「ウォッチリスト CRUD」「ポートフォリオ管理」の自然な解釈に合う
- Phase 2 の `Symbol` / `DailyPrice` を再利用でき、リアルタイムフィードや追加プロバイダを導入しなくてよい
- 通貨別集計により、US/JP 混在ポートフォリオでも誤った合算を避けられる

## 結果・制約

- リアルタイム価格・為替換算・配当再投資・取引履歴は Phase 3 対象外
- 注文執行・ブローカー連携はロードマップどおり恒久的に対象外
- 最新日足が無い銘柄は評価不能（`null`）となる

## 関連

- [開発ロードマップ](../roadmap.md) Phase 3
- [アーキテクチャ概要](../architecture/overview.md)
- [ADR 001: JWT 認証](001-authentication-jwt.md)
- [ADR 002: 市場データプロバイダ](002-market-data-provider.md)
