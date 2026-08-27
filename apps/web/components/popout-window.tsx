/**
 * 別ウィンドウ（ポップアップ）へ React ツリーを描画する。
 *
 * window.open で about:blank を開き、createPortal で子を載せる。
 * 親の state を共有したまま、チャート操作と並行して使える。
 * ポップアップがブロックされた場合は親画面に警告を出す。
 */
'use client';

import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const FALLBACK_FONT = 'Georgia, "Times New Roman", serif';
const POPUP_BG = 'linear-gradient(160deg, #0f1c2e 0%, #1a334d 45%, #243b55 100%)';

export type PopoutWindowProps = {
  title: string;
  /** window.open のターゲット名。同じ名前なら既存ウィンドウを再利用する。 */
  name: string;
  fullscreen?: boolean;
  width?: number;
  height?: number;
  /** 指標カタログ向けに内側余白を付ける。チャート拡大では付けない。 */
  padded?: boolean;
  onClose: () => void;
  children: ReactNode | ((api: { win: Window }) => ReactNode);
};

/** ポップアップの window.open features 文字列。 */
export function buildPopoutFeatures(opts: {
  fullscreen?: boolean;
  width?: number;
  height?: number;
  screenWidth?: number;
  screenHeight?: number;
}): string {
  if (opts.fullscreen) {
    const w = opts.screenWidth ?? 1920;
    const h = opts.screenHeight ?? 1080;
    return `popup=yes,width=${w},height=${h},left=0,top=0`;
  }
  return `popup=yes,width=${opts.width ?? 440},height=${opts.height ?? 800}`;
}

/**
 * クリックハンドラから同期的に window.open し、ポップアップブロックを避ける。
 * 直後に同じ name で PopoutWindow が開くと、このウィンドウが再利用される。
 */
export function primePopoutWindow(
  name: string,
  opts: {
    fullscreen?: boolean;
    width?: number;
    height?: number;
  },
): void {
  window.open(
    '',
    name,
    buildPopoutFeatures({
      ...opts,
      screenWidth: window.screen.availWidth,
      screenHeight: window.screen.availHeight,
    }),
  );
}

/**
 * 親ページの見た目に寄せてポップアップ document を初期化する。
 * opener のフォントが取れないときはレイアウトと同じセリフ体に落とす。
 */
export function applyPopupDocumentStyle(
  doc: Document,
  title: string,
  openerDoc?: Document | null,
): void {
  doc.title = title;
  const html = doc.documentElement;
  html.style.height = '100%';
  html.style.width = '100%';
  html.style.background = POPUP_BG;
  const body = doc.body;
  body.style.margin = '0';
  body.style.minHeight = '100vh';
  body.style.height = '100%';
  body.style.width = '100%';
  body.style.background = POPUP_BG;
  body.style.color = '#e8eef5';
  const openerBody = openerDoc?.body;
  const openerView = openerDoc?.defaultView;
  body.style.fontFamily =
    openerBody && openerView
      ? openerView.getComputedStyle(openerBody).fontFamily
      : FALLBACK_FONT;
}

/** moveTo / resizeTo はブラウザが拒否することがあるので失敗しても開いたままにする。 */
export function applyFullscreenBounds(
  win: Window,
  screenLike: { availWidth: number; availHeight: number },
): boolean {
  try {
    win.moveTo(0, 0);
    win.resizeTo(screenLike.availWidth, screenLike.availHeight);
    return true;
  } catch {
    return false;
  }
}

/** 描画時に渡す Window。open で得た参照を優先し、取れないときだけ document から拾う。 */
export function resolvePopoutWindow(
  opened: Window | null,
  container: HTMLElement,
): Window {
  return opened ?? container.ownerDocument.defaultView ?? window;
}

/** ポップアップ側のリサイズに追従する（親 window ではなく host を見る）。 */
export function useHostWindowSize(host: Window): { width: number; height: number } {
  const [size, setSize] = useState({
    width: host.innerWidth,
    height: host.innerHeight,
  });

  useEffect(() => {
    const update = () =>
      setSize({ width: host.innerWidth, height: host.innerHeight });
    update();
    host.addEventListener('resize', update);
    return () => host.removeEventListener('resize', update);
  }, [host]);

  return size;
}

export function PopoutWindow({
  title,
  name,
  fullscreen = false,
  width,
  height,
  padded = false,
  onClose,
  children,
}: PopoutWindowProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const onCloseRef = useRef(onClose);
  const titleRef = useRef(title);
  const winRef = useRef<Window | null>(null);
  onCloseRef.current = onClose;
  titleRef.current = title;

  // クリックのユーザージェスチャ内で window.open するため paint 前に開く
  useLayoutEffect(() => {
    const features = buildPopoutFeatures({
      fullscreen,
      width,
      height,
      screenWidth: window.screen.availWidth,
      screenHeight: window.screen.availHeight,
    });
    const win = window.open('', name, features);
    if (!win) {
      setBlocked(true);
      return;
    }

    if (fullscreen) {
      applyFullscreenBounds(win, window.screen);
    }
    applyPopupDocumentStyle(win.document, titleRef.current, document);

    const root = win.document.createElement('div');
    root.setAttribute('data-testid', 'popout-root');
    root.style.minHeight = '100%';
    root.style.height = '100%';
    root.style.width = '100%';
    root.style.boxSizing = 'border-box';
    root.style.padding = padded ? '0.75rem' : '0';
    win.document.body.appendChild(root);
    winRef.current = win;
    setContainer(root);
    win.focus();

    const handleUnload = () => {
      onCloseRef.current();
    };
    win.addEventListener('pagehide', handleUnload);
    win.addEventListener('beforeunload', handleUnload);

    return () => {
      win.removeEventListener('pagehide', handleUnload);
      win.removeEventListener('beforeunload', handleUnload);
      win.close();
      winRef.current = null;
    };
  }, [name, fullscreen, width, height, padded]);

  useEffect(() => {
    if (container) {
      container.ownerDocument.title = title;
    }
  }, [container, title]);

  if (blocked) {
    return (
      <p role="alert" style={blockedStyle} data-testid="popout-blocked">
        ポップアップがブロックされました。ブラウザでポップアップを許可してください。
        <button type="button" onClick={onClose} style={blockedButtonStyle}>
          閉じる
        </button>
      </p>
    );
  }

  if (!container) {
    return null;
  }

  const view = resolvePopoutWindow(winRef.current, container);
  const content = typeof children === 'function' ? children({ win: view }) : children;
  return createPortal(content, container);
}

const blockedStyle: CSSProperties = {
  color: '#ffb4b4',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'center',
};

const blockedButtonStyle: CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
  cursor: 'pointer',
};
