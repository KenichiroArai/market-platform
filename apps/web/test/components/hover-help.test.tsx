/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HoverHelp } from '../../components/hover-help';

describe('HoverHelp', () => {
  it('shows tooltip on hover and hides on leave', () => {
    render(
      <HoverHelp text="説明テキスト">
        <button type="button">対象</button>
      </HoverHelp>,
    );
    expect(screen.queryByTestId('hover-help-tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('hover-help'));
    expect(screen.getByTestId('hover-help-tooltip')).toHaveTextContent('説明テキスト');
    fireEvent.mouseLeave(screen.getByTestId('hover-help'));
    expect(screen.queryByTestId('hover-help-tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus and hides on blur', () => {
    render(
      <HoverHelp text="説明テキスト">
        <button type="button">対象</button>
      </HoverHelp>,
    );
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByTestId('hover-help-tooltip')).toBeInTheDocument();
    fireEvent.blur(screen.getByRole('button'));
    expect(screen.queryByTestId('hover-help-tooltip')).not.toBeInTheDocument();
  });
});
