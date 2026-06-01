import { fireEvent, render } from '@testing-library/react-native';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const baseProps = {
    visible: true,
    title: 'Delete Item',
    message: 'Are you sure you want to delete this item?',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  describe('happy path', () => {
    it('renders title and message when visible', () => {
      const { getByText } = render(<ConfirmDialog {...baseProps} />);
      expect(getByText('Delete Item')).toBeTruthy();
      expect(getByText('Are you sure you want to delete this item?')).toBeTruthy();
    });

    it('renders default confirm label "Confirm"', () => {
      const { getByText } = render(<ConfirmDialog {...baseProps} />);
      expect(getByText('Confirm')).toBeTruthy();
    });

    it('renders custom confirmLabel', () => {
      const { getByText } = render(<ConfirmDialog {...baseProps} confirmLabel="Delete" />);
      expect(getByText('Delete')).toBeTruthy();
    });

    it('calls onConfirm when confirm button is pressed', () => {
      const onConfirm = jest.fn();
      const { getByText } = render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
      fireEvent.press(getByText('Confirm'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Cancel button is pressed', () => {
      const onCancel = jest.fn();
      const { getByText } = render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
      fireEvent.press(getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('destructive variant', () => {
    it('renders without error when destructive=true', () => {
      const { getByText } = render(<ConfirmDialog {...baseProps} destructive />);
      expect(getByText('Confirm')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('renders nothing meaningful when visible=false', () => {
      const { queryByText } = render(<ConfirmDialog {...baseProps} visible={false} />);
      expect(queryByText('Delete Item')).toBeNull();
    });

    it('renders long title and message without crashing', () => {
      const { getByText } = render(
        <ConfirmDialog
          {...baseProps}
          title="A very long dialog title that wraps to multiple lines in the modal"
          message="An extremely long message with lots of detail about what will happen if you confirm this action, including irreversible consequences."
        />,
      );
      expect(getByText(/A very long dialog title/)).toBeTruthy();
    });
  });
});
