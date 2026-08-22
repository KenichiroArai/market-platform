import { JwtStrategy } from '../../src/auth/jwt.strategy';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => new JwtStrategy()).toThrow('JWT_SECRET is not set');
  });

  it('maps payload to AuthenticatedUser', () => {
    process.env.JWT_SECRET = 'test-secret';
    const strategy = new JwtStrategy();
    expect(strategy.validate({ sub: 'u1', email: 'a@example.com' })).toEqual({
      id: 'u1',
      email: 'a@example.com',
    });
  });
});
