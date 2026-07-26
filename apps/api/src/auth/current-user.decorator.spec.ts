import { CurrentUser, extractCurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('is a param decorator factory', () => {
    expect(typeof CurrentUser).toBe('function');
  });

  it('extracts user from the request', () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    };

    expect(extractCurrentUser(undefined, ctx as never)).toEqual(user);
  });
});
