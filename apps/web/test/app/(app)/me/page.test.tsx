/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import MePage from '../../../../app/(app)/me/page';
import { ApiClientError, fetchCurrentUser } from '../../../../lib/api-client';

jest.mock('../../../../lib/api-client', () => ({
  fetchCurrentUser: jest.fn(),
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

describe('MePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays the current user', async () => {
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ id: '1', email: 'a@b.c' });

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByText(/"email": "a@b.c"/)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'プロフィール' })).toBeInTheDocument();
    expect(screen.getByText('ログイン中のアカウント情報を確認します。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument();
  });

  it('shows ApiClientError message', async () => {
    (fetchCurrentUser as jest.Mock).mockRejectedValue(new ApiClientError(401, 'X', 'expired'));

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByText('expired')).toBeInTheDocument();
    });
  });

  it('shows fallback message for unknown errors', async () => {
    (fetchCurrentUser as jest.Mock).mockRejectedValue(new Error('x'));

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByText('取得に失敗しました')).toBeInTheDocument();
    });
  });

  it('ignores a successful fetch after unmount', async () => {
    let resolveMe!: (value: { id: string; email: string }) => void;
    (fetchCurrentUser as jest.Mock).mockReturnValue(
      new Promise<{ id: string; email: string }>((resolve) => {
        resolveMe = resolve;
      }),
    );

    const { unmount } = render(<MePage />);
    unmount();
    resolveMe({ id: '1', email: 'a@b.c' });
    await waitFor(() => {
      expect(screen.queryByText(/"email": "a@b.c"/)).not.toBeInTheDocument();
    });
  });

  it('ignores a failed fetch after unmount', async () => {
    let rejectMe!: (reason: Error) => void;
    (fetchCurrentUser as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMe = reject;
      }),
    );

    const { unmount } = render(<MePage />);
    unmount();
    rejectMe(new Error('x'));
    await waitFor(() => {
      expect(screen.queryByText('取得に失敗しました')).not.toBeInTheDocument();
    });
  });
});
