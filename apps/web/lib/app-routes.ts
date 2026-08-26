/**
 * 画面間ディープリンク用のパス組み立て。
 *
 * ヘッダーの静的ナビとは別に、銘柄 ID や期間をクエリで引き継ぐ。
 */

export function symbolsHref(): string {
  return '/symbols';
}

export type ChartsHrefParams = {
  symbolId?: string;
  watchlistId?: string;
  from?: string;
  to?: string;
};

/** チャート分析への URL。指定したクエリだけ付与する。 */
export function chartsHref(params: ChartsHrefParams = {}): string {
  const search = new URLSearchParams();
  if (params.symbolId) {
    search.set('symbolId', params.symbolId);
  }
  if (params.watchlistId) {
    search.set('watchlistId', params.watchlistId);
  }
  if (params.from) {
    search.set('from', params.from);
  }
  if (params.to) {
    search.set('to', params.to);
  }
  const qs = search.toString();
  return qs ? `/charts?${qs}` : '/charts';
}

export type BacktestsHrefParams = {
  indicatorSetId?: string;
  symbolId?: string;
  from?: string;
  to?: string;
};

/** バックテスト実行画面への URL。指標セット ID などをクエリで渡せる。 */
export function backtestsHref(params: BacktestsHrefParams = {}): string {
  const search = new URLSearchParams();
  if (params.indicatorSetId) {
    search.set('indicatorSetId', params.indicatorSetId);
  }
  if (params.symbolId) {
    search.set('symbolId', params.symbolId);
  }
  if (params.from) {
    search.set('from', params.from);
  }
  if (params.to) {
    search.set('to', params.to);
  }
  const qs = search.toString();
  return qs ? `/backtests?${qs}` : '/backtests';
}
