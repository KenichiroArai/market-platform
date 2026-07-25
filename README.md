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

## テスト

```bash
pnpm test
# pnpm 未導入時: npx pnpm@9.15.9 test または npm test
```

各パッケージでカバレッジ 100%（statements / branches / functions / lines）を要求します。`apps/analysis` は pytest-cov です。

## ドキュメント

設計・ロードマップなどの詳細はルート README ではなく `docs/` に集約しています。

- [ドキュメント索引](docs/README.md)
- [アーキテクチャ概要](docs/architecture/overview.md)
- [開発ロードマップ](docs/roadmap.md)

## ライセンス

[MIT](LICENSE)
