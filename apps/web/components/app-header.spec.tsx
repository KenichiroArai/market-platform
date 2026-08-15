/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { APP_NAV_ITEMS, AppHeader } from './app-header';

describe('AppHeader', () => {
  it('renders brand, feature menu, and logout without auth links', () => {
    const onLogout = jest.fn();
    render(<AppHeader onLogout={onLogout} />);

    expect(screen.getByRole('link', { name: 'market-platform' })).toHaveAttribute('href', '/');
    for (const item of APP_NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
    }
    expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登録' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
