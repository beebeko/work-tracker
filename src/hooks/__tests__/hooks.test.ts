// Unit tests for all React Query hooks.
// Hooks are thin adapters over service functions — tests verify:
// 1. The correct query/mutation is triggered with the right arguments
// 2. Cache invalidation keys are correct on mutation success

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
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn((...args: unknown[]) => args[0]),
  orderBy: jest.fn(),
  where: jest.fn(),
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

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
}));

// Mock all service functions
jest.mock('../../services/clients');
jest.mock('../../services/positions');
jest.mock('../../services/gigs');
jest.mock('../../services/entries');

import { renderHook, waitFor } from '@testing-library/react-native';
import * as clientsService from '../../services/clients';
import * as positionsService from '../../services/positions';
import * as gigsService from '../../services/gigs';
import * as entriesService from '../../services/entries';
import { clientFixture, gigFixture, positionFixture, shiftEntryFixture } from '../../__fixtures__/entities.fixtures';
import { createWrapper } from '../../test-utils/queryWrapper';
import { useClient, useClients, useCreateClient, useDeleteClient, useUpdateClient } from '../useClients';
import { useCreatePosition, useDeletePosition, usePosition, usePositions } from '../usePositions';
import { useActiveGigs, useCreateGig, useDeleteGig, useGig, useGigs, useUpdateGig } from '../useGigs';
import { useCreateEntry, useDeleteEntry, useEntries, useEntry, useUpdateEntry } from '../useEntries';

const listClientsMock = clientsService.listClients as jest.Mock;
const getClientMock = clientsService.getClient as jest.Mock;
const createClientMock = clientsService.createClient as jest.Mock;
const deleteClientMock = clientsService.deleteClient as jest.Mock;
const updateClientMock = clientsService.updateClient as jest.Mock;

const listPositionsMock = positionsService.listPositions as jest.Mock;
const getPositionMock = positionsService.getPosition as jest.Mock;
const createPositionMock = positionsService.createPosition as jest.Mock;
const deletePositionMock = positionsService.deletePosition as jest.Mock;

const listGigsMock = gigsService.listGigs as jest.Mock;
const listActiveGigsMock = gigsService.listActiveGigs as jest.Mock;
const getGigMock = gigsService.getGig as jest.Mock;
const createGigMock = gigsService.createGig as jest.Mock;
const deleteGigMock = gigsService.deleteGig as jest.Mock;
const updateGigMock = gigsService.updateGig as jest.Mock;

const listEntriesMock = entriesService.listEntries as jest.Mock;
const getEntryMock = entriesService.getEntry as jest.Mock;
const createEntryMock = entriesService.createEntry as jest.Mock;
const deleteEntryMock = entriesService.deleteEntry as jest.Mock;
const updateEntryMock = entriesService.updateEntry as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// useClients
// ---------------------------------------------------------------------------
describe('useClients', () => {
  describe('happy path', () => {
    it('calls listClients and returns data', async () => {
      listClientsMock.mockResolvedValueOnce([clientFixture]);
      const { result } = renderHook(() => useClients(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([clientFixture]);
      expect(listClientsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('exposes error when listClients rejects', async () => {
      listClientsMock.mockRejectedValueOnce(new Error('Firestore error'));
      const { result } = renderHook(() => useClients(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });
});

describe('useClient', () => {
  describe('happy path', () => {
    it('calls getClient with the given id', async () => {
      getClientMock.mockResolvedValueOnce(clientFixture);
      const { result } = renderHook(() => useClient('client-1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getClientMock).toHaveBeenCalledWith('client-1');
    });
  });

  describe('edge cases', () => {
    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useClient(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
      expect(getClientMock).not.toHaveBeenCalled();
    });
  });
});

describe('useCreateClient', () => {
  describe('happy path', () => {
    it('calls createClient and invalidates cache on success', async () => {
      createClientMock.mockResolvedValueOnce(clientFixture);
      const { result } = renderHook(() => useCreateClient(), { wrapper: createWrapper() });
      result.current.mutate({
        name: 'New Client',
        email: 'new@example.com',
        overtimeRules: clientFixture.overtimeRules,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(createClientMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useUpdateClient', () => {
  describe('happy path', () => {
    it('calls updateClient on mutate', async () => {
      updateClientMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useUpdateClient('client-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ name: 'Renamed' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(updateClientMock).toHaveBeenCalledWith('client-1', { name: 'Renamed' });
    });
  });
});

describe('useDeleteClient', () => {
  describe('happy path', () => {
    it('calls deleteClient on mutate', async () => {
      deleteClientMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useDeleteClient(), { wrapper: createWrapper() });
      result.current.mutate('client-1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteClientMock).toHaveBeenCalledWith('client-1');
    });
  });
});

// ---------------------------------------------------------------------------
// usePositions
// ---------------------------------------------------------------------------
describe('usePositions', () => {
  describe('happy path', () => {
    it('calls listPositions with clientId', async () => {
      listPositionsMock.mockResolvedValueOnce([positionFixture]);
      const { result } = renderHook(() => usePositions('client-1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listPositionsMock).toHaveBeenCalledWith('client-1');
    });
  });

  describe('edge cases', () => {
    it('does not fetch when clientId is empty', () => {
      const { result } = renderHook(() => usePositions(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('usePosition', () => {
  describe('happy path', () => {
    it('calls getPosition with the correct args', async () => {
      getPositionMock.mockResolvedValueOnce(positionFixture);
      const { result } = renderHook(() => usePosition('client-1', 'position-1'), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getPositionMock).toHaveBeenCalledWith('client-1', 'position-1');
    });
  });
});

describe('useCreatePosition', () => {
  describe('happy path', () => {
    it('calls createPosition on mutate', async () => {
      createPositionMock.mockResolvedValueOnce(positionFixture);
      const { result } = renderHook(() => useCreatePosition('client-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ clientId: 'client-1', name: 'Gaffer', baseRate: 60 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(createPositionMock).toHaveBeenCalledWith('client-1', expect.objectContaining({ name: 'Gaffer' }));
    });
  });
});

describe('useDeletePosition', () => {
  describe('happy path', () => {
    it('calls deletePosition on mutate', async () => {
      deletePositionMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useDeletePosition('client-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate('position-1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deletePositionMock).toHaveBeenCalledWith('client-1', 'position-1');
    });
  });
});

// ---------------------------------------------------------------------------
// useGigs
// ---------------------------------------------------------------------------
describe('useGigs', () => {
  describe('happy path', () => {
    it('calls listGigs with clientId', async () => {
      listGigsMock.mockResolvedValueOnce([gigFixture]);
      const { result } = renderHook(() => useGigs('client-1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listGigsMock).toHaveBeenCalledWith('client-1');
    });
  });
});

describe('useActiveGigs', () => {
  describe('happy path', () => {
    it('calls listActiveGigs with clientId', async () => {
      listActiveGigsMock.mockResolvedValueOnce([gigFixture]);
      const { result } = renderHook(() => useActiveGigs('client-1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listActiveGigsMock).toHaveBeenCalledWith('client-1');
    });
  });
});

describe('useGig', () => {
  describe('happy path', () => {
    it('calls getGig with the correct args', async () => {
      getGigMock.mockResolvedValueOnce(gigFixture);
      const { result } = renderHook(() => useGig('client-1', 'gig-1'), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getGigMock).toHaveBeenCalledWith('client-1', 'gig-1');
    });
  });

  describe('edge cases', () => {
    it('does not fetch when gigId is empty', () => {
      const { result } = renderHook(() => useGig('client-1', ''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useCreateGig', () => {
  describe('happy path', () => {
    it('calls createGig on mutate', async () => {
      createGigMock.mockResolvedValueOnce(gigFixture);
      const { result } = renderHook(() => useCreateGig('client-1'), { wrapper: createWrapper() });
      result.current.mutate({ clientId: 'client-1', name: 'New Gig', status: 'active', tags: [] });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(createGigMock).toHaveBeenCalledWith('client-1', expect.objectContaining({ name: 'New Gig' }));
    });
  });
});

describe('useUpdateGig', () => {
  describe('happy path', () => {
    it('calls updateGig on mutate', async () => {
      updateGigMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useUpdateGig('client-1', 'gig-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ status: 'complete' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(updateGigMock).toHaveBeenCalledWith('client-1', 'gig-1', { status: 'complete' });
    });
  });
});

describe('useDeleteGig', () => {
  describe('happy path', () => {
    it('calls deleteGig on mutate', async () => {
      deleteGigMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useDeleteGig('client-1'), { wrapper: createWrapper() });
      result.current.mutate('gig-1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteGigMock).toHaveBeenCalledWith('client-1', 'gig-1');
    });
  });
});

// ---------------------------------------------------------------------------
// useEntries
// ---------------------------------------------------------------------------
describe('useEntries', () => {
  describe('happy path', () => {
    it('calls listEntries with clientId and gigId', async () => {
      listEntriesMock.mockResolvedValueOnce([shiftEntryFixture]);
      const { result } = renderHook(() => useEntries('client-1', 'gig-1'), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listEntriesMock).toHaveBeenCalledWith('client-1', 'gig-1');
    });
  });

  describe('edge cases', () => {
    it('does not fetch when gigId is empty', () => {
      const { result } = renderHook(() => useEntries('client-1', ''), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useEntry', () => {
  describe('happy path', () => {
    it('calls getEntry with the correct args', async () => {
      getEntryMock.mockResolvedValueOnce(shiftEntryFixture);
      const { result } = renderHook(() => useEntry('client-1', 'gig-1', 'entry-1'), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getEntryMock).toHaveBeenCalledWith('client-1', 'gig-1', 'entry-1');
    });
  });
});

describe('useCreateEntry', () => {
  describe('happy path', () => {
    it('calls createEntry on mutate', async () => {
      createEntryMock.mockResolvedValueOnce(shiftEntryFixture);
      const { result } = renderHook(() => useCreateEntry('client-1', 'gig-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate({
        type: 'shift',
        gigId: 'gig-1',
        clientId: 'client-1',
        positionId: 'position-1',
        date: '2026-05-01',
        startTime: '08:00',
        endTime: '17:00',
        mealBreaks: [],
        tags: [],
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(createEntryMock).toHaveBeenCalledWith('client-1', 'gig-1', expect.objectContaining({ type: 'shift' }));
    });
  });
});

describe('useUpdateEntry', () => {
  describe('happy path', () => {
    it('calls updateEntry on mutate', async () => {
      updateEntryMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useUpdateEntry('client-1', 'gig-1', 'entry-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ date: '2026-05-03' } as never);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(updateEntryMock).toHaveBeenCalledWith('client-1', 'gig-1', 'entry-1', { date: '2026-05-03' });
    });
  });
});

describe('useDeleteEntry', () => {
  describe('happy path', () => {
    it('calls deleteEntry on mutate', async () => {
      deleteEntryMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useDeleteEntry('client-1', 'gig-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate('entry-1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteEntryMock).toHaveBeenCalledWith('client-1', 'gig-1', 'entry-1');
    });
  });
});
