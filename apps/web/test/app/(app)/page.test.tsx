/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import HomePage from '../../../app/(app)/page';
import { fetchApiHealth } from '../../../lib/fetch-api-health';

jest.mock('../../../lib/fetch-api-health', () => ({
  fetchApiHealth: jest.fn(),
}));

describe('HomePage', () => {
  const originalPublic = process.env.NEXT_PUBLIC_API_URL;
  const originalInternal = process.env.API_INTERNAL_URL;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalPublic === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublic;
    }
    if (originalInternal === undefined) {
      delete process.env.API_INTERNAL_URL;
    } else {
      process.env.API_INTERNAL_URL = originalInternal;
    }
  });

  it('renders health payload when available', async () => {
    (fetchApiHealth as jest.Mock).mockResolvedValue({
      status: 'ok',
      service: 'api',
      details: { database: 'up' },
    });

    const ui = await HomePage();
    render(ui);

    expect(screen.getByRole('heading', { name: 'market-platform' })).toBeInTheDocument();
    expect(screen.getByText(/"database": "up"/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '銘柄' })).toHaveAttribute('href', '/symbols');
    expect(screen.getByRole('link', { name: 'ウォッチリスト' })).toHaveAttribute(
      'href',
      '/watchlists',
    );
    expect(screen.getByRole('link', { name: 'チャート分析' })).toHaveAttribute('href', '/charts');
    expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登録' })).not.toBeInTheDocument();
  });

  it('renders connection error when health is unavailable', async () => {
    delete process.env.API_INTERNAL_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    (fetchApiHealth as jest.Mock).mockResolvedValue(null);

    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByText('API に接続できませんでした（http://localhost:3001）。'),
    ).toBeInTheDocument();
  });

  it('shows configured server api url in the error message', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
    (fetchApiHealth as jest.Mock).mockResolvedValue(null);

    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByText('API に接続できませんでした（http://api:3001）。'),
    ).toBeInTheDocument();
  });
});
