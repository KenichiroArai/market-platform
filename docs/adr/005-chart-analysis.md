# ADR 005: チャート分析（Chart Analysis）

## ステータス

Accepted（v0.1.0 / Phase 6）

## コンテキスト

Phase 5 までで日足 OHLCV・テクニカル指標 API・簡易折れ線チャート（バックテスト画面）は揃っている。
Phase 6 では銘柄指定の分析画面を充実させ、ローソク足・出来高・指標を一体で確認できるようにする必要がある。
週足データは DB に保存しておらず、チャートライブラリも未選定だった。

## 決定

**専用分析画面 `/charts` で TradingView Lightweight Charts によりローソク・出来高・指標を表示し、週足は Nest が日足から集約する。**

- Web チャートライブラリ: **`lightweight-charts` v5**（ローソク・サブパネル・ズーム/パンが標準）
- 既存 `recharts` の折れ線 `PriceChart` はバックテスト画面用として残す
- データ取得: 一括 API は作らず、既存の  
  `GET /symbols/:id/prices` と `GET /symbols/:id/indicators` を並列呼び出し
- クエリ `interval=1d|1w`（省略時 `1d`）を両エンドポイントに追加
- 週足集約ルール（UTC 月曜始まり週）:
  - open = 週内先頭日の open
  - high / low = 週内の max / min
  - close = 週内最終日の close
  - volume = 週内合計
  - 日付キー = 週の最終取引日
- 週足の指標: 日足を十分読み込み → 週集約 → analysis に渡し、lookback は **週バー本数**として扱う
- チャートパネル構成:
  - Pane 0: ローソク + SMA / EMA オーバーレイ
  - Pane 1: Volume ヒストグラム
  - Pane 2: RSI
  - Pane 3: MACD（line / signal / histogram）
- 銘柄選択: ウォッチリストからの指定、および既存銘柄一覧のクライアント側フィルタ（新規検索 API は作らない）

## 理由

- 金融チャート向けの canvas ライブラリにより、recharts でのローソク自作やズーム実装を避けられる
- DB スキーマを変えず週足を提供でき、analysis も「バー配列を受け取る」既存契約のまま利用できる
- 一括 API はクライアント並列で足りる段階であり、契約面の複雑化を避ける

## 結果・制約

- 分足・月足・リアルタイム更新は対象外
- 指標パラメータの UI 編集は Phase 6 では既定値（ADR 004）固定。トグル ON/OFF のみ
- 自動売買・注文執行は引き続き対象外

## 追記（v0.2.0 / Phase 3）

`/charts` の指標 UI とパネル構成は [ADR 006](006-indicator-catalog.md) のカタログに合わせて拡張した。
パラメータの自由編集は引き続き対象外。トグルはカタログ ID 単位。初期 ON はおすすめ構成。

## 追記（チャート画面のウィンドウ）

指標カタログは本画面の左カラムには置かず、**モードレス**（背面のチャートを操作できるフローティングパネル）または **別ウィンドウ**（`window.open` + portal）から選ぶ。
チャートは `/charts` 本画面に全幅表示し、**拡大**で全画面の別ウィンドウを開く。

## 追記（v0.2.0 / Phase 4）

価格ペインの背景色で日足ごとのトレンドスコアを示す。取得は `GET /symbols/:id/prices` / `indicators` に加え `GET /symbols/:id/trend-score` を並列呼び出しする。詳細は [ADR 007](007-trend-score.md)。

## 追記（v0.2.0 / Phase 5）

指標トグルは名前付きセットとして保存できる。保存 UI は指標設定ウィンドウ内、呼び出しは独立ウィンドウ。詳細は [ADR 008](008-indicator-sets.md)。

## 関連

- [開発ロードマップ](../roadmap/v0/v0.1/v0.1.0.md) Phase 6
- [v0.2.0 Phase 3](../roadmap/v0/v0.2/v0.2.0.md)
- [v0.2.0 Phase 4](../roadmap/v0/v0.2/v0.2.0.md)
- [v0.2.0 Phase 5](../roadmap/v0/v0.2/v0.2.0.md)
- [ADR 004: テクニカル分析](004-technical-analysis.md)
- [ADR 006: テクニカル指標カタログ](006-indicator-catalog.md)
- [ADR 007: トレンドスコア](007-trend-score.md)
- [ADR 008: テクニカル指標セット](008-indicator-sets.md)
- [アーキテクチャ概要](../architecture/overview.md)
