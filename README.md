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
docker compose up --build

# またはホスト上でアプリのみ起動
pnpm dev
```

ヘルスチェック:

- Web: http://localhost:3000
- API: http://localhost:3001/health
- Analysis: http://localhost:8000/health
- API → Analysis: http://localhost:3001/health/analysis

認証・OpenAPI（Phase 1）:

- 登録: `POST /auth/register` / 画面 http://localhost:3000/register
- ログイン: `POST /auth/login` / 画面 http://localhost:3000/login
- 自分: `GET /auth/me`（Bearer） / 画面 http://localhost:3000/me
- Nest OpenAPI: http://localhost:3001/docs
- FastAPI OpenAPI: http://localhost:8000/docs

市場データ（Phase 2、いずれも Bearer 必須）:

- 銘柄: `GET|POST /symbols` / `GET|PATCH /symbols/:id`
- 日足: `GET /symbols/:id/prices?from=&to=`
- 価格同期: `POST /market-data/jobs/sync-prices`
- シード: `pnpm db:seed`（代表的な US/JP 銘柄）

ウォッチリスト / ポートフォリオ（Phase 3、Bearer 必須）:

- ウォッチリスト: `GET|POST /watchlists` / `GET|PATCH|DELETE /watchlists/:id` / 画面 http://localhost:3000/watchlists
- 銘柄追加・削除: `POST /watchlists/:id/items` / `DELETE /watchlists/:id/items/:itemId`
- ポートフォリオ: `GET|POST /portfolios` / `GET|PATCH|DELETE /portfolios/:id` / 画面 http://localhost:3000/portfolios
- 保有: `POST /portfolios/:id/holdings` / `PATCH|DELETE /portfolios/:id/holdings/:holdingId`

`.env` に `JWT_SECRET` が必須です（[`.env.example`](.env.example) 参照）。市場データは `MARKET_DATA_PROVIDER`（`yahoo`|`stub`）で切替できます（[ADR 002](docs/adr/002-market-data-provider.md)）。

## テスト

```bash
pnpm test
# pnpm 未導入時: npx pnpm@9.15.9 test または npm test
```

各パッケージでカバレッジ 100%（statements / branches / functions / lines）を要求します。`apps/analysis` は pytest-cov です。CI は [`.github/workflows/ci.yml`](.github/workflows/ci.yml) です。

## ドキュメント

設計・ロードマップなどの詳細はルート README ではなく `docs/` に集約しています。

- [ドキュメント索引](docs/README.md)
- [アーキテクチャ概要](docs/architecture/overview.md)
- [開発ロードマップ](docs/roadmap.md)
- [ADR 001: JWT 認証](docs/adr/001-authentication-jwt.md)
- [ADR 002: 市場データプロバイダ](docs/adr/002-market-data-provider.md)
- [ADR 003: ウォッチリスト / ポートフォリオ](docs/adr/003-watchlist-portfolio.md)

## ライセンス

[MIT](LICENSE)
