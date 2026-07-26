import { HealthService } from './health.service';
import { PrismaService } from './prisma.service';

describe('HealthService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const prismaService = {
    prisma,
  } as unknown as PrismaService;

  let service: HealthService;
  const originalFetch = global.fetch;
  const originalAnalysisUrl = process.env.ANALYSIS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthService(prismaService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAnalysisUrl === undefined) {
      delete process.env.ANALYSIS_URL;
    } else {
      process.env.ANALYSIS_URL = originalAnalysisUrl;
    }
  });

  it('returns ok when database is up', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.getApiHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(result.details).toEqual(
      expect.objectContaining({
        database: 'up',
        uptimeSeconds: expect.any(Number),
      }),
    );
  });

  it('returns degraded when database is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));

    const result = await service.getApiHealth();
    expect(result.status).toBe('degraded');
    expect(result.details).toEqual(
      expect.objectContaining({
        database: 'down',
        uptimeSeconds: expect.any(Number),
      }),
    );
  });

  it('returns analysis health when upstream is ok', async () => {
    process.env.ANALYSIS_URL = 'http://analysis:8000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'analysis' }),
    }) as unknown as typeof fetch;

    await expect(service.getAnalysisHealth()).resolves.toEqual({
      status: 'ok',
      service: 'api',
      details: { analysis: { status: 'ok', service: 'analysis' } },
    });
    expect(global.fetch).toHaveBeenCalledWith('http://analysis:8000/health');
  });

  it('uses default analysis url when env is unset', async () => {
    delete process.env.ANALYSIS_URL;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'analysis' }),
    }) as unknown as typeof fetch;

    await service.getAnalysisHealth();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/health');
  });

  it('returns degraded when analysis responds with non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    await expect(service.getAnalysisHealth()).resolves.toEqual({
      status: 'degraded',
      service: 'api',
      details: { analysis: 'down', statusCode: 503 },
    });
  });

  it('returns degraded with error message when fetch throws Error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    await expect(service.getAnalysisHealth()).resolves.toEqual({
      status: 'degraded',
      service: 'api',
      details: { analysis: 'down', error: 'network' },
    });
  });

  it('returns degraded with unknown when fetch throws non-Error', async () => {
    global.fetch = jest.fn().mockRejectedValue('boom') as unknown as typeof fetch;

    await expect(service.getAnalysisHealth()).resolves.toEqual({
      status: 'degraded',
      service: 'api',
      details: { analysis: 'down', error: 'unknown' },
    });
  });
});
