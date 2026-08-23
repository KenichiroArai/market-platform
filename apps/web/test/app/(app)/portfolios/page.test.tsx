/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PortfoliosPage from '../../../../app/(app)/portfolios/page';
import {
  ApiClientError,
  addPortfolioHolding,
  createPortfolio,
  deletePortfolio,
  fetchPortfolios,
  fetchSymbols,
  removePortfolioHolding,
  updatePortfolioHolding,
} from '../../../../lib/api-client';

jest.mock('../../../../lib/api-client', () => ({
  fetchPortfolios: jest.fn(),
  fetchSymbols: jest.fn(),
  createPortfolio: jest.fn(),
  deletePortfolio: jest.fn(),
  addPortfolioHolding: jest.fn(),
  updatePortfolioHolding: jest.fn(),
  removePortfolioHolding: jest.fn(),
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

const portfolio = {
  id: 'pf_1',
  userId: 'user_1',
  name: 'Core',
  holdings: [
    {
      id: 'h_1',
      portfolioId: 'pf_1',
      symbolId: 'sym_1',
      symbol,
      quantity: 10,
      averageCost: 100,
      costBasis: 1000,
      marketPrice: 110,
      marketValue: 1100,
      unrealizedPnl: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  totalsByCurrency: [
    {
      currency: 'USD',
      totalCost: 1000,
      totalMarketValue: 1100,
      unrealizedPnl: 100,
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PortfoliosPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads portfolios and supports CRUD flows', async () => {
    (fetchPortfolios as jest.Mock).mockResolvedValue([portfolio]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (createPortfolio as jest.Mock).mockResolvedValue({
      ...portfolio,
      id: 'pf_2',
      name: 'Sat',
      holdings: [],
      totalsByCurrency: [],
    });
    (addPortfolioHolding as jest.Mock).mockResolvedValue(portfolio);
    (updatePortfolioHolding as jest.Mock).mockResolvedValue(portfolio);
    (removePortfolioHolding as jest.Mock).mockResolvedValue({
      ...portfolio,
      holdings: [],
      totalsByCurrency: [],
    });
    (deletePortfolio as jest.Mock).mockResolvedValue(null);

    render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Core' })).toBeInTheDocument();
      expect(screen.getByText(/USD:/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'チャート' })).toHaveAttribute(
      'href',
      '/charts?symbolId=sym_1',
    );

    fireEvent.change(screen.getByPlaceholderText('新しいポートフォリオ名'), {
      target: { value: 'Sat' },
    });
    fireEvent.submit(screen.getByPlaceholderText('新しいポートフォリオ名').closest('form')!);
    await waitFor(() => {
      expect(createPortfolio).toHaveBeenCalledWith('Sat');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Core' }));
    fireEvent.change(screen.getByPlaceholderText('数量'), { target: { value: '12' } });
    fireEvent.change(screen.getByPlaceholderText('平均取得単価'), { target: { value: '98' } });
    fireEvent.submit(screen.getByRole('button', { name: '保有を追加' }).closest('form')!);
    await waitFor(() => {
      expect(addPortfolioHolding).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '数量/単価を反映' }));
    await waitFor(() => {
      expect(updatePortfolioHolding).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(removePortfolioHolding).toHaveBeenCalledWith('pf_1', 'h_1');
    });

    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(deletePortfolio).toHaveBeenCalled();
    });
  });

  it('shows load and mutation error messages', async () => {
    (fetchPortfolios as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'load-fail'));
    (fetchSymbols as jest.Mock).mockResolvedValue([]);

    const { unmount } = render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByText('load-fail')).toBeInTheDocument();
    });
    unmount();

    (fetchPortfolios as jest.Mock).mockRejectedValue(new Error('x'));
    render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByText('読み込みに失敗しました')).toBeInTheDocument();
    });
  });

  it('covers create / holding / delete error branches', async () => {
    (fetchPortfolios as jest.Mock).mockResolvedValue([portfolio]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (createPortfolio as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'create-fail'));
    (addPortfolioHolding as jest.Mock).mockRejectedValue(new Error('x'));
    (updatePortfolioHolding as jest.Mock).mockRejectedValue(
      new ApiClientError(400, 'X', 'upd-fail'),
    );
    (removePortfolioHolding as jest.Mock).mockRejectedValue(new Error('x'));
    (deletePortfolio as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'del-fail'));

    render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByText(/qty=/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('新しいポートフォリオ名'), {
      target: { value: 'X' },
    });
    fireEvent.submit(screen.getByPlaceholderText('新しいポートフォリオ名').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('create-fail')).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole('button', { name: '保有を追加' }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('保有追加に失敗しました')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '数量/単価を反映' }));
    await waitFor(() => {
      expect(screen.getByText('upd-fail')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(screen.getByText('保有削除に失敗しました')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(screen.getByText('del-fail')).toBeInTheDocument();
    });

    (createPortfolio as jest.Mock).mockRejectedValue(new Error('x'));
    fireEvent.change(screen.getByPlaceholderText('新しいポートフォリオ名'), {
      target: { value: 'Y' },
    });
    fireEvent.submit(screen.getByPlaceholderText('新しいポートフォリオ名').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('作成に失敗しました')).toBeInTheDocument();
    });

    (updatePortfolioHolding as jest.Mock).mockRejectedValue(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: '数量/単価を反映' }));
    await waitFor(() => {
      expect(screen.getByText('保有更新に失敗しました')).toBeInTheDocument();
    });

    (removePortfolioHolding as jest.Mock).mockRejectedValue(
      new ApiClientError(400, 'X', 'rm-fail'),
    );
    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(screen.getByText('rm-fail')).toBeInTheDocument();
    });

    (deletePortfolio as jest.Mock).mockRejectedValue(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(screen.getByText('削除に失敗しました')).toBeInTheDocument();
    });
  });

  it('shows empty totals and n/a prices', async () => {
    (fetchPortfolios as jest.Mock).mockResolvedValue([
      {
        ...portfolio,
        holdings: [
          {
            ...portfolio.holdings[0],
            marketPrice: null,
            marketValue: null,
            unrealizedPnl: null,
          },
        ],
        totalsByCurrency: [],
      },
    ]);
    (fetchSymbols as jest.Mock).mockResolvedValue([
      symbol,
      { ...symbol, id: 'sym_2', ticker: 'MSFT' },
    ]);

    render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByText('保有がありません')).toBeInTheDocument();
      expect(screen.getByText(/price=n\/a/)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sym_2' } });
  });

  it('loads empty portfolios and deletes the last one', async () => {
    (fetchPortfolios as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);

    const { unmount } = render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: '銘柄を追加' })).toHaveAttribute('href', '/symbols');
    });
    unmount();

    (fetchPortfolios as jest.Mock).mockResolvedValue([portfolio]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (deletePortfolio as jest.Mock).mockResolvedValue(undefined);
    (addPortfolioHolding as jest.Mock).mockRejectedValue(
      new ApiClientError(400, 'X', 'add-hold-fail'),
    );

    render(<PortfoliosPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Core' })).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole('button', { name: '保有を追加' }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('add-hold-fail')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '選択中を削除' })).not.toBeInTheDocument();
    });
  });
});
