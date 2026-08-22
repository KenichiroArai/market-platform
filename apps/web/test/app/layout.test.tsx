import RootLayout, { metadata } from '../../app/layout';

describe('RootLayout', () => {
  it('exposes metadata', () => {
    expect(metadata).toEqual({
      title: 'market-platform',
      description: 'Market data and analysis platform',
    });
  });

  it('returns html/body structure with children', () => {
    const tree = RootLayout({ children: 'child' });

    expect(tree.type).toBe('html');
    expect(tree.props.lang).toBe('ja');
    expect(tree.props.children.type).toBe('body');
    expect(tree.props.children.props.children).toBe('child');
  });
});
