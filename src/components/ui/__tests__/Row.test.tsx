jest.mock('firebase/app', () => ({ initializeApp: jest.fn(() => ({})), getApps: jest.fn(() => []), getApp: jest.fn(() => ({})) }));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn(() => ({})) }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(() => ({})), GoogleAuthProvider: jest.fn(() => ({})) }));
jest.mock('../../../lib/firebase', () => ({ db: {}, auth: { currentUser: null }, googleProvider: {} }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Row } from '../Row';

describe('Row', () => {
  describe('happy path', () => {
    it('renders the title', () => {
      render(<Row title="My Client" />);
      expect(screen.getByText('My Client')).toBeTruthy();
    });

    it('renders subtitle when provided', () => {
      render(<Row title="My Client" subtitle="client@example.com" />);
      expect(screen.getByText('client@example.com')).toBeTruthy();
    });

    it('renders right element when provided', () => {
      render(<Row title="Row" right={<Text>$100.00</Text>} />);
      expect(screen.getByText('$100.00')).toBeTruthy();
    });

    it('renders chevron when chevron=true', () => {
      render(<Row title="Navigate" chevron />);
      expect(screen.getByText('›')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('does not render subtitle when omitted', () => {
      render(<Row title="No Sub" />);
      expect(screen.queryByText('subtitle')).toBeNull();
    });

    it('does not render chevron by default', () => {
      render(<Row title="No Chevron" />);
      expect(screen.queryByText('›')).toBeNull();
    });

    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<Row title="Pressable" onPress={onPress} />);
      fireEvent.press(screen.getByText('Pressable'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders as non-pressable View when onPress is omitted', () => {
      // Should not throw when rendered without onPress
      render(<Row title="Static Row" />);
      expect(screen.getByText('Static Row')).toBeTruthy();
    });
  });
});
