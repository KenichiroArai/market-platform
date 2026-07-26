# Documentation

market-platform の設計ドキュメントです。ルート [README.md](../README.md) は入口・クイックスタート用、設計の正本は本ディレクトリに置きます。

## 読み方

1. まず [アーキテクチャ概要](architecture/overview.md) で構成・責務・基盤（Turborepo / pnpm / Docker）を把握する
2. [開発ロードマップ](roadmap.md) で実装の優先順位を確認する
3. 個別の重要な意思決定は `adr/` の ADR を参照する

## 目次

| ドキュメント | 内容 |
|--------------|------|
| [architecture/overview.md](architecture/overview.md) | ディレクトリ構成、責務、通信、Turborepo、pnpm、Docker Compose、設定ファイル一覧 |
| [roadmap.md](roadmap.md) | Phase 0〜6 の開発ロードマップ |
| [adr/001-authentication-jwt.md](adr/001-authentication-jwt.md) | 認証方針（JWT + メール/パスワード） |

## ドキュメント方針

- **ルート README**: 何のリポジトリか・どう動かすか・詳細へのリンク
- **`docs/`**: 設計の長文、責務分離、基盤構成、ロードマップ、ADR
- 設計変更時はアプリコードより先に、該当する `docs/` を更新する
