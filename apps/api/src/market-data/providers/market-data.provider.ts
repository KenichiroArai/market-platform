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
 * 市場データプロバイダ。
 * ネットワーク障害等は呼び出し側（同期ジョブ）が catch して failures に積む。
 */
export interface MarketDataProvider {
  fetchDailyBars(ticker: string, from: string, to: string): Promise<DailyBar[]>;
}
