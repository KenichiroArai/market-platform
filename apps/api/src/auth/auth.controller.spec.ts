import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    getMe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('delegates register', async () => {
    const payload = { accessToken: 't', tokenType: 'Bearer' as const, user: { id: '1', email: 'a@b.c' } };
    authService.register.mockResolvedValue(payload);

    await expect(controller.register({ email: 'a@b.c', password: 'password123' })).resolves.toEqual(
      payload,
    );
  });

  it('delegates login', async () => {
    const payload = { accessToken: 't', tokenType: 'Bearer' as const, user: { id: '1', email: 'a@b.c' } };
    authService.login.mockResolvedValue(payload);

    await expect(controller.login({ email: 'a@b.c', password: 'password123' })).resolves.toEqual(
      payload,
    );
  });

  it('delegates me', async () => {
    authService.getMe.mockResolvedValue({ id: '1', email: 'a@b.c' });

    await expect(controller.me({ id: '1', email: 'a@b.c' })).resolves.toEqual({
      id: '1',
      email: 'a@b.c',
    });
    expect(authService.getMe).toHaveBeenCalledWith('1');
  });
});
