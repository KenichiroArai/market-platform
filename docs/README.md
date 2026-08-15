# Documentation

market-platform の設計ドキュメントです。ルート [README.md](../README.md) は入口・クイックスタート用、設計の正本は本ディレクトリに置きます。

## 読み方

1. まず [アーキテクチャ概要](architecture/overview.md) で構成・責務・基盤（Turborepo / pnpm / Docker）を把握する
2. [開発ロードマップ](roadmap/README.md) で実装の優先順位を確認する（現行: [v0.2.0](roadmap/v0/v0.2/v0.2.0.md)）
3. 個別の重要な意思決定は `adr/` の ADR を参照する

## 目次

| ドキュメント                                                       | 内容                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [architecture/overview.md](architecture/overview.md)               | ディレクトリ構成、責務、通信、Turborepo、pnpm、Docker Compose、設定ファイル一覧 |
| [roadmap/](roadmap/README.md)                                      | バージョン別ロードマップの索引                                                  |
| [roadmap/v0/v0.2/v0.2.0.md](roadmap/v0/v0.2/v0.2.0.md)             | 現行ロードマップ（Phase 1: 認証 UX）                                            |
| [adr/001-authentication-jwt.md](adr/001-authentication-jwt.md)     | 認証方針（JWT + メール/パスワード）                                             |
| [adr/002-market-data-provider.md](adr/002-market-data-provider.md) | 市場データ取得（Provider 抽象 + Yahoo / Stub）                                  |
| [adr/003-watchlist-portfolio.md](adr/003-watchlist-portfolio.md)   | ウォッチリスト / ポートフォリオ（複数・日足終値集計）                           |
| [adr/004-technical-analysis.md](adr/004-technical-analysis.md)     | テクニカル分析（オンデマンド SMA/EMA/RSI/MACD）                                 |
| [adr/005-chart-analysis.md](adr/005-chart-analysis.md)             | チャート分析（ローソク・出来高・週足集約）                                      |

## ドキュメント方針

- **ルート README**: 何のリポジトリか・どう動かすか・詳細へのリンク
- **`docs/`**: 設計の長文、責務分離、基盤構成、ロードマップ、ADR
- 設計変更時はアプリコードより先に、該当する `docs/` を更新する

### ロードマップのバージョン管理

ロードマップは次のディレクトリ規約で管理する。

```
docs/roadmap/vX/vX.Y/vX.Y.Z.md
```

例: [v0.1.0](roadmap/v0/v0.1/v0.1.0.md) → `docs/roadmap/v0/v0.1/v0.1.0.md`

| 階層     | パス例                      | 役割                              |
| -------- | --------------------------- | --------------------------------- |
| メジャー | `roadmap/v0/`               | メジャー系列の索引（`README.md`） |
| マイナー | `roadmap/v0/v0.1/`          | マイナー系列の索引（`README.md`） |
| パッチ   | `roadmap/v0/v0.1/v0.1.0.md` | その版のロードマップ本体          |

各階層の `README.md` には **現行版へのリンク** と **下位一覧** を置く。ルートの [roadmap.md](roadmap.md) は現行パッチへの案内スタブ（後方互換）とする。

追加手順:

- **パッチ**（例 v0.1.1）: `roadmap/v0/v0.1/v0.1.1.md` を追加し、`v0.1/README.md` の現行を更新する
- **マイナー**（例 v0.2）: `roadmap/v0/v0.2/` を新規作成し、`v0/README.md` の現行を更新する
- **メジャー**（例 v1）: `roadmap/v1/` を新規作成し、`roadmap/README.md` の現行を更新する
- いずれもルート [roadmap.md](roadmap.md) スタブも現行パッチを指すよう更新する

### ADR

ADR はリリース単位では分けず、`docs/adr/` にフラットな連番（001, 002, …）で置く。新 ADR は連番を増やし、該当するロードマップへ相互リンクする。
