/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  applyFullscreenBounds,
  applyPopupDocumentStyle,
  buildPopoutFeatures,
  PopoutWindow,
  primePopoutWindow,
  resolvePopoutWindow,
  useHostWindowSize,
} from '../../components/popout-window';

function createMockPopup() {
  const doc = document.implementation.createHTMLDocument('popup');
  const listeners = new Map<string, EventListener[]>();
  const win = {
    document: doc,
    close: jest.fn(),
    focus: jest.fn(),
    moveTo: jest.fn(),
    resizeTo: jest.fn(),
    innerWidth: 900,
    innerHeight: 700,
    addEventListener: jest.fn((type: string, cb: EventListener) => {
      const list = listeners.get(type) ?? [];
      list.push(cb);
      listeners.set(type, list);
    }),
    removeEventListener: jest.fn((type: string, cb: EventListener) => {
      const list = (listeners.get(type) ?? []).filter((item) => item !== cb);
      listeners.set(type, list);
    }),
    dispatch(type: string) {
      for (const cb of listeners.get(type) ?? []) {
        cb(new Event(type));
      }
    },
  };
  return { win, doc };
}

function HostSizeProbe({ host }: { host: Window }) {
  const size = useHostWindowSize(host);
  return <span data-testid="host-size">{`${size.width}x${size.height}`}</span>;
}

describe('popout helpers', () => {
  it('builds popup and fullscreen features', () => {
    expect(buildPopoutFeatures({})).toBe('popup=yes,width=440,height=800');
    expect(buildPopoutFeatures({ width: 500, height: 600 })).toBe(
      'popup=yes,width=500,height=600',
    );
    expect(buildPopoutFeatures({ fullscreen: true, screenWidth: 1200, screenHeight: 800 })).toBe(
      'popup=yes,width=1200,height=800,left=0,top=0',
    );
    expect(buildPopoutFeatures({ fullscreen: true })).toBe(
      'popup=yes,width=1920,height=1080,left=0,top=0',
    );
  });

  it('primes a named popup from a user gesture', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    primePopoutWindow('chart-indicator-settings', { width: 440, height: 800 });
    expect(open).toHaveBeenCalledWith(
      '',
      'chart-indicator-settings',
      'popup=yes,width=440,height=800',
    );
    primePopoutWindow('chart-analysis-fullscreen', { fullscreen: true });
    expect(open).toHaveBeenCalledWith(
      '',
      'chart-analysis-fullscreen',
      expect.stringContaining('popup=yes,width='),
    );
    open.mockRestore();
  });

  it('styles popup document with opener font or fallback', () => {
    const doc = document.implementation.createHTMLDocument('styled');
    applyPopupDocumentStyle(doc, '指標設定', document);
    expect(doc.title).toBe('指標設定');
    expect(doc.body.style.color).toBeTruthy();

    const fallbackDoc = document.implementation.createHTMLDocument('fallback');
    applyPopupDocumentStyle(fallbackDoc, '拡大');
    expect(fallbackDoc.body.style.fontFamily).toContain('Georgia');

    const noBody = {
      title: '',
      documentElement: { style: {} as CSSStyleDeclaration },
      body: { style: {} as CSSStyleDeclaration },
      defaultView: null,
    } as unknown as Document;
    applyPopupDocumentStyle(noBody, 'x', {
      body: null,
      defaultView: window,
    } as unknown as Document);
    expect(noBody.body.style.fontFamily).toContain('Georgia');

    applyPopupDocumentStyle(noBody, 'y', {
      body: document.body,
      defaultView: null,
    } as unknown as Document);
    expect(noBody.body.style.fontFamily).toContain('Georgia');
  });

  it('applies fullscreen bounds and swallows rejections', () => {
    const ok = { moveTo: jest.fn(), resizeTo: jest.fn() } as unknown as Window;
    expect(applyFullscreenBounds(ok, { availWidth: 10, availHeight: 20 })).toBe(true);
    expect(ok.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ok.resizeTo).toHaveBeenCalledWith(10, 20);

    const bad = {
      moveTo: () => {
        throw new Error('denied');
      },
      resizeTo: jest.fn(),
    } as unknown as Window;
    expect(applyFullscreenBounds(bad, { availWidth: 1, availHeight: 1 })).toBe(false);
  });

  it('resolves the opened window before falling back', () => {
    const opened = { innerHeight: 1 } as Window;
    const el = document.createElement('div');
    expect(resolvePopoutWindow(opened, el)).toBe(opened);
    expect(resolvePopoutWindow(null, el)).toBe(window);

    const detached = document.implementation.createHTMLDocument('x').createElement('div');
    Object.defineProperty(detached.ownerDocument, 'defaultView', {
      configurable: true,
      value: null,
    });
    expect(resolvePopoutWindow(null, detached)).toBe(window);
  });
});

describe('useHostWindowSize', () => {
  it('tracks host resize', () => {
    const host = {
      innerWidth: 400,
      innerHeight: 300,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Window;
    const { unmount } = render(<HostSizeProbe host={host} />);
    expect(screen.getByTestId('host-size')).toHaveTextContent('400x300');

    (host as { innerWidth: number }).innerWidth = 500;
    (host as { innerHeight: number }).innerHeight = 350;
    const resizeCb = (host.addEventListener as jest.Mock).mock.calls.find(
      (call) => call[0] === 'resize',
    )?.[1] as () => void;
    act(() => {
      resizeCb();
    });
    expect(screen.getByTestId('host-size')).toHaveTextContent('500x350');
    unmount();
    expect(host.removeEventListener).toHaveBeenCalled();
  });
});

describe('PopoutWindow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('portals children into the opened window and closes on unmount', () => {
    const { win, doc } = createMockPopup();
    jest.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    const onClose = jest.fn();
    const { unmount, rerender } = render(
      <PopoutWindow title="指標設定" name="ind" padded onClose={onClose}>
        <span>catalog</span>
      </PopoutWindow>,
    );

    expect(window.open).toHaveBeenCalled();
    expect(doc.body.textContent).toContain('catalog');
    expect(win.focus).toHaveBeenCalled();
    expect(doc.title).toBe('指標設定');

    rerender(
      <PopoutWindow title="指標設定（更新）" name="ind" padded onClose={onClose}>
        <span>catalog</span>
      </PopoutWindow>,
    );
    expect(doc.title).toBe('指標設定（更新）');

    unmount();
    expect(win.close).toHaveBeenCalled();
  });

  it('renders function children with the popup window and goes fullscreen', () => {
    const { win, doc } = createMockPopup();
    jest.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    render(
      <PopoutWindow title="拡大" name="chart" fullscreen onClose={jest.fn()}>
        {({ win: popup }) => <span>{`h=${popup.innerHeight}`}</span>}
      </PopoutWindow>,
    );

    expect(doc.body.textContent).toContain('h=700');
    expect(win.moveTo).toHaveBeenCalled();
  });

  it('notifies parent when the popup unloads', () => {
    const { win } = createMockPopup();
    jest.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
    const onClose = jest.fn();
    render(
      <PopoutWindow title="指標設定" name="ind" onClose={onClose}>
        child
      </PopoutWindow>,
    );
    act(() => {
      win.dispatch('beforeunload');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a blocked warning when window.open fails', () => {
    jest.spyOn(window, 'open').mockReturnValue(null);
    const onClose = jest.fn();
    render(
      <PopoutWindow title="拡大" name="chart" onClose={onClose}>
        child
      </PopoutWindow>,
    );
    expect(screen.getByTestId('popout-blocked')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the opened window even when defaultView is missing', () => {
    const { win, doc } = createMockPopup();
    Object.defineProperty(doc, 'defaultView', { configurable: true, value: null });
    jest.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    render(
      <PopoutWindow title="拡大" name="chart" onClose={jest.fn()}>
        {({ win: popup }) => <span>{popup === window ? 'opener' : 'popup'}</span>}
      </PopoutWindow>,
    );
    expect(doc.body.textContent).toContain('popup');
  });
});
