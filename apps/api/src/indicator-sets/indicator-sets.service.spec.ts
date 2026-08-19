import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { API_ERROR_CODES } from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import { IndicatorSetsService } from './indicator-sets.service';

describe('IndicatorSetsService', () => {
  const indicatorSetDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const prismaService = {
    prisma: {
      indicatorSet: indicatorSetDelegate,
    },
  } as unknown as PrismaService;

  let service: IndicatorSetsService;

  const row = {
    id: 'set_1',
    userId: 'user_1',
    name: 'スイング',
    indicatorIds: ['sma25', 'rsi'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IndicatorSetsService(prismaService);
  });

  it('lists indicator sets for user', async () => {
    indicatorSetDelegate.findMany.mockResolvedValue([row]);
    const result = await service.list('user_1');
    expect(result[0]?.name).toBe('スイング');
    expect(indicatorSetDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_1' } }),
    );
  });

  it('gets by id', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(row);
    await expect(service.getById('user_1', 'set_1')).resolves.toEqual(
      expect.objectContaining({ id: 'set_1' }),
    );
  });

  it('throws when indicator set is missing', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    try {
      await service.getById('user_1', 'missing');
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.INDICATOR_SET_NOT_FOUND }),
      );
    }
  });

  it('creates an indicator set and trims the name', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    indicatorSetDelegate.create.mockResolvedValue(row);
    await expect(
      service.create('user_1', { name: ' スイング ', indicatorIds: ['sma25', 'rsi'] }),
    ).resolves.toEqual(expect.objectContaining({ name: 'スイング' }));
    expect(indicatorSetDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'user_1', name: 'スイング', indicatorIds: ['sma25', 'rsi'] },
      }),
    );
  });

  it('creates with an empty indicator list', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    indicatorSetDelegate.create.mockResolvedValue({ ...row, indicatorIds: [] });
    await expect(service.create('user_1', { name: '空', indicatorIds: [] })).resolves.toEqual(
      expect.objectContaining({ indicatorIds: [] }),
    );
  });

  it('rejects unknown indicator ids', async () => {
    try {
      await service.create('user_1', { name: 'X', indicatorIds: ['nope'] });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual(
        expect.objectContaining({
          code: API_ERROR_CODES.VALIDATION_FAILED,
          message: 'Unknown indicator type: nope',
        }),
      );
    }
  });

  it('rejects disabled indicator ids', async () => {
    try {
      await service.create('user_1', { name: 'X', indicatorIds: ['elliott'] });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual(
        expect.objectContaining({
          code: API_ERROR_CODES.VALIDATION_FAILED,
          message: 'Indicator is not computable: elliott',
        }),
      );
    }
  });

  it('rejects duplicate names', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue({ id: 'set_1' });
    try {
      await service.create('user_1', { name: 'スイング', indicatorIds: ['sma25'] });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.INDICATOR_SET_ALREADY_EXISTS }),
      );
    }
  });

  it('removes an indicator set', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(row);
    indicatorSetDelegate.delete.mockResolvedValue(row);
    await service.remove('user_1', 'set_1');
    expect(indicatorSetDelegate.delete).toHaveBeenCalledWith({ where: { id: 'set_1' } });
  });
});
