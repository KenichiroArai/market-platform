import '@testing-library/jest-dom';

/** React Testing Library / React 19 の非同期更新ノイズ（成功時に出ても失敗ではない） */
const IGNORED_CONSOLE_ERROR_PATTERNS = [
  /not wrapped in act\(/,
  /An update to .+ inside a test was not wrapped in act/,
  /https:\/\/react\.dev\/link\/wrap-tests-with-act/,
];

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack ?? arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function isIgnoredConsoleError(args: unknown[]): boolean {
  const message = formatConsoleArgs(args);
  return IGNORED_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

const originalConsoleError = console.error.bind(console);

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (isIgnoredConsoleError(args)) {
      return;
    }
    // 想定外の console.error はテスト失敗として扱う（表示＝失敗）
    originalConsoleError(...args);
    throw new Error(`Unexpected console.error:\n${formatConsoleArgs(args)}`);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
