/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { ApiClientError, loginUser } from '../../lib/api-client';
import { setAccessToken } from '../../lib/auth-token';
import { useRouter } from 'next/navigation';

jest.mock('../../lib/api-client', () => ({
  loginUser: jest.fn(),
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
  setAccessToken: jest.fn(),
}));

describe('LoginPage', () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push, replace: jest.fn() });
  });

  it('logs in and navigates to /me', async () => {
    (loginUser as jest.Mock).mockResolvedValue({
      accessToken: 'tok',
      tokenType: 'Bearer',
      user: { id: '1', email: 'a@b.c' },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(setAccessToken).toHaveBeenCalledWith('tok');
      expect(push).toHaveBeenCalledWith('/me');
    });
  });

  it('shows ApiClientError message', async () => {
    (loginUser as jest.Mock).mockRejectedValue(new ApiClientError(401, 'X', 'bad creds'));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(screen.getByText('bad creds')).toBeInTheDocument();
    });
  });

  it('shows fallback message for unknown errors', async () => {
    (loginUser as jest.Mock).mockRejectedValue(new Error('network'));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(screen.getByText('ログインに失敗しました')).toBeInTheDocument();
    });
  });
});
