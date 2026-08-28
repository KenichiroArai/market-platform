import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { API_ERROR_CODES, TREND_SCORE_GROUP_WEIGHTS } from '@market/shared-types';
import { PrismaService } from '../../src/prisma.service';
import { IndicatorSetsService, indicatorParamsFromStored } from '../../src/indicator-sets/indicator-sets.service';

describe('indicatorParamsFromStored', () => {
  it('normalizes stored json', () => {
    expect(indicatorParamsFromStored({ sma25: { period: 30 } })).toEqual({ sma25: { period: 30 } });
    expect(indicatorParamsFromStored({ unknown: { period: 1 } })).toEqual({});
    expect(indicatorParamsFromStored(undefined)).toEqual({});
  });
});

describe('IndicatorSetsService', () => {
  const indicatorSetDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
    indicatorParams: {},
    groupWeights: null,
    buyThreshold: null,
    sellThreshold: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    indicatorSetDelegate.findMany.mockReset();
    indicatorSetDelegate.findFirst.mockReset();
    indicatorSetDelegate.create.mockReset();
    indicatorSetDelegate.update.mockReset();
    indicatorSetDelegate.delete.mockReset();
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
        data: expect.objectContaining({
          userId: 'user_1',
          name: 'スイング',
          indicatorIds: ['sma25', 'rsi'],
        }),
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

  it('updates an indicator set', async () => {
    indicatorSetDelegate.findFirst
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(null);
    indicatorSetDelegate.update.mockResolvedValue({ ...row, name: '改' });
    await expect(
      service.update('user_1', 'set_1', { name: '改', indicatorIds: ['sma25'] }),
    ).resolves.toEqual(expect.objectContaining({ name: '改' }));
    expect(indicatorSetDelegate.update).toHaveBeenCalled();
  });

  it('removes an indicator set', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(row);
    indicatorSetDelegate.delete.mockResolvedValue(row);
    await service.remove('user_1', 'set_1');
    expect(indicatorSetDelegate.delete).toHaveBeenCalledWith({ where: { id: 'set_1' } });
  });

  it('creates with score config fields', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    indicatorSetDelegate.create.mockResolvedValue({
      ...row,
      indicatorParams: { sma25: { period: 30 } },
      groupWeights: TREND_SCORE_GROUP_WEIGHTS,
      buyThreshold: 50,
      sellThreshold: -50,
    });
    await service.create('user_1', {
      name: 'カスタム',
      indicatorIds: ['sma25'],
      indicatorParams: { sma25: { period: 30 } },
      groupWeights: TREND_SCORE_GROUP_WEIGHTS,
      buyThreshold: 50,
      sellThreshold: -50,
    });
    expect(indicatorSetDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buyThreshold: 50,
          sellThreshold: -50,
        }),
      }),
    );
  });

  it('rejects invalid config on create', async () => {
    await expect(
      service.create('user_1', {
        name: 'X',
        indicatorIds: ['sma25'],
        groupWeights: { trend: 50 },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.create('user_1', {
        name: 'X',
        indicatorIds: ['sma25'],
        buyThreshold: 10,
        sellThreshold: 20,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.create('user_1', {
        name: 'X',
        indicatorIds: ['sma25'],
        indicatorParams: { sma25: { period: 9999 } },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws when updating a missing set', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    await expect(service.update('user_1', 'missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects empty name on update', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(row);
    await expect(service.update('user_1', 'set_1', { name: '   ' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects unknown ids on update', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(row);
    await expect(
      service.update('user_1', 'set_1', { indicatorIds: ['nope'] }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects duplicate name on update', async () => {
    indicatorSetDelegate.findFirst
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ id: 'set_2' });
    await expect(service.update('user_1', 'set_1', { name: '重複' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('merges existing config when partial update', async () => {
    const existing = {
      ...row,
      indicatorParams: { sma25: { period: 30 } },
      groupWeights: TREND_SCORE_GROUP_WEIGHTS,
      buyThreshold: 50,
      sellThreshold: -50,
    };
    indicatorSetDelegate.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    indicatorSetDelegate.update.mockResolvedValue(existing);
    await service.update('user_1', 'set_1', { buyThreshold: 60 });
    expect(indicatorSetDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buyThreshold: 60, sellThreshold: -50 }),
      }),
    );
  });

  it('falls back when existing json fields are invalid', async () => {
    const existing = {
      ...row,
      indicatorParams: ['bad'],
      groupWeights: 'bad',
    };
    indicatorSetDelegate.findFirst.mockResolvedValue(existing);
    indicatorSetDelegate.update.mockResolvedValue(row);
    await service.update('user_1', 'set_1', {});
    expect(indicatorSetDelegate.update).toHaveBeenCalled();
  });

  it('updates only sell threshold and preserves other config', async () => {
    const existing = {
      ...row,
      buyThreshold: 50,
      sellThreshold: -50,
    };
    indicatorSetDelegate.findFirst.mockResolvedValue(existing);
    indicatorSetDelegate.update.mockResolvedValue(existing);
    await service.update('user_1', 'set_1', { sellThreshold: -60 });
    expect(indicatorSetDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buyThreshold: 50, sellThreshold: -60 }),
      }),
    );
  });

  it('rejects invalid params with detail message', async () => {
    await expect(
      service.create('user_1', {
        name: 'X',
        indicatorIds: ['sma25'],
        indicatorParams: { unknown: { period: 10 } },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.stringContaining('unknown'),
      }),
    });
  });

  it('validates partial thresholds on create', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    indicatorSetDelegate.create.mockResolvedValue({ ...row, buyThreshold: 50, sellThreshold: null });
    await service.create('user_1', {
      name: '閾値のみ',
      indicatorIds: ['sma25'],
      buyThreshold: 50,
    });
    expect(indicatorSetDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buyThreshold: 50, sellThreshold: null }),
      }),
    );
  });

  it('creates with sell threshold only using defaults for buy', async () => {
    indicatorSetDelegate.findFirst.mockResolvedValue(null);
    indicatorSetDelegate.create.mockResolvedValue({ ...row, buyThreshold: null, sellThreshold: -55 });
    await service.create('user_1', {
      name: '売りのみ',
      indicatorIds: ['sma25'],
      sellThreshold: -55,
    });
    expect(indicatorSetDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sellThreshold: -55 }),
      }),
    );
  });

  it('clears group weights on update when null is sent', async () => {
    const existing = {
      ...row,
      groupWeights: TREND_SCORE_GROUP_WEIGHTS,
    };
    indicatorSetDelegate.findFirst.mockResolvedValue(existing);
    indicatorSetDelegate.update.mockResolvedValue({ ...existing, groupWeights: null });
    await service.update('user_1', 'set_1', { groupWeights: null });
    expect(indicatorSetDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupWeights: expect.anything() }),
      }),
    );
  });

  it('drops invalid stored indicator params when updating without overrides', async () => {
    const existing = {
      ...row,
      indicatorParams: { not_a_catalog_id: { period: 5 } },
    };
    indicatorSetDelegate.findFirst.mockResolvedValue(existing);
    indicatorSetDelegate.update.mockResolvedValue(row);
    await service.update('user_1', 'set_1', { name: 'スイング' });
    expect(indicatorSetDelegate.update).toHaveBeenCalled();
  });
});
