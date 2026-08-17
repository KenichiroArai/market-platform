/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { ModelessWindow, nextDragPosition } from './modeless-window';

describe('nextDragPosition', () => {
  it('subtracts the grab offset', () => {
    expect(nextDragPosition(120, 80, 20, 10)).toEqual({ x: 100, y: 70 });
  });
});

describe('ModelessWindow', () => {
  it('renders a non-modal dialog and closes', () => {
    const onClose = jest.fn();
    render(
      <ModelessWindow title="指標設定" onClose={onClose}>
        <p>catalog body</p>
      </ModelessWindow>,
    );
    const dialog = screen.getByTestId('modeless-window');
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByText('catalog body')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modeless-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('drags from the title bar and ignores moves without a press', () => {
    render(
      <ModelessWindow title="指標設定" onClose={jest.fn()} initialX={10} initialY={20}>
        body
      </ModelessWindow>,
    );
    const title = screen.getByTestId('modeless-title');
    const panel = screen.getByTestId('modeless-window');

    fireEvent.mouseMove(title, { clientX: 400, clientY: 400 });
    expect(panel.style.left).toBe('10px');

    fireEvent.mouseDown(title, { clientX: 30, clientY: 40 });
    fireEvent.mouseMove(title, { clientX: 80, clientY: 90 });
    expect(panel.style.left).toBe('60px');
    expect(panel.style.top).toBe('70px');
    fireEvent.mouseUp(title);
    fireEvent.mouseMove(title, { clientX: 200, clientY: 200 });
    expect(panel.style.left).toBe('60px');
  });
});
