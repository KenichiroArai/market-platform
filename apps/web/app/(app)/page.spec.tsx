/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import { fetchApiHealth } from '../../lib/fetch-api-health';

jest.mock('../../lib/fetch-api-health', () => ({
  fetchApiHealth: jest.fn(),
}));

describe('HomePage', () => {
  const originalUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalUrl;
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
    expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登録' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ウォッチリスト' })).not.toBeInTheDocument();
  });

  it('renders connection error when health is unavailable', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    (fetchApiHealth as jest.Mock).mockResolvedValue(null);

    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByText('API に接続できませんでした（http://localhost:3001）。'),
    ).toBeInTheDocument();
  });

  it('shows configured api url in the error message', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://custom:3001';
    (fetchApiHealth as jest.Mock).mockResolvedValue(null);

    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByText('API に接続できませんでした（http://custom:3001）。'),
    ).toBeInTheDocument();
  });
});
