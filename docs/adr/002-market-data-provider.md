# ADR 002: 市場データプロバイダ抽象（Yahoo + Stub）

## ステータス

Accepted（v0.1.0 / Phase 2）

## コンテキスト

Phase 2 で銘柄マスタと日足価格の取得・永続化が必要になる。価格ソースの候補は Stooq / Yahoo Finance / Alpha Vantage / Stub などがあり、API キーの有無・依存の大きさ・日米ティッカー対応が異なる。アーキテクチャ方針として「必要以上にライブラリを追加しない」こと、および将来ソースを差し替えられることが求められる。

## 決定

**`MarketDataProvider` インターフェースで抽象化し、実装として Yahoo Finance と Stub を用意する。**

- NestJS（`apps/api`）がオーケストレーションし、取得結果は Prisma 経由で PostgreSQL に upsert する
- 実装切替は環境変数 `MARKET_DATA_PROVIDER=yahoo|stub`（未設定時は `yahoo`）
- Yahoo は `yahoo-finance2` の chart（日足）を利用する。ティッカーは Yahoo 形式（US=`AAPL`、JP=`7203.T`）
- Stub は決定論的な疑似 OHLC を返し、単体テスト・オフライン開発で外部 HTTP を避ける
- 定期実行は `@nestjs/schedule`（`MARKET_DATA_CRON`、既定 `0 6 * * *` UTC）。キュー / Redis は導入しない
- 対象市場は US / JP の両方（Prisma `Market` enum）

## 理由

- プロバイダ抽象により、ソース変更時に同期ジョブ本体を書き換えずに済む
- Yahoo は API キー不要で日米のティッカーを同一 API で扱える
- Stub によりカバレッジ 100% を外部依存なしで維持できる
- 初期段階でキュー基盤を入れるコストを避け、cron + 手動トリガで十分な取得頻度を確保する

## 結果・制約

- Yahoo の非公式 API 変更・レート制限の影響を受けうる（失敗は銘柄単位で `failures` に積む）
- Cron 式はプロセス起動時に評価される（起動後の env 変更は再起動が必要）
- 分足・リアルタイム・調整済み終値以外のイベント（配当・分割）は Phase 2 対象外

## 関連

- [開発ロードマップ](../roadmap/v0/v0.1/v0.1.0.md) Phase 2
- [アーキテクチャ概要](../architecture/overview.md)
