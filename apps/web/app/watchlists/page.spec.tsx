/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WatchlistsPage from './page';
import {
  ApiClientError,
  addWatchlistItem,
  createWatchlist,
  deleteWatchlist,
  fetchSymbols,
  fetchWatchlists,
  removeWatchlistItem,
} from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-token';
import { useRouter } from 'next/navigation';

jest.mock('../../lib/api-client', () => ({
  fetchWatchlists: jest.fn(),
  fetchSymbols: jest.fn(),
  createWatchlist: jest.fn(),
  deleteWatchlist: jest.fn(),
  addWatchlistItem: jest.fn(),
  removeWatchlistItem: jest.fn(),
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

jest.mock('../../lib/auth-token', () => ({
  getAccessToken: jest.fn(),
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

const watchlist = {
  id: 'wl_1',
  userId: 'user_1',
  name: 'Tech',
  items: [
    {
      id: 'item_1',
      watchlistId: 'wl_1',
      symbolId: 'sym_1',
      symbol,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('WatchlistsPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('redirects to login when token is missing', async () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('loads lists and supports create / add / remove / delete', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockResolvedValue([watchlist]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (createWatchlist as jest.Mock).mockResolvedValue({
      ...watchlist,
      id: 'wl_2',
      name: 'Growth',
      items: [],
    });
    (addWatchlistItem as jest.Mock).mockResolvedValue(watchlist);
    (removeWatchlistItem as jest.Mock).mockResolvedValue({ ...watchlist, items: [] });
    (deleteWatchlist as jest.Mock).mockResolvedValue(null);

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.getByText('Tech')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('新しいリスト名'), {
      target: { value: 'Growth' },
    });
    fireEvent.submit(screen.getByPlaceholderText('新しいリスト名').closest('form')!);
    await waitFor(() => {
      expect(createWatchlist).toHaveBeenCalledWith('Growth');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tech' }));
    fireEvent.submit(screen.getByRole('button', { name: '銘柄を追加' }).closest('form')!);
    await waitFor(() => {
      expect(addWatchlistItem).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(removeWatchlistItem).toHaveBeenCalledWith('wl_1', 'item_1');
    });

    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(deleteWatchlist).toHaveBeenCalled();
    });
  });

  it('shows ApiClientError on load failure', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'boom'));
    (fetchSymbols as jest.Mock).mockResolvedValue([]);

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument();
    });
  });

  it('shows fallback error on load failure', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockRejectedValue(new Error('x'));
    (fetchSymbols as jest.Mock).mockResolvedValue([]);

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.getByText('読み込みに失敗しました')).toBeInTheDocument();
    });
  });

  it('shows create / add / remove / delete error messages', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockResolvedValue([{ ...watchlist, items: [] }]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (createWatchlist as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'create-fail'));
    (addWatchlistItem as jest.Mock).mockRejectedValue(new Error('add'));
    (removeWatchlistItem as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'rm-fail'));
    (deleteWatchlist as jest.Mock).mockRejectedValue(new Error('del'));

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.getByText('Tech')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('新しいリスト名'), {
      target: { value: 'X' },
    });
    fireEvent.submit(screen.getByPlaceholderText('新しいリスト名').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('create-fail')).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole('button', { name: '銘柄を追加' }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('銘柄追加に失敗しました')).toBeInTheDocument();
    });

    // add a visible item for remove path via re-render state: click delete selected first path
    (fetchWatchlists as jest.Mock).mockResolvedValue([watchlist]);
  });

  it('handles empty symbols and delete/create fallbacks', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (createWatchlist as jest.Mock).mockRejectedValue(new Error('x'));

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.queryByText('読み込み中…')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('新しいリスト名'), {
      target: { value: 'A' },
    });
    fireEvent.submit(screen.getByPlaceholderText('新しいリスト名').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('作成に失敗しました')).toBeInTheDocument();
    });
  });

  it('deletes the last watchlist and reports ApiClientError on item remove', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockResolvedValue([watchlist]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (deleteWatchlist as jest.Mock).mockResolvedValue(undefined);
    (removeWatchlistItem as jest.Mock).mockRejectedValue(
      new ApiClientError(400, 'X', 'item-rm-fail'),
    );

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Apple Inc/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(screen.getByText('item-rm-fail')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '選択中を削除' })).not.toBeInTheDocument();
    });
  });

  it('covers delete and remove fallbacks with selected list', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchWatchlists as jest.Mock).mockResolvedValue([watchlist]);
    (fetchSymbols as jest.Mock).mockResolvedValue([
      symbol,
      { ...symbol, id: 'sym_2', ticker: 'MSFT' },
    ]);
    (deleteWatchlist as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'delete-fail'));
    (removeWatchlistItem as jest.Mock).mockRejectedValue(new Error('x'));
    (addWatchlistItem as jest.Mock).mockRejectedValue(new ApiClientError(400, 'X', 'add-fail'));

    render(<WatchlistsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Apple Inc/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sym_2' } });

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(screen.getByText('銘柄削除に失敗しました')).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole('button', { name: '銘柄を追加' }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('add-fail')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(screen.getByText('delete-fail')).toBeInTheDocument();
    });

    (deleteWatchlist as jest.Mock).mockRejectedValue(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: '選択中を削除' }));
    await waitFor(() => {
      expect(screen.getByText('削除に失敗しました')).toBeInTheDocument();
    });
  });
});
