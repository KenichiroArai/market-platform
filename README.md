# market-platform

株式・ETF・指数などの市場データを扱い、テクニカル分析・売買シグナル・バックテストなどを提供する Web アプリケーションです。現時点では自動売買は対象外です。

TypeScript を中心にフロントエンド（Next.js）と Web API（NestJS）を構成し、株価分析・テクニカル分析・バックテスト・AI 分析は Python（FastAPI）に分離しています。

## 技術スタック

- **Frontend**: Next.js (React + TypeScript)
- **Web API**: NestJS (TypeScript)
- **Analysis API**: FastAPI (Python)
- **Database**: PostgreSQL + Prisma
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

## 前提ツール（予定）

スキャフォールド（Phase 0）完了後、以下を想定しています。

- Node.js（LTS）
- pnpm
- Docker / Docker Compose
- Python + uv（`apps/analysis`）

## クイックスタート

> **注意**: アプリ雛形と Compose 実体は Phase 0（Scaffold）で追加予定です。以下は完成後の想定手順です。

```bash
# 依存関係のインストール
pnpm install

# 開発環境の起動（PostgreSQL / api / web / analysis）
docker compose up -d

# DB マイグレーション（予定）
pnpm db:migrate

# またはホスト上で各アプリを起動（予定）
pnpm dev
```

## ドキュメント

設計・ロードマップなどの詳細はルート README ではなく `docs/` に集約しています。

- [ドキュメント索引](docs/README.md)
- [アーキテクチャ概要](docs/architecture/overview.md)
- [開発ロードマップ](docs/roadmap.md)

## ライセンス

[MIT](LICENSE)
