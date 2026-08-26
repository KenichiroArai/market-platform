import { signalRulePreviewText } from '../../lib/signal-rule-preview';

describe('signalRulePreviewText', () => {
  it('describes a resolved SMA cross rule', () => {
    expect(signalRulePreviewText(['sma25', 'sma75'])).toContain('バックテスト用');
    expect(signalRulePreviewText(new Set(['sma25', 'sma75']))).toContain('SMAクロス');
  });

  it('explains unresolved selections', () => {
    expect(signalRulePreviewText(['bb'])).toContain('未確定');
    expect(signalRulePreviewText(['sma25'])).toContain('ちょうど 2 本');
  });
});
