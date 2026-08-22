/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from '../../../../app/(guest)/register/page';
import { ApiClientError, registerUser } from '../../../../lib/api-client';
import { setAccessToken } from '../../../../lib/auth-token';
import { useRouter } from 'next/navigation';

jest.mock('../../../../lib/api-client', () => ({
  registerUser: jest.fn(),
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

jest.mock('../../../../lib/auth-token', () => ({
  setAccessToken: jest.fn(),
}));

describe('RegisterPage', () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push, replace: jest.fn() });
  });

  it('registers and navigates to /', async () => {
    (registerUser as jest.Mock).mockResolvedValue({
      accessToken: 'tok',
      tokenType: 'Bearer',
      user: { id: '1', email: 'a@b.c' },
    });

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password（8文字以上）'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => {
      expect(setAccessToken).toHaveBeenCalledWith('tok');
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('shows ApiClientError message', async () => {
    (registerUser as jest.Mock).mockRejectedValue(new ApiClientError(409, 'X', 'taken'));

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password（8文字以上）'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => {
      expect(screen.getByText('taken')).toBeInTheDocument();
    });
  });

  it('shows fallback message for unknown errors', async () => {
    (registerUser as jest.Mock).mockRejectedValue('boom');

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password（8文字以上）'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => {
      expect(screen.getByText('登録に失敗しました')).toBeInTheDocument();
    });
  });
});
