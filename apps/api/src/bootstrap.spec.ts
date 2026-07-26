import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import {
  assertRequiredEnv,
  bootstrap,
  resolveNestLogLevels,
  setupSwagger,
} from './bootstrap';
import { AppModule } from './app.module';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  SwaggerModule: {
    createDocument: jest.fn().mockReturnValue({}),
    setup: jest.fn(),
  },
  ApiProperty: () => () => undefined,
  ApiTags: () => () => undefined,
  ApiOkResponse: () => () => undefined,
  ApiBearerAuth: () => () => undefined,
}));

describe('bootstrap helpers', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalPort = process.env.API_PORT;
  const originalLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    if (originalPort === undefined) {
      delete process.env.API_PORT;
    } else {
      process.env.API_PORT = originalPort;
    }
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
    jest.clearAllMocks();
  });

  it('assertRequiredEnv throws without JWT_SECRET', () => {
    expect(() => assertRequiredEnv({})).toThrow('JWT_SECRET is not set');
  });

  it('assertRequiredEnv passes when JWT_SECRET is set', () => {
    expect(() => assertRequiredEnv({ JWT_SECRET: 'x' })).not.toThrow();
  });

  it('resolveNestLogLevels returns undefined for empty', () => {
    expect(resolveNestLogLevels(undefined)).toBeUndefined();
    expect(resolveNestLogLevels('')).toBeUndefined();
    expect(resolveNestLogLevels('nope')).toBeUndefined();
  });

  it('resolveNestLogLevels parses comma-separated levels', () => {
    expect(resolveNestLogLevels('error,warn')).toEqual(['error', 'warn']);
  });

  it('setupSwagger wires DocumentBuilder', () => {
    const app = {};
    setupSwagger(app);
    expect(SwaggerModule.createDocument).toHaveBeenCalled();
    expect(SwaggerModule.setup).toHaveBeenCalledWith('docs', app, {});
  });

  it('creates the app with pipes filters interceptors swagger and default port', async () => {
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.API_PORT;
    delete process.env.LOG_LEVEL;

    const app = {
      enableCors: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    await expect(bootstrap()).resolves.toBe(app);
    expect(NestFactory.create).toHaveBeenCalledWith(AppModule, { logger: undefined });
    expect(app.enableCors).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(1);
    expect(app.useGlobalInterceptors).toHaveBeenCalledTimes(1);
    expect(SwaggerModule.setup).toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith(3001);
  });

  it('uses API_PORT and LOG_LEVEL when provided', async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.API_PORT = '4000';
    process.env.LOG_LEVEL = 'error';

    const app = {
      enableCors: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    await bootstrap();
    expect(NestFactory.create).toHaveBeenCalledWith(AppModule, { logger: ['error'] });
    expect(app.listen).toHaveBeenCalledWith(4000);
  });

  it('fails bootstrap when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    await expect(bootstrap()).rejects.toThrow('JWT_SECRET is not set');
  });
});
