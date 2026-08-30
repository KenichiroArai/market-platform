# market-platform

株式・ETF・指数などの市場データを扱い、テクニカル分析・売買シグナル・バックテストなどを提供する Web アプリケーションです。現時点では自動売買は対象外です。

TypeScript を中心にフロントエンド（Next.js）と Web API（NestJS）を構成し、株価分析・テクニカル分析・バックテスト・AI 分析は Python（FastAPI）に分離しています。

## 技術スタック

- **Frontend**: Next.js (React + TypeScript)
- **Web API**: NestJS (TypeScript)
- **Analysis API**: FastAPI (Python)
- **Database**: PostgreSQL + Prisma 7
- **Monorepo**: pnpm Workspace + Turborepo
- **Runtime / Infra**: Docker Compose

## リポジトリ構成

```
apps/          # web / api / analysis
packages/      # database / shared-types / shared-config
docs/          # 設計ドキュメント（正本）
docker/        # Dockerfile
scripts/       # 開発用スクリプト
```

ディレクトリの責務や通信設計の詳細は [docs/architecture/overview.md](docs/architecture/overview.md) を参照してください。

## 前提ツール

- Node.js 22+（`.nvmrc` 参照）
- pnpm 9（`packageManager` で固定）
- Docker / Docker Compose（PostgreSQL と一式起動用）
- Python 3.10+（`apps/analysis`。コンテナでは uv を使用）



### pnpm が入っていない場合（Windows で多い）

```bash
npm install -g pnpm@9.15.9
```

インストール後は**新しいターミナル**を開き直してください。`pnpm` がまだ見つからない場合は次のどちらかで実行できます。

```bash
npx pnpm@9.15.9 test
npm test
```



## クイックスタート

```bash
# 環境変数
cp .env.example .env

# 依存関係のインストール
pnpm install

# 共有パッケージと Prisma Client
pnpm generate
pnpm --filter @market/shared-types build
pnpm --filter @market/database build

# PostgreSQL 起動
docker compose up -d postgres

# マイグレーション
pnpm db:migrate:deploy

# 全サービス起動（postgres / analysis / api / web）
# ビルド進捗・ヘルス確認・URL サマリーを表示（推奨）
pnpm docker:up

# バックグラウンド起動のみ（ログ追跡なし）
pnpm docker:up:detach

# 従来どおり直接起動（ビルドログに >>> [service] の進捗は表示されます）
docker compose up --build

# またはホスト上でアプリのみ起動
pnpm dev
```

ヘルスチェック:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/health](http://localhost:3001/health)
- Analysis: [http://localhost:8000/health](http://localhost:8000/health)
- API → Analysis: [http://localhost:3001/health/analysis](http://localhost:3001/health/analysis)

認証・OpenAPI（Phase 1）:

- 登録: `POST /auth/register` / 画面 [http://localhost:3000/register](http://localhost:3000/register)
- ログイン: `POST /auth/login` / 画面 [http://localhost:3000/login](http://localhost:3000/login)
- 自分: `GET /auth/me`（Bearer） / 画面 [http://localhost:3000/me](http://localhost:3000/me)
- Nest OpenAPI: [http://localhost:3001/docs](http://localhost:3001/docs)
- FastAPI OpenAPI: [http://localhost:8000/docs](http://localhost:8000/docs)

市場データ（Phase 2、いずれも Bearer 必須）:

- 銘柄: `GET|POST /symbols` / `GET|PATCH /symbols/:id` / 画面 [http://localhost:3000/symbols](http://localhost:3000/symbols)
- 追加: `POST /symbols` はティッカー + 市場のみ。名称・通貨・取引所は Yahoo quote で補完
- 日足: `GET /symbols/:id/prices?from=&to=`（期間指定時は不足期間を差分取得してから返す）
- 価格同期: `POST /market-data/jobs/sync-prices`（要求期間を再取得して upsert。`forceRefresh: false` でギャップ＋直近のみ）
- シード: `pnpm db:seed`（代表的な US/JP 銘柄）

ウォッチリスト / ポートフォリオ（Phase 3、Bearer 必須）:

- ウォッチリスト: `GET|POST /watchlists` / `GET|PATCH|DELETE /watchlists/:id` / 画面 [http://localhost:3000/watchlists](http://localhost:3000/watchlists)
- 銘柄追加・削除: `POST /watchlists/:id/items` / `DELETE /watchlists/:id/items/:itemId`
- ポートフォリオ: `GET|POST /portfolios` / `GET|PATCH|DELETE /portfolios/:id` / 画面 [http://localhost:3000/portfolios](http://localhost:3000/portfolios)
- 保有: `POST /portfolios/:id/holdings` / `PATCH|DELETE /portfolios/:id/holdings/:holdingId`

テクニカル分析（Bearer 必須）:

- 指標: `GET /symbols/:id/indicators?indicators=sma25,sma75,sma200,macd,rsi,bb,obv,ichimoku&from=&to=`
- 内部計算: Analysis `POST /indicators` / `POST /trend-score`（Nest 経由。詳細は [ADR 004](docs/adr/004-technical-analysis.md) / [ADR 006](docs/adr/006-indicator-catalog.md) / [ADR 007](docs/adr/007-trend-score.md)）
- トレンドスコア: `GET /symbols/:id/trend-score?from=&to=`（チャート背景。トグル非依存）
- 画面: [http://localhost:3000/charts（チャート本画面](http://localhost:3000/charts（チャート本画面) + 指標はモードレス/別ウィンドウ + トレンド背景 + 指標セット保存/呼び出し）
- 指標セット: `GET|POST /indicator-sets` / `DELETE /indicator-sets/:id`（名前付きトグル。保存は指標設定ウィンドウ、呼び出しは独立ウィンドウ）

`.env` に `JWT_SECRET` が必須です（`[.env.example](.env.example)` 参照）。市場データは `MARKET_DATA_PROVIDER`（`yahoo`|`stub`）で切替できます（[ADR 002](docs/adr/002-market-data-provider.md)）。

## テスト

```bash
pnpm test
# pnpm 未導入時: npx pnpm@9.15.9 test または npm test
```

各パッケージでカバレッジ 100%（statements / branches / functions / lines）を要求します。`apps/analysis` は pytest-cov です。CI は `[.github/workflows/ci.yml](.github/workflows/ci.yml)` です。

## ドキュメント

設計・ロードマップなどの詳細はルート README ではなく `docs/` に集約しています。

- [ドキュメント索引](docs/README.md)
- [アーキテクチャ概要](docs/architecture/overview.md)
- [開発ロードマップ](docs/roadmap/README.md)（現行: [v0.4.0](docs/roadmap/v0/v0.4/v0.4.0.md)）
- [ADR 001: JWT 認証](docs/adr/001-authentication-jwt.md)
- [ADR 002: 市場データプロバイダ](docs/adr/002-market-data-provider.md)
- [ADR 003: ウォッチリスト / ポートフォリオ](docs/adr/003-watchlist-portfolio.md)
- [ADR 004: テクニカル分析](docs/adr/004-technical-analysis.md)
- [ADR 005: チャート分析](docs/adr/005-chart-analysis.md)
- [ADR 006: テクニカル指標カタログ](docs/adr/006-indicator-catalog.md)
- [ADR 007: トレンドスコア](docs/adr/007-trend-score.md)
- [ADR 008: テクニカル指標セット](docs/adr/008-indicator-sets.md)
- [ADR 009: バックテスト結果の拡張と SMA 最適化](docs/adr/009-backtest-enrichment.md)
- [ADR 013: 実行履歴の検索と論理削除](docs/adr/013-backtest-run-history-management.md)
- [ADR 016: 資金管理（マネーマネージメント）](docs/adr/016-money-management.md)



## ライセンス

[MIT](LICENSE)
