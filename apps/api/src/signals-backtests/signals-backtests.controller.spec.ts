import { Test } from '@nestjs/testing';
import { SignalsBacktestsController } from './signals-backtests.controller';
import { SignalsBacktestsService } from './signals-backtests.service';

describe('SignalsBacktestsController', () => {
  let controller: SignalsBacktestsController;
  const service = {
    listSignalDefinitions: jest.fn(),
    getSignalDefinition: jest.fn(),
    createSignalDefinition: jest.fn(),
    updateSignalDefinition: jest.fn(),
    removeSignalDefinition: jest.fn(),
    listBacktestRuns: jest.fn(),
    getBacktestRun: jest.fn(),
    runBacktest: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SignalsBacktestsController],
      providers: [{ provide: SignalsBacktestsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(SignalsBacktestsController);
  });

  it('delegates all handlers to service', async () => {
    service.listSignalDefinitions.mockResolvedValue([]);
    service.getSignalDefinition.mockResolvedValue({ id: 's' });
    service.createSignalDefinition.mockResolvedValue({ id: 's' });
    service.updateSignalDefinition.mockResolvedValue({ id: 's' });
    service.listBacktestRuns.mockResolvedValue([]);
    service.getBacktestRun.mockResolvedValue({ id: 'r' });
    service.runBacktest.mockResolvedValue({ id: 'r' });
    service.removeSignalDefinition.mockResolvedValue(undefined);

    const user = { id: 'u' } as any;
    await expect(controller.listSignals(user)).resolves.toEqual([]);
    await expect(controller.getSignal(user, 's')).resolves.toEqual({ id: 's' });
    await expect(controller.createSignal(user, {} as any)).resolves.toEqual({ id: 's' });
    await expect(controller.updateSignal(user, 's', {} as any)).resolves.toEqual({ id: 's' });
    await expect(controller.listBacktests(user)).resolves.toEqual([]);
    await expect(controller.getBacktest(user, 'r')).resolves.toEqual({ id: 'r' });
    await expect(controller.runBacktest(user, {} as any)).resolves.toEqual({ id: 'r' });
    await expect(controller.removeSignal(user, 's')).resolves.toBeUndefined();
  });
});
