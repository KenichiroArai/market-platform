/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import GuestLayout from './layout';
import { getAccessToken } from '../../lib/auth-token';

jest.mock('../../lib/auth-token', () => ({
  getAccessToken: jest.fn(),
}));

describe('GuestLayout', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace, push: jest.fn() });
  });

  it('redirects to home when a token already exists', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    render(
      <GuestLayout>
        <p>guest-child</p>
      </GuestLayout>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
    expect(screen.queryByText('guest-child')).not.toBeInTheDocument();
  });

  it('renders children when unauthenticated', async () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(
      <GuestLayout>
        <p>guest-child</p>
      </GuestLayout>,
    );

    await waitFor(() => {
      expect(screen.getByText('guest-child')).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
