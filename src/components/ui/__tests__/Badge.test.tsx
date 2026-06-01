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
import { Badge } from '../Badge';

describe('Badge', () => {
  describe('happy path — renders correct label', () => {
    const cases = [
      ['active', 'Active'],
      ['complete', 'Complete'],
      ['cancelled', 'Cancelled'],
      ['on_hold', 'On Hold'],
      ['draft', 'Draft'],
      ['sent', 'Sent'],
      ['paid', 'Paid'],
    ] as const;

    it.each(cases)('status=%s renders "%s"', (status, label) => {
      render(<Badge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('renders without crashing for each variant', () => {
      const { unmount } = render(<Badge status="active" />);
      unmount();
      render(<Badge status="paid" />);
    });
  });
});
