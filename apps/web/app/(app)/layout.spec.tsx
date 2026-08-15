/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import AppLayout from './layout';
import { fetchCurrentUser } from '../../lib/api-client';
import { clearAccessToken, getAccessToken } from '../../lib/auth-token';

jest.mock('../../lib/api-client', () => ({
  fetchCurrentUser: jest.fn(),
}));

jest.mock('../../lib/auth-token', () => ({
  getAccessToken: jest.fn(),
  clearAccessToken: jest.fn(),
}));

describe('AppLayout', () => {
  const replace = jest.fn();
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace, push });
  });

  it('redirects to login when token is missing', async () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(
      <AppLayout>
        <p>app-child</p>
      </AppLayout>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('app-child')).not.toBeInTheDocument();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('clears token and redirects when /auth/me fails', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockRejectedValue(new Error('expired'));

    render(
      <AppLayout>
        <p>app-child</p>
      </AppLayout>,
    );

    await waitFor(() => {
      expect(clearAccessToken).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('app-child')).not.toBeInTheDocument();
  });

  it('renders header and children after the current user is confirmed', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ id: '1', email: 'a@b.c' });

    render(
      <AppLayout>
        <p>app-child</p>
      </AppLayout>,
    );

    expect(screen.getByText('読み込み中…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('app-child')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    expect(screen.queryByText('読み込み中…')).not.toBeInTheDocument();
  });

  it('logs out from the header', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchCurrentUser as jest.Mock).mockResolvedValue({ id: '1', email: 'a@b.c' });

    render(
      <AppLayout>
        <p>app-child</p>
      </AppLayout>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(clearAccessToken).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('ignores a successful /auth/me after unmount', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    let resolveMe!: (value: { id: string; email: string }) => void;
    (fetchCurrentUser as jest.Mock).mockReturnValue(
      new Promise<{ id: string; email: string }>((resolve) => {
        resolveMe = resolve;
      }),
    );

    const { unmount } = render(
      <AppLayout>
        <p>app-child</p>
      </AppLayout>,
    );
    unmount();
    resolveMe({ id: '1', email: 'a@b.c' });
    await waitFor(() => {
      expect(screen.queryByText('app-child')).not.toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('ignores a failed /auth/me after unmount', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    let rejectMe!: (reason: Error) => void;
    (fetchCurrentUser as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMe = reject;
      }),
    );

    const { unmount } = render(
      <AppLayout>
        <p>app-child</p>
      </AppLayout>,
    );
    unmount();
    rejectMe(new Error('expired'));
    await waitFor(() => {
      expect(clearAccessToken).not.toHaveBeenCalled();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
