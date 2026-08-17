/**
 * モードレスウィンドウ（背面のチャート操作を妨げないフローティングパネル）。
 *
 * モーダルと違いオーバーレイでクリックを奪わない。
 * タイトルバーをドラッグして退避できる。
 */
'use client';

import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

export type ModelessWindowProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  initialX?: number;
  initialY?: number;
};

/** ポインタ位置と掴みオフセットから次の座標を決める。 */
export function nextDragPosition(
  pointerX: number,
  pointerY: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  return { x: pointerX - offsetX, y: pointerY - offsetY };
}

export function ModelessWindow({
  title,
  onClose,
  children,
  width = 352,
  initialX = 24,
  initialY = 96,
}: ModelessWindowProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  function onTitleMouseDown(event: MouseEvent<HTMLElement>) {
    draggingRef.current = true;
    offsetRef.current = { x: event.clientX - pos.x, y: event.clientY - pos.y };
  }

  function onTitleMouseMove(event: MouseEvent<HTMLElement>) {
    if (!draggingRef.current) {
      return;
    }
    setPos(
      nextDragPosition(
        event.clientX,
        event.clientY,
        offsetRef.current.x,
        offsetRef.current.y,
      ),
    );
  }

  function onTitleMouseUp() {
    draggingRef.current = false;
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      data-testid="modeless-window"
      style={{
        ...panelStyle,
        width,
        left: pos.x,
        top: pos.y,
      }}
    >
      <header
        data-testid="modeless-title"
        style={titleStyle}
        onMouseDown={onTitleMouseDown}
        onMouseMove={onTitleMouseMove}
        onMouseUp={onTitleMouseUp}
      >
        <h2 style={titleTextStyle}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          style={closeStyle}
          data-testid="modeless-close"
          aria-label="閉じる"
        >
          閉じる
        </button>
      </header>
      <div style={bodyStyle}>{children}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 40,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#1a334d',
  color: '#e8eef5',
  border: '1px solid rgba(232, 238, 245, 0.35)',
  borderRadius: 6,
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
};

const titleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  cursor: 'move',
  borderBottom: '1px solid rgba(232, 238, 245, 0.2)',
  userSelect: 'none',
};

const titleTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  fontWeight: 600,
};

const closeStyle: CSSProperties = {
  padding: '0.25rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const bodyStyle: CSSProperties = {
  overflow: 'auto',
  padding: '0.75rem',
};
