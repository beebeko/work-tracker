jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn((...args: unknown[]) => args[0]),
  orderBy: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({})),
  Timestamp: { now: jest.fn(), fromDate: jest.fn() },
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  GoogleAuthProvider: jest.fn(() => ({})),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('@/src/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
  functions: {},
  storage: {},
}));

jest.mock('@/src/hooks/usePendingImports');
jest.mock('@/src/hooks/useGigs');
jest.mock('@/src/hooks/usePositions');
jest.mock('@/src/services/entries');
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(() => ({ importId: 'import-1' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
}));

import {
    gigFixture,
    pendingImportFixture,
    positionFixture,
} from '@/src/__fixtures__/entities.fixtures';
import { useGigs } from '@/src/hooks/useGigs';
import { usePendingImports, useUpdatePendingImport } from '@/src/hooks/usePendingImports';
import { usePositions } from '@/src/hooks/usePositions';
import { createWrapper } from '@/src/test-utils/queryWrapper';
import { useMutation } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import ImportReviewModal from '../import-review';

beforeEach(() => {
  jest.clearAllMocks();

  // Default hook setup
  (usePendingImports as jest.Mock).mockReturnValue({
    data: [pendingImportFixture],
    isLoading: false,
  });
  (useGigs as jest.Mock).mockReturnValue({ data: [gigFixture], isLoading: false });
  (usePositions as jest.Mock).mockReturnValue({ data: [positionFixture], isLoading: false });
  (useUpdatePendingImport as jest.Mock).mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  });

  // Default dynamic mutation setup
  (useMutation as jest.Mock).mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  });
});

function renderScreen() {
  return render(<ImportReviewModal />, { wrapper: createWrapper() });
}

describe('ImportReviewModal', () => {
  describe('happy path', () => {
    it('pre-fills date from extracted data', () => {
      renderScreen();
      // Field component renders an input; find by value
      expect(screen.getByDisplayValue('2026-06-01')).toBeTruthy();
    });

    it('pre-fills start and end times for shift entries', () => {
      renderScreen();
      expect(screen.getByDisplayValue('08:00')).toBeTruthy();
      expect(screen.getByDisplayValue('18:00')).toBeTruthy();
    });

    it('displays AI confidence percentage', () => {
      renderScreen();
      expect(screen.getByText('92%')).toBeTruthy();
    });

    it('shows gig hint from extracted data', () => {
      renderScreen();
      // The hint box text appears; multiple elements may match since the gig chip also shows the name
      expect(screen.getAllByText(/Feature Film/).length).toBeGreaterThanOrEqual(1);
    });

    it('auto-selects a gig whose name includes the gigHint', () => {
      renderScreen();
      // Gig chip should be rendered; the fixture gig name includes 'Feature Film'
      expect(screen.getByText('Feature Film Spring 2026')).toBeTruthy();
    });

    it('confirms: calls createEntry and marks import imported, then navigates back', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
      (useMutation as jest.Mock).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });
      const mockUpdateMutate = jest.fn().mockResolvedValue(undefined);
      (useUpdatePendingImport as jest.Mock).mockReturnValue({
        mutateAsync: mockUpdateMutate,
        isPending: false,
      });
      const mockBack = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ back: mockBack });

      renderScreen();

      // Select gig chip
      fireEvent.press(screen.getByText('Feature Film Spring 2026'));
      // Select position chip
      fireEvent.press(screen.getByText('Key Grip'));

      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            cId: 'client-1',
            gId: 'gig-1',
            payload: expect.objectContaining({
              type: 'shift',
              date: '2026-06-01',
              startTime: '08:00',
              endTime: '18:00',
            }),
          }),
        );
        expect(mockUpdateMutate).toHaveBeenCalledWith('imported');
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it('dismiss: marks import dismissed and navigates back', async () => {
      const mockUpdateMutate = jest.fn().mockResolvedValue(undefined);
      (useUpdatePendingImport as jest.Mock).mockReturnValue({
        mutateAsync: mockUpdateMutate,
        isPending: false,
      });
      const mockBack = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ back: mockBack });

      renderScreen();

      fireEvent.press(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith('dismissed');
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it('renders lump_sum fields when entry type is lump_sum', () => {
      (usePendingImports as jest.Mock).mockReturnValue({
        data: [
          {
            ...pendingImportFixture,
            extracted: {
              ...pendingImportFixture.extracted,
              entryType: 'lump_sum',
              amount: 350,
              startTime: undefined,
              endTime: undefined,
            },
          },
        ],
        isLoading: false,
      });

      renderScreen();
      expect(screen.getByDisplayValue('350')).toBeTruthy();
    });
  });

  describe('validation errors', () => {
    it('shows alert when date is missing', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      renderScreen();

      // Clear the auto-filled date
      fireEvent.changeText(screen.getByDisplayValue('2026-06-01'), '');
      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Invalid date', expect.any(String));
      });
    });

    it('shows alert when no gig is selected', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      // Provide gig not matching the hint so no auto-selection occurs
      (useGigs as jest.Mock).mockReturnValue({ data: [{ ...gigFixture, name: 'Other Project' }] });
      (usePendingImports as jest.Mock).mockReturnValue({
        data: [
          {
            ...pendingImportFixture,
            extracted: { ...pendingImportFixture.extracted, gigHint: undefined },
          },
        ],
        isLoading: false,
      });

      renderScreen();
      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Required', 'Select a gig.');
      });
    });

    it('shows alert when time format is invalid for shift entry', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      renderScreen();

      // Select gig and position
      fireEvent.press(screen.getByText('Feature Film Spring 2026'));
      fireEvent.press(screen.getByText('Key Grip'));

      // Enter an invalid start time
      fireEvent.changeText(screen.getByDisplayValue('08:00'), 'bad-time');
      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Invalid time', expect.any(String));
      });
    });

    it('shows alert when lump_sum amount is not a positive number', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (usePendingImports as jest.Mock).mockReturnValue({
        data: [
          {
            ...pendingImportFixture,
            extracted: {
              ...pendingImportFixture.extracted,
              entryType: 'lump_sum',
              amount: undefined,
              startTime: undefined,
              endTime: undefined,
            },
          },
        ],
        isLoading: false,
      });

      renderScreen();
      fireEvent.press(screen.getByText('Feature Film Spring 2026'));
      fireEvent.press(screen.getByText('Key Grip'));
      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Invalid amount', expect.any(String));
      });
    });
  });

  describe('mid-process failures', () => {
    it('shows error alert and does not mark imported when createEntry fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const mockMutateAsync = jest.fn().mockRejectedValue(new Error('Firestore error'));
      (useMutation as jest.Mock).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });
      const mockUpdateMutate = jest.fn();
      (useUpdatePendingImport as jest.Mock).mockReturnValue({
        mutateAsync: mockUpdateMutate,
        isPending: false,
      });

      renderScreen();
      fireEvent.press(screen.getByText('Feature Film Spring 2026'));
      fireEvent.press(screen.getByText('Key Grip'));
      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to save'));
        expect(mockUpdateMutate).not.toHaveBeenCalled();
      });
    });

    it('shows error alert when createEntry succeeds but updateImport fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
      (useMutation as jest.Mock).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });
      const mockUpdateMutate = jest.fn().mockRejectedValue(new Error('Update failed'));
      (useUpdatePendingImport as jest.Mock).mockReturnValue({
        mutateAsync: mockUpdateMutate,
        isPending: false,
      });
      const mockBack = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ back: mockBack });

      renderScreen();
      fireEvent.press(screen.getByText('Feature Film Spring 2026'));
      fireEvent.press(screen.getByText('Key Grip'));
      fireEvent.press(screen.getByText('Confirm'));

      await waitFor(() => {
        // Entry was created
        expect(mockMutateAsync).toHaveBeenCalled();
        // Import stays pending (update failed)
        expect(mockUpdateMutate).toHaveBeenCalledWith('imported');
        // User sees error; did not navigate away
        expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to save'));
        expect(mockBack).not.toHaveBeenCalled();
      });
    });

    it('shows error alert when dismiss mutation fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (useUpdatePendingImport as jest.Mock).mockReturnValue({
        mutateAsync: jest.fn().mockRejectedValue(new Error('Dismiss failed')),
        isPending: false,
      });

      renderScreen();
      fireEvent.press(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to dismiss'),
        );
      });
    });
  });

  describe('edge cases', () => {
    it('renders "Import not found" when importId does not match', () => {
      (usePendingImports as jest.Mock).mockReturnValue({ data: [], isLoading: false });
      renderScreen();
      expect(screen.getByText(/Import not found/)).toBeTruthy();
    });

    it('renders "No gigs for this client" when gig list is empty', () => {
      (useGigs as jest.Mock).mockReturnValue({ data: [], isLoading: false });
      renderScreen();
      expect(screen.getByText('No gigs for this client')).toBeTruthy();
    });

    it('renders "No positions for this client" when position list is empty', () => {
      (usePositions as jest.Mock).mockReturnValue({ data: [], isLoading: false });
      renderScreen();
      expect(screen.getByText('No positions for this client')).toBeTruthy();
    });

    it('does not overwrite user-edited gigId on subsequent renders of the effect', () => {
      // Render once — initialized.current becomes true
      const { rerender } = render(<ImportReviewModal />, { wrapper: createWrapper() });

      // Now simulate a re-render with new gigs (e.g., refetch)
      const otherGig = { ...gigFixture, id: 'gig-999', name: 'Different Project' };
      (useGigs as jest.Mock).mockReturnValue({ data: [gigFixture, otherGig] });
      rerender(<ImportReviewModal />);

      // The gig chip for the original auto-selection should still be reflected
      // (initialized guard prevents re-run — no second auto-select to different gig)
      expect(screen.getByText('Feature Film Spring 2026')).toBeTruthy();
    });
  });
});
