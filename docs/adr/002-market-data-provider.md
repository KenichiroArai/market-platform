# ADR 002: 市場データプロバイダ抽象（Yahoo + Stub）

## ステータス

Accepted（v0.1.0 / Phase 2。v0.2.0 / Phase 2 で quote と差分同期を追記）

## コンテキスト

Phase 2 で銘柄マスタと日足価格の取得・永続化が必要になる。価格ソースの候補は Stooq / Yahoo Finance / Alpha Vantage / Stub などがあり、API キーの有無・依存の大きさ・日米ティッカー対応が異なる。アーキテクチャ方針として「必要以上にライブラリを追加しない」こと、および将来ソースを差し替えられることが求められる。

## 決定

**`MarketDataProvider` インターフェースで抽象化し、実装として Yahoo Finance と Stub を用意する。**

- NestJS（`apps/api`）がオーケストレーションし、取得結果は Prisma 経由で PostgreSQL に upsert する
- 実装切替は環境変数 `MARKET_DATA_PROVIDER=yahoo|stub`（未設定時は `yahoo`）
- Yahoo は `yahoo-finance2` の chart（日足）と quote（銘柄メタデータ）を利用する。ティッカーは Yahoo 形式（US=`AAPL`、JP=`7203.T`）
- Stub は決定論的な疑似 OHLC / quote を返し、単体テスト・オフライン開発で外部 HTTP を避ける
- 定期実行は `@nestjs/schedule`（`MARKET_DATA_CRON`、既定 `0 6 * * *` UTC）。キュー / Redis は導入しない
- 対象市場は US / JP の両方（Prisma `Market` enum）
- 銘柄追加（v0.2.0 Phase 2）はティッカー + 市場のみ受け、`fetchQuote` で名称・通貨・取引所を補完する
- 日足同期は銘柄ごとの `DailyPrice` 最小日より前・最大日より後だけ取得する。min〜max は取得済みとみなし再取得しない
- 差分取得のトリガは cron / 手動ジョブ、銘柄追加時、期間付きの価格・指標読み取り

## 理由

- プロバイダ抽象により、ソース変更時に同期ジョブ本体を書き換えずに済む
- Yahoo は API キー不要で日米のティッカーを同一 API で扱える
- Stub によりカバレッジ 100% を外部依存なしで維持できる
- 初期段階でキュー基盤を入れるコストを避け、cron + 手動トリガで十分な取得頻度を確保する

## 結果・制約

- Yahoo の非公式 API 変更・レート制限の影響を受けうる（失敗は銘柄単位で `failures` に積む）
- Cron 式はプロセス起動時に評価される（起動後の env 変更は再起動が必要）
- 分足・リアルタイム・調整済み終値以外のイベント（配当・分割）は対象外
- min〜max の内側に欠落があっても埋めない（連続して取得できている前提）

## 関連

- [開発ロードマップ](../roadmap/v0/v0.1/v0.1.0.md) Phase 2（市場データ基盤）
- [開発ロードマップ](../roadmap/v0/v0.2/v0.2.0.md) Phase 2（銘柄追加・差分同期）
- [アーキテクチャ概要](../architecture/overview.md)
