import { RegisterDto, LoginDto } from './auth.dto';

describe('auth DTOs', () => {
  it('constructs RegisterDto and LoginDto', () => {
    const register = new RegisterDto();
    register.email = 'a@example.com';
    register.password = 'password123';
    expect(register.email).toBe('a@example.com');

    const login = new LoginDto();
    login.email = 'a@example.com';
    login.password = 'x';
    expect(login.password).toBe('x');
  });
});
