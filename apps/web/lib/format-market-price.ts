/**
 * 銘柄通貨に応じた価格表示（チャート・助言パネル共用）。
 */

/** 表示用通貨を決める。JP / `.T` は常に JPY（DB 誤設定より市場を優先）。 */
export function resolveDisplayCurrency(options: {
  currency?: string | null;
  market?: 'US' | 'JP' | string | null;
  ticker?: string | null;
}): string | null {
  const market = options.market?.trim().toUpperCase() ?? '';
  const ticker = options.ticker?.trim().toUpperCase() ?? '';
  if (market === 'JP' || ticker.endsWith('.T')) {
    return 'JPY';
  }
  const code = options.currency?.trim().toUpperCase() ?? '';
  if (code) {
    return code;
  }
  if (market === 'US') {
    return 'USD';
  }
  return null;
}

export function formatMarketPrice(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  const code = currency?.trim().toUpperCase() ?? '';
  if (code === 'JPY') {
    // 東証の呼値に合わせ、1000円未満は小数第1位まで
    const digits = value >= 1000 ? 0 : 1;
    return `${value.toLocaleString('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    })}円`;
  }
  if (code === 'USD') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** lightweight-charts 用の価格フォーマッタ（価格ペイン専用）。 */
export function marketPriceFormatter(currency?: string | null): (price: number) => string {
  return (price: number) => formatMarketPrice(price, currency);
}

/** 価格系列向け priceFormat。出来高・オシレータには付けない。 */
export function marketSeriesPriceFormat(currency?: string | null): {
  type: 'custom';
  formatter: (price: number) => string;
  minMove: number;
} | undefined {
  const code = currency?.trim().toUpperCase() ?? '';
  if (!code) {
    return undefined;
  }
  return {
    type: 'custom',
    formatter: marketPriceFormatter(code),
    minMove: code === 'JPY' ? 0.5 : 0.01,
  };
}
