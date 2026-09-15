/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import AnalysisHubPage from '../../../../app/(app)/analysis/page';

describe('AnalysisHubPage', () => {
  it('renders hub links and future items', () => {
    render(<AnalysisHubPage />);
    expect(screen.getByRole('heading', { name: '分析' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /チャート分析/ })).toHaveAttribute('href', '/charts');
    expect(screen.getByRole('link', { name: /戦略（トレードプラン）/ })).toHaveAttribute(
      'href',
      '/strategy',
    );
    expect(screen.getByText('テクニカル分析（詳細）')).toBeInTheDocument();
    expect(screen.getByText('トレンド分析')).toBeInTheDocument();
    expect(screen.getByText('ファンダメンタル分析')).toBeInTheDocument();
  });
});
