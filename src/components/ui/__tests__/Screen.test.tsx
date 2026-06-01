jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn(() => ({})) }));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn(() => ({})),
}));
jest.mock('../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  googleProvider: {},
}));

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from '../Screen';

describe('Screen', () => {
  describe('happy path', () => {
    it('renders children', () => {
      render(
        <Screen>
          <Text>Hello</Text>
        </Screen>,
      );
      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('renders children with flex=false', () => {
      render(
        <Screen flex={false}>
          <Text>No flex</Text>
        </Screen>,
      );
      expect(screen.getByText('No flex')).toBeTruthy();
    });
  });
});
