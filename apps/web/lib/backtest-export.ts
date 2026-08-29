/**
 * バックテスト結果の CSV / ZIP エクスポート（v0.4.0 Ph3）。
 *
 * 日次詳細・サマリー・取引・価格を Excel 向け CSV にし、ZIP で一括ダウンロードする。
 */

import { zipSync, strToU8 } from 'fflate';
import type {
  BacktestRunDto,
  BacktestTradeDto,
  DailyPriceDto,
} from '@market/shared-types';
import {
  formatStrategyLabel,
  formatTradeReason,
} from '@market/shared-types';
import {
  dailyGroupCsvHeaders,
  dailyIndicatorCsvHeaders,
  formatGroupCell,
  formatIndicatorCell,
  formatScoreCell,
  scoreGroupColumns,
  scoreIndicatorColumns,
  tradeGroupCsvHeaders,
  tradeIndicatorCsvHeaders,
} from './backtest-score-columns';

export type BacktestExportArgs = {
  run: BacktestRunDto;
  prices: DailyPriceDto[];
  symbolCode?: string | null;
  indicatorSetName?: string | null;
};

/** CSV 1 セルをエスケープする（カンマ・引用符・改行を含む場合は引用）。 */
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) {
    return '';
  }
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * ヘッダと行から CSV 文字列を組み立てる。
 * Excel 向けに UTF-8 BOM を先頭へ付与する。
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

/** 日付キーで価格を引くための Map を作る。 */
function priceByDate(prices: DailyPriceDto[]): Map<string, DailyPriceDto> {
  const map = new Map<string, DailyPriceDto>();
  for (const price of prices) {
    map.set(price.date, price);
  }
  return map;
}

/** その日の売買イベント文字列を返す（同日は buy;sell）。 */
function tradeEventForDate(
  date: string,
  trades: BacktestTradeDto[],
): string {
  const hasBuy = trades.some((t) => t.entryDate === date);
  const hasSell = trades.some((t) => t.exitDate === date);
  if (hasBuy && hasSell) {
    return 'buy;sell';
  }
  if (hasBuy) {
    return 'buy';
  }
  if (hasSell) {
    return 'sell';
  }
  return '';
}

/**
 * エクイティ 1 点あたり 1 行の日次詳細を組み立てる。
 * 価格は日付で結合し、無い日は空欄。スコア内訳は group_* / 指標 ID 列へ平坦化。
 */
export function buildDailyDetailRows(
  run: BacktestRunDto,
  prices: DailyPriceDto[],
): { headers: string[]; rows: (string | number | null | undefined)[][] } {
  const groupCols = scoreGroupColumns();
  const indicatorCols = scoreIndicatorColumns();
  const headers = [
    'date',
    'cash',
    'positionValue',
    'equity',
    'drawdownRate',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'hasPosition',
    'tradeEvent',
    'decisionScore',
    ...dailyGroupCsvHeaders(),
    ...dailyIndicatorCsvHeaders(),
  ];
  const byDate = priceByDate(prices);
  const rows = run.equityPoints.map((point) => {
    const price = byDate.get(point.date);
    const breakdown = point.scoreBreakdown;
    const groupCells = groupCols.map((col) => formatGroupCell(breakdown, col.id));
    const indicatorCells = indicatorCols.map((col) =>
      formatIndicatorCell(breakdown, col.id),
    );
    return [
      point.date,
      point.cash,
      point.positionValue,
      point.equity,
      point.drawdownRate,
      price?.open ?? '',
      price?.high ?? '',
      price?.low ?? '',
      price?.close ?? '',
      price?.volume ?? '',
      point.positionValue > 0 ? 1 : 0,
      tradeEventForDate(point.date, run.trades),
      formatScoreCell(point.decisionScore),
      ...groupCells,
      ...indicatorCells,
    ];
  });
  return { headers, rows };
}

/** 実行メタとサマリーを 1 行の CSV にする。 */
export function buildSummaryCsv(
  run: BacktestRunDto,
  symbolCode?: string | null,
  indicatorSetName?: string | null,
): string {
  const headers = [
    'id',
    'symbolId',
    'symbolCode',
    'indicatorSetId',
    'indicatorSetName',
    'strategy',
    'fromDate',
    'toDate',
    'initialCash',
    'feeRate',
    'slippageRate',
    'finalEquity',
    'totalReturnRate',
    'maxDrawdownRate',
    'totalTrades',
    'winRate',
    'sharpeRatio',
    'profitFactor',
    'buyHoldReturnRate',
    'buyHoldFinalEquity',
  ];
  const s = run.summary;
  const row: (string | number | null | undefined)[] = [
    run.id,
    run.symbolId,
    symbolCode ?? '',
    run.indicatorSetId,
    indicatorSetName ?? '',
    formatStrategyLabel(run.strategyType, run.params),
    run.fromDate,
    run.toDate,
    run.initialCash,
    run.feeRate,
    run.slippageRate,
    s.finalEquity,
    s.totalReturnRate,
    s.maxDrawdownRate,
    s.totalTrades,
    s.winRate,
    s.sharpeRatio,
    s.profitFactor,
    s.buyHoldReturnRate,
    s.buyHoldFinalEquity,
  ];
  return toCsv(headers, [row]);
}

/** 全約定を CSV にする（スコア内訳は entry_/exit_ グループ・指標列へ平坦化）。 */
export function buildTradesCsv(run: BacktestRunDto): string {
  const groupCols = scoreGroupColumns();
  const indicatorCols = scoreIndicatorColumns();
  const headers = [
    'id',
    'backtestRunId',
    'symbolId',
    'entryDate',
    'exitDate',
    'entryPrice',
    'exitPrice',
    'quantity',
    'side',
    'grossPnl',
    'feeAmount',
    'slippageAmount',
    'netPnl',
    'entryReason',
    'exitReason',
    'entryScore',
    'exitScore',
    ...tradeGroupCsvHeaders(),
    ...tradeIndicatorCsvHeaders(),
  ];
  const rows = run.trades.map((trade) => {
    const groupCells = groupCols.flatMap((col) => [
      formatGroupCell(trade.entryScoreBreakdown, col.id),
      formatGroupCell(trade.exitScoreBreakdown, col.id),
    ]);
    const indicatorCells = indicatorCols.flatMap((col) => [
      formatIndicatorCell(trade.entryScoreBreakdown, col.id),
      formatIndicatorCell(trade.exitScoreBreakdown, col.id),
    ]);
    return [
      trade.id,
      trade.backtestRunId,
      trade.symbolId,
      trade.entryDate,
      trade.exitDate,
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
      trade.side,
      trade.grossPnl,
      trade.feeAmount,
      trade.slippageAmount,
      trade.netPnl,
      formatTradeReason(trade.entryReason),
      formatTradeReason(trade.exitReason),
      trade.entryScore,
      trade.exitScore,
      ...groupCells,
      ...indicatorCells,
    ];
  });
  return toCsv(headers, rows);
}

/** 日足価格のみの CSV。 */
export function buildPricesCsv(prices: DailyPriceDto[]): string {
  const headers = ['date', 'open', 'high', 'low', 'close', 'volume'];
  const rows = prices.map((p) => [p.date, p.open, p.high, p.low, p.close, p.volume]);
  return toCsv(headers, rows);
}

/** 4 種 CSV を ZIP（Uint8Array）にまとめる。 */
export function buildBacktestExportZip(args: BacktestExportArgs): Uint8Array {
  const { run, prices, symbolCode, indicatorSetName } = args;
  const daily = buildDailyDetailRows(run, prices);
  const files: Record<string, Uint8Array> = {
    'daily_detail.csv': strToU8(toCsv(daily.headers, daily.rows)),
    'summary.csv': strToU8(buildSummaryCsv(run, symbolCode, indicatorSetName)),
    'trades.csv': strToU8(buildTradesCsv(run)),
    'prices.csv': strToU8(buildPricesCsv(prices)),
  };
  return zipSync(files);
}

/**
 * ZIP を生成してブラウザでダウンロードする。
 * ファイル名は `backtest_{run.id}_daily.zip`。
 */
export function downloadBacktestExportZip(args: BacktestExportArgs): void {
  const bytes = buildBacktestExportZip(args);
  // TS の BlobPart は ArrayBuffer を要求するため、ビューを独立バッファへコピーする
  const blob = new Blob([bytes.slice().buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `backtest_${args.run.id}_daily.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}