import { Field } from '../Field';
import { render, fireEvent } from '@testing-library/react-native';

describe('Field', () => {
  describe('happy path', () => {
    it('renders the label', () => {
      const { getByText } = render(<Field label="Email" value="" onChangeText={jest.fn()} />);
      expect(getByText('Email')).toBeTruthy();
    });

    it('renders the current value in the input', () => {
      const { getByDisplayValue } = render(
        <Field label="Name" value="Alice" onChangeText={jest.fn()} />,
      );
      expect(getByDisplayValue('Alice')).toBeTruthy();
    });

    it('calls onChangeText when user types', () => {
      const onChangeText = jest.fn();
      const { getByDisplayValue } = render(
        <Field label="Name" value="Alice" onChangeText={onChangeText} />,
      );
      fireEvent.changeText(getByDisplayValue('Alice'), 'Bob');
      expect(onChangeText).toHaveBeenCalledWith('Bob');
    });

    it('renders placeholder when value is empty', () => {
      const { getByPlaceholderText } = render(
        <Field label="Notes" value="" onChangeText={jest.fn()} placeholder="Enter notes" />,
      );
      expect(getByPlaceholderText('Enter notes')).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('renders error message when error prop is provided', () => {
      const { getByText } = render(
        <Field label="Email" value="" onChangeText={jest.fn()} error="Email is required" />,
      );
      expect(getByText('Email is required')).toBeTruthy();
    });

    it('does not render error message when error is undefined', () => {
      const { queryByText } = render(
        <Field label="Email" value="" onChangeText={jest.fn()} />,
      );
      expect(queryByText('Email is required')).toBeNull();
    });
  });

  describe('bad input', () => {
    it('renders with empty string value without crashing', () => {
      const { getByText } = render(<Field label="Field" value="" onChangeText={jest.fn()} />);
      expect(getByText('Field')).toBeTruthy();
    });

    it('renders with empty label without crashing', () => {
      const { UNSAFE_getByType } = render(
        <Field label="" value="" onChangeText={jest.fn()} />,
      );
      expect(UNSAFE_getByType(require('react-native').TextInput)).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('passes additional TextInput props through', () => {
      const { getByTestId } = render(
        <Field
          label="PIN"
          value=""
          onChangeText={jest.fn()}
          secureTextEntry
          testID="pin-input"
        />,
      );
      expect(getByTestId('pin-input')).toBeTruthy();
    });

    it('renders multiline input without crashing', () => {
      const { getByText } = render(
        <Field label="Notes" value="line1\nline2" onChangeText={jest.fn()} multiline />,
      );
      expect(getByText('Notes')).toBeTruthy();
    });
  });
});
