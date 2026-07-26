/**
 * 決定論的な疑似 OHLC を返す Stub プロバイダ。
 *
 * 単体テスト・オフライン開発用。外部 HTTP を一切使わない。
 * ティッカー文字列と日付からハッシュ風のシードを作り、再現可能な価格列を生成する。
 */
import { Injectable } from '@nestjs/common';
import type { DailyBar, MarketDataProvider } from './market-data.provider';

@Injectable()
export class StubMarketDataProvider implements MarketDataProvider {
  /**
   * from〜to（両端含む）の各暦日について 1 本のバーを返す。
   * 週末も含める（テストで日付範囲の件数を予測しやすくするため）。
   */
  async fetchDailyBars(ticker: string, from: string, to: string): Promise<DailyBar[]> {
    const bars: DailyBar[] = [];
    const cursor = parseDateOnly(from);
    const end = parseDateOnly(to);

    while (cursor.getTime() <= end.getTime()) {
      const date = formatDateOnly(cursor);
      const seed = hashSeed(`${ticker}:${date}`);
      const open = 100 + (seed % 50);
      const close = open + ((seed >> 3) % 11) - 5;
      const peak = Math.max(open, close);
      const trough = Math.min(open, close);
      const high = peak + ((seed >> 6) % 5);
      const low = trough - ((seed >> 9) % 5);
      const volume = 100_000 + (seed % 900_000);

      bars.push({ date, open, high, low, close, volume });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return bars;
  }
}

/** YYYY-MM-DD を UTC 日付として Date に変換する。 */
function parseDateOnly(value: string): Date {
  const parts = value.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Date を YYYY-MM-DD にフォーマットする。 */
function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 文字列から非負の整数シードを作る（暗号用途ではない）。 */
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
