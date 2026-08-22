import { IS_PUBLIC_KEY, Public } from '../../src/common/public.decorator';

describe('Public decorator', () => {
  it('sets isPublic metadata key constant', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('returns a SetMetadata decorator factory', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });
});
