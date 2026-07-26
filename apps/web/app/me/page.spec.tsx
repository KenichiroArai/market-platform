/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MePage from './page';
import { ApiClientError, fetchCurrentUser } from '../../lib/api-client';
import { clearAccessToken, getAccessToken } from '../../lib/auth-token';
import { useRouter } from 'next/navigation';

jest.mock('../../lib/api-client', () => ({
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

jest.mock('../../lib/auth-token', () => ({
  getAccessToken: jest.fn(),
  clearAccessToken: jest.fn(),
}));

describe('MePage', () => {
  const push = jest.fn();
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push, replace });
  });

  it('redirects to login when token is missing', async () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<MePage />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('loads and displays the current user', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ id: '1', email: 'a@b.c' });

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByText(/"email": "a@b.c"/)).toBeInTheDocument();
    });
  });

  it('shows ApiClientError message', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockRejectedValue(new ApiClientError(401, 'X', 'expired'));

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByText('expired')).toBeInTheDocument();
    });
  });

  it('shows fallback message for unknown errors', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockRejectedValue(new Error('x'));

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByText('取得に失敗しました')).toBeInTheDocument();
    });
  });

  it('logs out and navigates to login', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ id: '1', email: 'a@b.c' });

    render(<MePage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(clearAccessToken).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/login');
  });
});
