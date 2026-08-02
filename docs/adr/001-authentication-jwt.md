# ADR 001: JWT + メール/パスワード認証

## ステータス

Accepted（v0.1.0 / Phase 1）

## コンテキスト

Phase 1 でユーザー認証の方針を確定する必要がある。アーキテクチャ上、`apps/web` が認証画面を持ち、`apps/api`（NestJS）がドメイン API を保護する。`apps/analysis` は内部 HTTP 専用で、外部からは直接公開しない想定である。

候補は次のとおりだった。

- 自前 JWT + メール/パスワード
- セッション Cookie
- Auth.js（NextAuth）を web 側に置く構成
- 外部 IdP（Clerk / Auth0 など）

## 決定

**自前 JWT + メール/パスワード** を採用する。

- NestJS が `POST /auth/register` / `POST /auth/login` で JWT を発行し、`JwtAuthGuard` で保護エンドポイントを検証する
- パスワードは bcrypt ハッシュのみを PostgreSQL（Prisma `User`）に保存する
- web は JWT を `localStorage` に保存し、API 呼び出し時に `Authorization: Bearer <token>` を付与する
- analysis は内部ネットワーク専用のため認証を付けない（api がゲートウェイとなる）

## 理由

- モノレポ初期段階で依存を増やしすぎない（外部 IdP / Auth.js の導入コストを避ける）
- ドメイン API の保護境界を NestJS に一元化できる
- Phase 3 以降のウォッチリスト等で「ユーザーに紐づくデータ」を素直に扱える
- Cookie セッションより、将来の複数クライアント（CLI など）への拡張が容易

## 結果・制約

- XSS 対策として、将来的に httpOnly Cookie への移行や CSP 強化を検討する余地がある
- `JWT_SECRET` は必須。未設定時は API 起動を失敗させる（開発用フォールバックは置かない）
- リフレッシュトークンは Phase 1 では導入しない（アクセストークンの有効期限のみ）

## 関連

- [開発ロードマップ](../roadmap/v0/v0.1/v0.1.0.md) Phase 1
- [アーキテクチャ概要](../architecture/overview.md)
