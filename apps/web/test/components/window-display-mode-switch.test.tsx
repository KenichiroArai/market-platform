/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { WindowDisplayModeSwitch } from '../../components/window-display-mode-switch';

describe('WindowDisplayModeSwitch', () => {
  it('notifies onChange when a mode is selected', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <WindowDisplayModeSwitch name="test-mode" value="modeless" onChange={onChange} />,
    );
    fireEvent.click(screen.getByDisplayValue('popout'));
    expect(onChange).toHaveBeenCalledWith('popout');

    rerender(
      <WindowDisplayModeSwitch name="test-mode" value="popout" onChange={onChange} />,
    );
    fireEvent.click(screen.getByDisplayValue('modeless'));
    expect(onChange).toHaveBeenCalledWith('modeless');
  });
});
