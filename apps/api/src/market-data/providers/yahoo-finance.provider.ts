/**
 * Yahoo Finance 経由の日足取得プロバイダ。
 *
 * yahoo-finance2 の chart API を使い、quotes を DailyBar に正規化する。
 * コンストラクタ引数は持たない（Nest DI が optional 引数を依存として解釈するため）。
 * 単体テストでは yahoo-finance2 モジュールを mock する。
 */
import { Injectable, Logger } from '@nestjs/common';
import YahooFinance from 'yahoo-finance2';
import type { DailyBar, MarketDataProvider } from './market-data.provider';

/** chart 応答の最小形（テストの mock と揃える）。 */
type YahooChartResult = {
  quotes: Array<{
    date: Date;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  }>;
};

@Injectable()
export class YahooFinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);
  private readonly client = new YahooFinance();

  /** Yahoo chart（1d）から欠損 OHLC を除いた DailyBar 配列を返す。 */
  async fetchDailyBars(ticker: string, from: string, to: string): Promise<DailyBar[]> {
    this.logger.debug(`Fetching Yahoo daily bars: ${ticker} ${from}..${to}`);

    // period2 は排他的になりやすいため、to の翌日を渡して to 当日を含める
    const period2 = nextDay(to);
    const result = (await this.client.chart(ticker, {
      period1: from,
      period2,
      interval: '1d',
    })) as YahooChartResult;

    const bars: DailyBar[] = [];
    for (const quote of result.quotes) {
      if (
        quote.open == null ||
        quote.high == null ||
        quote.low == null ||
        quote.close == null ||
        quote.volume == null
      ) {
        continue;
      }

      bars.push({
        date: quote.date.toISOString().slice(0, 10),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
      });
    }

    return bars;
  }
}

/** YYYY-MM-DD の翌日を返す。 */
function nextDay(dateOnly: string): string {
  const parts = dateOnly.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
