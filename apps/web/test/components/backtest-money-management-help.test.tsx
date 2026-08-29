/**
 * @jest-environment jsdom
 */
import { MM_HELP, TRADE_SIDE_POLICY_HELP } from '../../components/backtest-money-management-help';

describe('backtest-money-management-help', () => {
  it('exports help texts for money management fields', () => {
    expect(MM_HELP.enabled.length).toBeGreaterThan(10);
    expect(MM_HELP.riskRate).toContain('リスク');
    expect(TRADE_SIDE_POLICY_HELP).toContain('ロングのみ');
  });
});
