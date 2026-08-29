import { render, screen } from '@testing-library/react';
import type { BacktestEquityPointDto, BacktestSummaryDto, BacktestTradeDto, DailyPriceDto } from '@market/shared-types';
import { BacktestEquityChart } from '../../components/backtest-equity-chart';
import { BacktestSummaryCards } from '../../components/backtest-summary-cards';
import { BacktestTradesTable } from '../../components/backtest-trades-table';

jest.mock('recharts', () => {
  const React = require('react') as typeof import('react');
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="equity-line-chart">{children}</div>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Line: () => null,
  };
});

const summary: BacktestSummaryDto = {
  finalEquity: 110000,
  totalReturnRate: 0.1,
  maxDrawdownRate: 0.05,
  totalTrades: 2,
  winRate: 0.5,
  sharpeRatio: 1.25,
  profitFactor: 1.8,
  buyHoldReturnRate: 0.08,
  buyHoldFinalEquity: 108000,
};

const trade: BacktestTradeDto = {
  id: 't_1',
  backtestRunId: 'run_1',
  symbolId: 'sym_1',
  entryDate: '2026-01-02',
  exitDate: '2026-01-05',
  entryPrice: 100,
  exitPrice: 110,
  quantity: 1,
  side: 'buy',
  grossPnl: 10,
  feeAmount: 0,
  slippageAmount: 0,
  netPnl: 10,
  entryReason: 'sma_golden_cross',
  exitReason: 'sma_dead_cross',
  entryScore: null,
  exitScore: null,
  entryScoreBreakdown: null,
  exitScoreBreakdown: null,
};

const equity: BacktestEquityPointDto = {
  id: 'e_1',
  backtestRunId: 'run_1',
  date: '2026-01-02',
  cash: 0,
  positionValue: 100,
  equity: 100,
  drawdownRate: 0,
  decisionScore: null,
  scoreBreakdown: null,
};

const price: DailyPriceDto = {
  id: 'p_1',
  symbolId: 'sym_1',
  date: '2026-01-02',
  open: 100,
  high: 100,
  low: 100,
  close: 100,
  volume: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BacktestSummaryCards', () => {
  it('renders key metrics', () => {
    render(<BacktestSummaryCards summary={summary} />);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
    expect(screen.getByText('リターン')).toBeInTheDocument();
    expect(screen.getByText('10.00%')).toBeInTheDocument();
    expect(screen.getByText('Sharpe')).toBeInTheDocument();
  });

  it('renders money management stats when present', () => {
    render(
      <BacktestSummaryCards
        summary={{
          ...summary,
          moneyManagement: {
            averageRiskRate: 0.01,
            maxRiskRate: 0.02,
            averageAtr: 1.5,
            averageUnits: 2,
            maxUnits: 4,
            pyramidingSuccessRate: 0.5,
            averageRiskRateInDrawdown: 0.005,
          },
        }}
      />,
    );
    expect(screen.getByText('平均リスク率')).toBeInTheDocument();
    expect(screen.getByText('ピラミッド成功率')).toBeInTheDocument();
    expect(screen.getByText('DD時平均リスク')).toBeInTheDocument();
    expect(screen.getByText('0.50%')).toBeInTheDocument();
  });

  it('renders em dash for null money management stats', () => {
    render(
      <BacktestSummaryCards
        summary={{
          ...summary,
          moneyManagement: {
            averageRiskRate: null,
            maxRiskRate: null,
            averageAtr: null,
            averageUnits: null,
            maxUnits: null,
            pyramidingSuccessRate: null,
            averageRiskRateInDrawdown: null,
          },
        }}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('BacktestTradesTable', () => {
  it('shows empty message', () => {
    render(<BacktestTradesTable trades={[]} />);
    expect(screen.getByText('取引はありません')).toBeInTheDocument();
  });

  it('renders trade rows', () => {
    render(<BacktestTradesTable trades={[trade]} />);
    expect(screen.getByTestId('trades-table')).toBeInTheDocument();
    expect(screen.getByText('2026-01-02')).toBeInTheDocument();
    expect(screen.getByText('10.00')).toBeInTheDocument();
    expect(screen.getByText('エントリー日')).toBeInTheDocument();
    expect(screen.getByText('買い判断')).toBeInTheDocument();
    expect(screen.getByTestId('trade-entry-reason-t_1')).toHaveTextContent('SMAゴールデンクロス');
    expect(screen.getByTestId('trade-exit-reason-t_1')).toHaveTextContent('SMAデッドクロス');
  });

  it('renders money management columns', () => {
    render(
      <BacktestTradesTable
        showMoneyManagement
        trades={[
          {
            ...trade,
            side: 'sell',
            atr: 1.25,
            n: 1.25,
            riskRate: 0.01,
            initialQuantity: 10,
            addCount: 1,
            stopPrice: 95,
            unitCount: 2,
          },
        ]}
      />,
    );
    expect(screen.getByText('ショート')).toBeInTheDocument();
    expect(screen.getByText('ATR')).toBeInTheDocument();
    expect(screen.getAllByText('1.25')).toHaveLength(2);
    expect(screen.getByText('1.00%')).toBeInTheDocument();
  });

  it('renders empty money management cells when fields are null', () => {
    render(
      <BacktestTradesTable
        showMoneyManagement
        trades={[
          {
            ...trade,
            atr: null,
            n: null,
            riskRate: null,
            initialQuantity: null,
            addCount: null,
            stopPrice: null,
            unitCount: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('ロング')).toBeInTheDocument();
    expect(screen.getByText('ATR')).toBeInTheDocument();
  });

  it('leaves reason cells blank when codes are null', () => {
    render(
      <BacktestTradesTable
        trades={[
          {
            ...trade,
            id: 't_blank',
            entryReason: null,
            exitReason: null,
            entryScore: null,
            exitScore: null,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trade-entry-reason-t_blank')).toHaveTextContent('');
    expect(screen.getByTestId('trade-exit-reason-t_blank')).toHaveTextContent('');
  });

  it('shows score columns separately without duplicating into reason text', () => {
    render(
      <BacktestTradesTable
        strategyType="rsiThreshold"
        trades={[
          {
            ...trade,
            id: 't_rsi',
            entryReason: 'rsi_oversold',
            exitReason: 'rsi_overbought',
            entryScore: 28.4,
            exitScore: 72.1,
          },
        ]}
      />,
    );
    expect(screen.getByText('エントリースコア')).toBeInTheDocument();
    expect(screen.getByText('エグジットスコア')).toBeInTheDocument();
    expect(screen.getByTestId('trade-entry-reason-t_rsi')).toHaveTextContent('RSI売られすぎ');
    expect(screen.getByTestId('trade-exit-reason-t_rsi')).toHaveTextContent('RSI買われすぎ');
    expect(screen.getByTestId('trade-entry-score-t_rsi')).toHaveTextContent('28.4');
    expect(screen.getByTestId('trade-exit-score-t_rsi')).toHaveTextContent('72.1');
  });

  it('shows score columns when trades have scores even without strategyType', () => {
    render(
      <BacktestTradesTable
        trades={[
          {
            ...trade,
            id: 't_score',
            entryReason: 'score_cross_up',
            exitReason: 'score_cross_down',
            entryScore: 42.3,
            exitScore: -10,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trade-entry-score-t_score')).toHaveTextContent('42.3');
    expect(screen.getByTestId('trade-exit-score-t_score')).toHaveTextContent('-10');
    expect(screen.getByTestId('trade-entry-reason-t_score')).toHaveTextContent('スコア上昇クロス');
  });

  it('hides score columns for cross strategies without scores', () => {
    render(<BacktestTradesTable trades={[trade]} strategyType="smaCross" />);
    expect(screen.queryByText('エントリースコア')).not.toBeInTheDocument();
    expect(screen.queryByText('エグジットスコア')).not.toBeInTheDocument();
  });

  it('leaves score cells blank for null or non-finite scores', () => {
    render(
      <BacktestTradesTable
        strategyType="rsiThreshold"
        trades={[
          {
            ...trade,
            id: 't_blank_score',
            entryReason: 'rsi_oversold',
            exitReason: 'rsi_overbought',
            entryScore: null,
            exitScore: Number.NaN,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trade-entry-score-t_blank_score')).toHaveTextContent('');
    expect(screen.getByTestId('trade-exit-score-t_blank_score')).toHaveTextContent('');
  });

  it('shows indicator breakdown columns for trendScoreThreshold', () => {
    render(
      <BacktestTradesTable
        strategyType="trendScoreThreshold"
        trades={[
          {
            ...trade,
            id: 't_ts',
            entryReason: 'score_cross_up',
            exitReason: 'score_cross_down',
            entryScore: 55,
            exitScore: -20,
            entryScoreBreakdown: {
              groups: { trend: 10, momentum: 2 },
              indicators: { rsi: 12.5, macd: null, volume: 3 },
            },
            exitScoreBreakdown: {
              groups: { trend: -5 },
              indicators: { rsi: -8, macd: 1.5 },
            },
          },
        ]}
      />,
    );
    expect(screen.getByText('エントリースコア')).toBeInTheDocument();
    expect(screen.getByText('エントリートレンド')).toBeInTheDocument();
    expect(screen.getByText('エグジットトレンド')).toBeInTheDocument();
    expect(screen.getByText('エントリーモメンタム')).toBeInTheDocument();
    expect(screen.getByTestId('trade-entry-group-trend-t_ts')).toHaveTextContent('10');
    expect(screen.getByTestId('trade-exit-group-trend-t_ts')).toHaveTextContent('-5');
    expect(screen.getByTestId('trade-entry-group-momentum-t_ts')).toHaveTextContent('2');
    expect(screen.getByText('エントリーRSI')).toBeInTheDocument();
    expect(screen.getByText('エグジットRSI')).toBeInTheDocument();
    expect(screen.getByText('エントリーMACD')).toBeInTheDocument();
    expect(screen.getByText('エントリーvolume')).toBeInTheDocument();
    expect(screen.getByTestId('trade-entry-breakdown-rsi-t_ts')).toHaveTextContent('12.5');
    expect(screen.getByTestId('trade-exit-breakdown-rsi-t_ts')).toHaveTextContent('-8');
    expect(screen.getByTestId('trade-entry-breakdown-macd-t_ts')).toHaveTextContent('');
    expect(screen.getByTestId('trade-exit-breakdown-macd-t_ts')).toHaveTextContent('1.5');
    expect(screen.getByTestId('trade-entry-breakdown-volume-t_ts')).toHaveTextContent('3');
    expect(screen.getByTestId('trade-exit-breakdown-volume-t_ts')).toHaveTextContent('');
  });

  it('shows breakdown columns when only exitScoreBreakdown is present', () => {
    render(
      <BacktestTradesTable
        strategyType="trendScoreThreshold"
        trades={[
          {
            ...trade,
            id: 't_exit_only',
            entryReason: 'score_cross_up',
            exitReason: 'score_cross_down',
            entryScore: 40,
            exitScore: -15,
            entryScoreBreakdown: null,
            exitScoreBreakdown: {
              groups: { trend: -5 },
              indicators: { rsi: -8 },
            },
          },
        ]}
      />,
    );
    expect(screen.getByText('エグジットRSI')).toBeInTheDocument();
    expect(screen.getByTestId('trade-entry-breakdown-rsi-t_exit_only')).toHaveTextContent('');
    expect(screen.getByTestId('trade-exit-breakdown-rsi-t_exit_only')).toHaveTextContent('-8');
  });
});

describe('BacktestEquityChart', () => {
  it('shows empty message', () => {
    render(<BacktestEquityChart equityPoints={[]} prices={[]} initialCash={1000} />);
    expect(screen.getByText('エクイティデータがありません')).toBeInTheDocument();
  });

  it('renders chart', () => {
    render(
      <BacktestEquityChart equityPoints={[equity]} prices={[price]} initialCash={1000} />,
    );
    expect(screen.getByTestId('equity-chart')).toBeInTheDocument();
    expect(screen.getByTestId('equity-line-chart')).toBeInTheDocument();
  });

  it('handles missing or zero first close for Buy&Hold', () => {
    render(
      <BacktestEquityChart
        equityPoints={[equity]}
        prices={[{ ...price, close: 0 }]}
        initialCash={1000}
      />,
    );
    expect(screen.getByTestId('equity-chart')).toBeInTheDocument();

    render(
      <BacktestEquityChart equityPoints={[equity]} prices={[]} initialCash={1000} />,
    );
    expect(screen.getAllByTestId('equity-chart').length).toBeGreaterThanOrEqual(1);
  });
});
