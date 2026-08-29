/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { FieldHelpIcon } from '../../components/field-help-icon';

describe('FieldHelpIcon', () => {
  it('shows tooltip on hover', () => {
    render(
      <FieldHelpIcon text="説明本文" ariaLabel="項目の説明" testId="sample-help" />,
    );
    expect(screen.queryByTestId('sample-help-tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('sample-help'));
    expect(screen.getByTestId('sample-help-tooltip')).toHaveTextContent('説明本文');
    fireEvent.mouseLeave(screen.getByTestId('sample-help'));
    expect(screen.queryByTestId('sample-help-tooltip')).not.toBeInTheDocument();
  });
});
