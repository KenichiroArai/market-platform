import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('allows public routes without calling passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('delegates to AuthGuard when route is not public', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const superSpy = jest.spyOn(parent, 'canActivate').mockReturnValue(true);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    expect(guard.canActivate(context as never)).toBe(true);
    expect(superSpy).toHaveBeenCalled();
    superSpy.mockRestore();
  });
});
