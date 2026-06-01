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
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  describe('happy path', () => {
    it('renders the message', () => {
      render(<EmptyState message="No items yet" />);
      expect(screen.getByText('No items yet')).toBeTruthy();
    });

    it('renders the hint when provided', () => {
      render(<EmptyState message="No items" hint="Add one to get started." />);
      expect(screen.getByText('Add one to get started.')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('does not render hint element when hint is omitted', () => {
      render(<EmptyState message="Empty" />);
      expect(screen.queryByText('Add one to get started.')).toBeNull();
    });
  });
});
