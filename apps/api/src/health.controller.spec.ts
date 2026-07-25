import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = {
    getApiHealth: jest.fn(),
    getAnalysisHealth: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns api health', async () => {
    const payload = { status: 'ok' as const, service: 'api' };
    healthService.getApiHealth.mockResolvedValue(payload);

    await expect(controller.getHealth()).resolves.toEqual(payload);
    expect(healthService.getApiHealth).toHaveBeenCalledTimes(1);
  });

  it('returns analysis health', async () => {
    const payload = { status: 'ok' as const, service: 'api', details: { analysis: 'ok' } };
    healthService.getAnalysisHealth.mockResolvedValue(payload);

    await expect(controller.getAnalysisHealth()).resolves.toEqual(payload);
    expect(healthService.getAnalysisHealth).toHaveBeenCalledTimes(1);
  });
});
