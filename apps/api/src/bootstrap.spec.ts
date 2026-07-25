import { NestFactory } from '@nestjs/core';
import { bootstrap } from './bootstrap';
import { AppModule } from './app.module';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

describe('bootstrap', () => {
  const originalPort = process.env.API_PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.API_PORT;
    } else {
      process.env.API_PORT = originalPort;
    }
    jest.clearAllMocks();
  });

  it('creates the app with cors and default port', async () => {
    const app = {
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(app);
    delete process.env.API_PORT;

    await expect(bootstrap()).resolves.toBe(app);
    expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
    expect(app.enableCors).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledWith(3001);
  });

  it('uses API_PORT when provided', async () => {
    const app = {
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    (NestFactory.create as jest.Mock).mockResolvedValue(app);
    process.env.API_PORT = '4000';

    await bootstrap();
    expect(app.listen).toHaveBeenCalledWith(4000);
  });
});
