/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SymbolsPage from './page';
import { ApiClientError, createSymbol, fetchSymbols } from '../../../lib/api-client';

jest.mock('../../../lib/api-client', () => ({
  fetchSymbols: jest.fn(),
  createSymbol: jest.fn(),
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

const apple = {
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

const toyota = {
  id: 'sym_2',
  ticker: '7203.T',
  market: 'JP' as const,
  name: 'Toyota Motor',
  currency: 'JPY',
  exchange: 'TSE',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SymbolsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads symbols and adds a new one sorted by market then ticker', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([apple]);
    (createSymbol as jest.Mock).mockResolvedValue(toyota);

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: '7203' } });
    fireEvent.change(screen.getByTestId('market-select'), { target: { value: 'JP' } });
    fireEvent.submit(screen.getByRole('button', { name: '追加' }).closest('form')!);

    await waitFor(() => {
      expect(createSymbol).toHaveBeenCalledWith({ ticker: '7203', market: 'JP' });
    });
    expect(screen.getByText(/7203\.T/)).toBeInTheDocument();
    expect((screen.getByTestId('ticker-input') as HTMLInputElement).value).toBe('');
  });

  it('sorts a US addition after an existing JP symbol', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([toyota]);
    (createSymbol as jest.Mock).mockResolvedValue(apple);

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText(/7203\.T/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'AAPL' } });
    fireEvent.submit(screen.getByRole('button', { name: '追加' }).closest('form')!);

    await waitFor(() => {
      expect(createSymbol).toHaveBeenCalledWith({ ticker: 'AAPL', market: 'US' });
    });
    const items = screen.getAllByRole('listitem').map((el) => el.textContent);
    expect(items[0]).toContain('7203.T');
    expect(items[1]).toContain('AAPL');
  });

  it('sorts by ticker when the market is the same', async () => {
    const msft = { ...apple, id: 'sym_3', ticker: 'MSFT', name: 'Microsoft' };
    (fetchSymbols as jest.Mock).mockResolvedValue([msft]);
    (createSymbol as jest.Mock).mockResolvedValue(apple);

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText(/MSFT/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'AAPL' } });
    fireEvent.submit(screen.getByRole('button', { name: '追加' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    });
    const items = screen.getAllByRole('listitem').map((el) => el.textContent);
    expect(items[0]).toContain('AAPL');
    expect(items[1]).toContain('MSFT');
  });

  it('shows empty state when there are no symbols', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText('まだ銘柄がありません。')).toBeInTheDocument();
    });
  });

  it('shows ApiClientError on load failure', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'boom'));

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument();
    });
  });

  it('shows fallback error on load failure', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new Error('x'));

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText('読み込みに失敗しました')).toBeInTheDocument();
    });
  });

  it('shows ApiClientError on create failure', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (createSymbol as jest.Mock).mockRejectedValue(new ApiClientError(404, 'X', 'quote-fail'));

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText('まだ銘柄がありません。')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'NOPE' } });
    fireEvent.submit(screen.getByRole('button', { name: '追加' }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('quote-fail')).toBeInTheDocument();
    });
  });

  it('shows fallback error on create failure', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([apple]);
    (createSymbol as jest.Mock).mockRejectedValue(new Error('x'));

    render(<SymbolsPage />);
    await waitFor(() => {
      expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'MSFT' } });
    fireEvent.submit(screen.getByRole('button', { name: '追加' }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('登録に失敗しました')).toBeInTheDocument();
    });
  });

  it('ignores a successful load after unmount', async () => {
    let resolveLoad!: (value: typeof apple[]) => void;
    (fetchSymbols as jest.Mock).mockReturnValue(
      new Promise<typeof apple[]>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const { unmount } = render(<SymbolsPage />);
    unmount();
    resolveLoad([apple]);
    await waitFor(() => {
      expect(screen.queryByText(/AAPL/)).not.toBeInTheDocument();
    });
  });

  it('ignores a failed load after unmount', async () => {
    let rejectLoad!: (reason: Error) => void;
    (fetchSymbols as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectLoad = reject;
      }),
    );

    const { unmount } = render(<SymbolsPage />);
    unmount();
    rejectLoad(new Error('x'));
    await waitFor(() => {
      expect(screen.queryByText('読み込みに失敗しました')).not.toBeInTheDocument();
    });
  });
});
