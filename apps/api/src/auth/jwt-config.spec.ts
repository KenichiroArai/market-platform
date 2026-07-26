import { createJwtModuleOptions } from './jwt-config';

describe('createJwtModuleOptions', () => {
  it('throws when JWT_SECRET is missing', () => {
    expect(() => createJwtModuleOptions({})).toThrow('JWT_SECRET is not set');
  });

  it('uses default expiresIn', () => {
    expect(createJwtModuleOptions({ JWT_SECRET: 's' })).toEqual({
      secret: 's',
      signOptions: { expiresIn: '7d' },
    });
  });

  it('uses process.env when env argument is omitted', () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'from-process';
    try {
      expect(createJwtModuleOptions().secret).toBe('from-process');
    } finally {
      if (previous === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previous;
      }
    }
  });
});
