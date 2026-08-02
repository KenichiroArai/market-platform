# ADR 004: テクニカル分析（オンデマンド計算）

## ステータス

Accepted（v0.1.0 / Phase 4）

## コンテキスト

Phase 4 でテクニカル指標の計算と、NestJS 経由での結果返却が必要になる。計算エンジンは Python（FastAPI）に置き、永続化の有無・指標セット・ウォームアップ（lookback）の責務分担が未定だった。

## 決定

**日足 OHLC を入力に、FastAPI が指標をオンデマンド計算し、NestJS がゲートウェイとして返す。結果は DB に保存しない。**

- 指標セット: **SMA / EMA / RSI / MACD**
- デフォルト期間: SMA `20` / EMA `50` / RSI `14` / MACD `12-26-9`
- 計算ライブラリ: `pandas` + `numpy` のみ。TA-Lib / pandas-ta は使わず自前実装する
- 内部 API: analysis の `POST /indicators`（OHLC 配列 + 指標パラメータ → 日付整列の系列）
- 公開 API: NestJS の `GET /symbols/:symbolId/indicators`（JWT 必須）
- Nest が Prisma から日足を読み、`from` より前に **lookback 本数**を余分に付与して analysis に渡し、レスポンスは要求レンジにトリムする
- 日足が指標の最短本数に満たない場合は `INSUFFICIENT_PRICE_DATA`
- analysis への疎通失敗は `ANALYSIS_UPSTREAM_ERROR`（502）
- analysis 自体は認証なし（Nest が境界）。DB 書き込みは持たない

## 理由

- アーキテクチャどおり「計算は Python、永続化は Nest」に沿い、Phase 4 ではキャッシュ不要なオンデマンドで十分
- 定番 4 指標は Phase 5 のシグナル定義の土台になる
- 自前実装により Docker ビルド（TA-Lib 等）と依存を抑え、単体テストで数値を固定しやすい
- lookback を Nest 側に寄せることで、クライアントは表示期間だけを指定すればよい

## 結果・制約

- Web チャート UI は Phase 4 対象外
- 指標結果の永続化・バッチ事前計算は対象外（必要になったら別 ADR）
- シグナル判定・バックテストは Phase 5

## 関連

- [開発ロードマップ](../roadmap/v0/v0.1/v0.1.0.md) Phase 4
- [アーキテクチャ概要](../architecture/overview.md)
- [ADR 002: 市場データプロバイダ](002-market-data-provider.md)
