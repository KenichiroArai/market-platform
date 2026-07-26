import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { API_ERROR_CODES } from '@market/shared-types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const userDelegate = {
    findUnique: jest.fn(),
    create: jest.fn(),
  };
  const prismaService = {
    prisma: { user: userDelegate },
  } as unknown as PrismaService;
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prismaService, jwtService);
  });

  it('registers a new user and returns a token', async () => {
    userDelegate.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    userDelegate.create.mockResolvedValue({ id: 'u1', email: 'a@example.com' });

    await expect(
      service.register({ email: 'A@Example.com', password: 'password123' }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      user: { id: 'u1', email: 'a@example.com' },
    });
    expect(userDelegate.create).toHaveBeenCalledWith({
      data: { email: 'a@example.com', passwordHash: 'hashed' },
    });
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'a@example.com' });
  });

  it('rejects duplicate email on register', async () => {
    userDelegate.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.register({ email: 'a@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    userDelegate.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      passwordHash: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'A@Example.com', password: 'password123' }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      user: { id: 'u1', email: 'a@example.com' },
    });
  });

  it('rejects login when user is missing', async () => {
    userDelegate.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'a@example.com', password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects login when password mismatches', async () => {
    userDelegate.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      passwordHash: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    try {
      await service.login({ email: 'a@example.com', password: 'wrong' });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS }),
      );
    }
  });

  it('returns current user for getMe', async () => {
    userDelegate.findUnique.mockResolvedValue({ id: 'u1', email: 'a@example.com' });

    await expect(service.getMe('u1')).resolves.toEqual({ id: 'u1', email: 'a@example.com' });
  });

  it('rejects getMe when user is missing', async () => {
    userDelegate.findUnique.mockResolvedValue(null);

    await expect(service.getMe('missing')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
