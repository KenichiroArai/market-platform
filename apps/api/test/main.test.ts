import { bootstrap } from '../src/bootstrap';
import { autoStartIfNeeded, shouldAutoStart, startApplication } from '../src/main';

jest.mock('../src/bootstrap', () => ({
  bootstrap: jest.fn(),
}));

describe('main', () => {
  it('startApplication delegates to bootstrap by default', async () => {
    (bootstrap as jest.Mock).mockResolvedValue('app');
    await expect(startApplication()).resolves.toBe('app');
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('startApplication can use an injected starter', async () => {
    const start = jest.fn().mockResolvedValue('custom');
    await expect(startApplication(start)).resolves.toBe('custom');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('shouldAutoStart is true when modules match', () => {
    const mod = { id: 'main' } as unknown as NodeModule;
    expect(shouldAutoStart(mod, mod)).toBe(true);
  });

  it('shouldAutoStart is false when modules differ or are missing', () => {
    const a = { id: 'a' } as unknown as NodeModule;
    const b = { id: 'b' } as unknown as NodeModule;
    expect(shouldAutoStart(a, b)).toBe(false);
    expect(shouldAutoStart(undefined, a)).toBe(false);
    expect(shouldAutoStart(a, undefined)).toBe(false);
  });

  it('shouldAutoStart reads require.main and module by default', () => {
    expect(typeof shouldAutoStart()).toBe('boolean');
  });

  it('autoStartIfNeeded starts when check is true', () => {
    const start = jest.fn().mockResolvedValue(undefined);
    autoStartIfNeeded(() => true, start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('autoStartIfNeeded skips when check is false', () => {
    const start = jest.fn().mockResolvedValue(undefined);
    autoStartIfNeeded(() => false, start);
    expect(start).not.toHaveBeenCalled();
  });
});
