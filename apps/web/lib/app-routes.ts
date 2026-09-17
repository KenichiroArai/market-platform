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

export type StrategyHrefParams = {
  symbolId?: string;
  stopMethod?: string | null;
  takeProfitMethod?: string | null;
  equity?: number;
  riskRate?: number;
};

/** 戦略（トレードプラン）画面への URL。銘柄・損切／利確などを引き継ぐ。 */
export function strategyHref(params: StrategyHrefParams = {}): string {
  const search = new URLSearchParams();
  if (params.symbolId) {
    search.set('symbolId', params.symbolId);
  }
  if (params.stopMethod) {
    search.set('stopMethod', params.stopMethod);
  }
  if (params.takeProfitMethod) {
    search.set('takeProfitMethod', params.takeProfitMethod);
  }
  if (params.equity != null && Number.isFinite(params.equity)) {
    search.set('equity', String(params.equity));
  }
  if (params.riskRate != null && Number.isFinite(params.riskRate)) {
    search.set('riskRate', String(params.riskRate));
  }
  const qs = search.toString();
  return qs ? `/strategy?${qs}` : '/strategy';
}
