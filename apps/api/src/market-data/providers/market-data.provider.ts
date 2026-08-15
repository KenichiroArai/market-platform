/**
 * 外部市場データ取得の抽象契約。
 *
 * Yahoo / Stub など実装を差し替え可能にし、PriceSyncService はここに依存する。
 * 日付は YYYY-MM-DD（UTC 日付）で受け渡し、タイムゾーン解釈のずれを避ける。
 */

/** 1 日分の OHLC。 */
export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 銘柄メタデータ（quote）。
 * 追加画面はティッカーと市場だけ受け、名称・通貨・取引所はここから埋める。
 */
export type SymbolQuote = {
  name: string;
  currency: string;
  exchange: string | null;
};

/**
 * 市場データプロバイダ。
 * ネットワーク障害等は呼び出し側（同期ジョブ / 銘柄作成）が catch する。
 */
export interface MarketDataProvider {
  fetchDailyBars(ticker: string, from: string, to: string): Promise<DailyBar[]>;
  fetchQuote(ticker: string): Promise<SymbolQuote>;
}
