import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../../src/common/logging.interceptor';

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();

  function createContext(statusCode = 200) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/health' }),
        getResponse: () => ({ statusCode }),
      }),
    };
  }

  it('logs successful requests', (done) => {
    const logSpy = jest
      .spyOn((interceptor as unknown as { logger: { log: jest.Mock } }).logger, 'log')
      .mockImplementation();

    interceptor.intercept(createContext(200) as never, { handle: () => of('ok') }).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GET /health 200'));
        logSpy.mockRestore();
        done();
      },
    });
  });

  it('logs failed requests', (done) => {
    const warnSpy = jest
      .spyOn((interceptor as unknown as { logger: { warn: jest.Mock } }).logger, 'warn')
      .mockImplementation();

    interceptor
      .intercept(createContext(0) as never, {
        handle: () => throwError(() => new Error('fail')),
      })
      .subscribe({
        error: () => {
          expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GET /health 500'));
          warnSpy.mockRestore();
          done();
        },
      });
  });
});
