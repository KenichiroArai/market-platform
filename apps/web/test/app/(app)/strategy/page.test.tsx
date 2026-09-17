/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StrategyPage from '../../../../app/(app)/strategy/page';
import { ApiClientError, fetchSymbols, fetchTradePlan } from '../../../../lib/api-client';

jest.mock('../../../../lib/api-client', () => ({
  fetchSymbols: jest.fn(),
  fetchTradePlan: jest.fn(),
  ApiClientError: class ApiClientError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ApiClientError';
    }
  },
}));

const symbol = {
  id: 'sym_1',
  ticker: 'AAPL',
  market: 'US' as const,
  name: 'Apple Inc.',
  currency: 'USD',
  exchange: 'NASDAQ',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const samplePlan = {
  symbolId: 'sym_1',
  baseDate: '2026-06-15',
  judgment: {
    level: 'buy' as const,
    score: 68,
    stars: 4,
    label: 'やや買い',
    factors: [{ id: 'trend_score', label: 'トレンドスコア', contribution: 10, note: 'スコア 20' }],
  },
  entry: {
    currentPrice: 100,
    recommendedPrice: 98,
    side: 'long' as const,
    rationale: '押し目',
  },
  stopLossCandidates: [
    {
      method: 'atr_x2' as const,
      label: 'ATR×2',
      price: 94,
      rationale: 'ATR',
      recommended: true,
    },
    {
      method: 'ma' as const,
      label: '移動平均',
      price: 93,
      rationale: 'MA',
      recommended: false,
    },
  ],
  takeProfitCandidates: [
    {
      method: 'rr_target' as const,
      label: 'RR 2',
      price: 110,
      rationale: 'RR',
      recommended: true,
    },
    {
      method: 'none' as const,
      label: 'なし',
      price: 0,
      rationale: '利確なし',
      recommended: false,
    },
  ],
  recommendedStop: {
    method: 'atr_x2' as const,
    label: 'ATR×2',
    price: 94,
    rationale: 'ATR',
    recommended: true,
  },
  recommendedTarget: {
    method: 'rr_target' as const,
    label: 'RR 2',
    price: 110,
    rationale: 'RR',
    recommended: true,
  },
  riskReward: { entry: 98, stop: 94, target: 110, riskReward: 3 },
  position: {
    recommendedShares: 100,
    maxShares: 1000,
    requiredCapital: 9800,
    maxLoss: 400,
    equity: 100000,
    riskRate: 0.01,
  },
  riskRating: {
    level: 'medium' as const,
    stars: 3,
    atrPercent: 2.1,
    notes: ['ATR% は中程度'],
  },
  buyReasons: ['MACD 正'],
  sellReasons: [] as string[],
  overallScore: 72,
  summaryLabel: 'やや買い / 総合 72 点',
};

describe('StrategyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (fetchTradePlan as jest.Mock).mockResolvedValue(samplePlan);
    const { useSearchParams } = require('../../../../test/mocks/next-navigation');
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('applies query params for symbol and exit methods', async () => {
    const { useSearchParams } = require('../../../../test/mocks/next-navigation');
    useSearchParams.mockReturnValue(
      new URLSearchParams({
        symbolId: 'sym_2',
        from: '2026-01-01',
        to: '2026-06-30',
        stopMethod: 'atr',
        takeProfitMethod: 'fibonacci',
        equity: '500000',
        riskRate: '0.015',
      }),
    );
    (fetchSymbols as jest.Mock).mockResolvedValue([
      symbol,
      { ...symbol, id: 'sym_2', ticker: 'MSFT', name: 'Microsoft' },
    ]);
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_2'));
    expect(screen.getByTestId('strategy-equity')).toHaveValue(500000);
    expect(screen.getByTestId('strategy-risk-rate')).toHaveValue(0.015);
    expect(screen.getByTestId('strategy-stop-method')).toHaveValue('atr');
    expect(screen.getByTestId('strategy-take-profit-method')).toHaveValue('fibonacci');
    expect(screen.getByTestId('analysis-workflow-bar')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-next-backtests').getAttribute('href')).toContain(
      'from=2026-01-01',
    );
  });

  it('ignores invalid query method codes', async () => {
    const { useSearchParams } = require('../../../../test/mocks/next-navigation');
    useSearchParams.mockReturnValue(
      new URLSearchParams({
        stopMethod: 'not_a_method',
        takeProfitMethod: 'also_bad',
      }),
    );
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));
    expect(screen.getByTestId('strategy-stop-method')).toHaveValue('');
    expect(screen.getByTestId('strategy-take-profit-method')).toHaveValue('rr_target');
  });

  it('loads symbols and displays a trade plan', async () => {
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));

    fireEvent.change(screen.getByTestId('strategy-equity'), { target: { value: '2000000' } });
    fireEvent.change(screen.getByTestId('strategy-risk-rate'), { target: { value: '0.02' } });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1]!, { target: { value: 'atr_x2' } });
    fireEvent.change(selects[2]!, { target: { value: 'rr_target' } });

    fireEvent.click(screen.getByRole('button', { name: 'トレードプランを表示' }));
    await waitFor(() => expect(screen.getByTestId('trade-plan')).toBeInTheDocument());
    expect(fetchTradePlan).toHaveBeenCalledWith(
      'sym_1',
      expect.objectContaining({
        equity: 2_000_000,
        riskRate: 0.02,
        stopMethod: 'atr_x2',
        takeProfitMethod: 'rr_target',
      }),
    );
    expect(screen.getByTestId('trade-plan-judgment')).toHaveTextContent('やや買い');
    expect(screen.getByTestId('trade-plan-entry')).toHaveTextContent('買い');
    expect(screen.getByTestId('trade-plan-stop')).toHaveTextContent('94');
    expect(screen.getByTestId('trade-plan-target')).toHaveTextContent('110');
    expect(screen.getByTestId('trade-plan-rr')).toHaveTextContent('3.00');
    expect(screen.getByTestId('trade-plan-shares')).toHaveTextContent('100');
    expect(screen.getByTestId('trade-plan-buy-reasons')).toHaveTextContent('MACD 正');
    expect(screen.getByTestId('trade-plan-sell-reasons')).toHaveTextContent('（なし）');
  });

  it('renders sparse plan fields and short side', async () => {
    (fetchTradePlan as jest.Mock).mockResolvedValue({
      ...samplePlan,
      judgment: { ...samplePlan.judgment, stars: -1 },
      entry: { ...samplePlan.entry, side: 'short', rationale: '戻り売り' },
      recommendedStop: null,
      recommendedTarget: null,
      riskReward: null,
      position: null,
      riskRating: { ...samplePlan.riskRating, stars: 6, notes: ['高ボラ'] },
      buyReasons: [],
      sellReasons: ['トレンド転換'],
    });
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));
    fireEvent.click(screen.getByRole('button', { name: 'トレードプランを表示' }));
    await waitFor(() => expect(screen.getByTestId('trade-plan')).toBeInTheDocument());
    expect(screen.getByTestId('trade-plan-entry')).toHaveTextContent('売り');
    expect(screen.getByTestId('trade-plan-stop')).toHaveTextContent('—');
    expect(screen.getByTestId('trade-plan-target')).toHaveTextContent('—');
    expect(screen.getByTestId('trade-plan-rr')).toHaveTextContent('—');
    expect(screen.getByTestId('trade-plan-shares')).toHaveTextContent('—');
    expect(screen.getByTestId('trade-plan-buy-reasons')).toHaveTextContent('（なし）');
    expect(screen.getByTestId('trade-plan-sell-reasons')).toHaveTextContent('トレンド転換');
  });

  it('shows ApiClientError when symbols fail', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', '銘柄エラー'));
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-error')).toHaveTextContent('銘柄エラー'));
  });

  it('shows fallback when symbol fetch fails with unknown error', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<StrategyPage />);
    await waitFor(() =>
      expect(screen.getByTestId('strategy-error')).toHaveTextContent('銘柄の取得に失敗しました'),
    );
  });

  it('shows ApiClientError when trade plan fails', async () => {
    (fetchTradePlan as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'プラン失敗'));
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));
    fireEvent.click(screen.getByRole('button', { name: 'トレードプランを表示' }));
    await waitFor(() => expect(screen.getByTestId('strategy-error')).toHaveTextContent('プラン失敗'));
  });

  it('shows fallback when trade plan fails with unknown error', async () => {
    (fetchTradePlan as jest.Mock).mockRejectedValue(new Error('x'));
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));
    fireEvent.click(screen.getByRole('button', { name: 'トレードプランを表示' }));
    await waitFor(() =>
      expect(screen.getByTestId('strategy-error')).toHaveTextContent(
        'トレードプランの取得に失敗しました',
      ),
    );
  });

  it('ignores symbol fetch after unmount', async () => {
    let resolveSymbols!: (value: typeof symbol[]) => void;
    (fetchSymbols as jest.Mock).mockReturnValue(
      new Promise<typeof symbol[]>((resolve) => {
        resolveSymbols = resolve;
      }),
    );
    const { unmount } = render(<StrategyPage />);
    unmount();
    resolveSymbols([symbol]);
    await waitFor(() => {
      expect(screen.queryByTestId('strategy-symbol')).not.toBeInTheDocument();
    });
  });

  it('skips plan load when symbol is empty', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    render(<StrategyPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'トレードプランを表示' })).toBeDisabled(),
    );
    expect(fetchTradePlan).not.toHaveBeenCalled();
  });

  it('changes the selected symbol', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([
      symbol,
      { ...symbol, id: 'sym_2', ticker: 'MSFT', name: 'Microsoft' },
    ]);
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));
    fireEvent.change(screen.getByTestId('strategy-symbol'), { target: { value: 'sym_2' } });
    expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_2');
  });

  it('loads a plan without optional stop/take-profit overrides', async () => {
    render(<StrategyPage />);
    await waitFor(() => expect(screen.getByTestId('strategy-symbol')).toHaveValue('sym_1'));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2]!, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'トレードプランを表示' }));
    await waitFor(() => expect(fetchTradePlan).toHaveBeenCalled());
    expect(fetchTradePlan).toHaveBeenCalledWith(
      'sym_1',
      expect.not.objectContaining({ stopMethod: expect.anything() }),
    );
  });
});
