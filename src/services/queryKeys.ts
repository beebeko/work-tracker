export const queryKeys = {
  userProfile: {
    detail: () => ['userProfile'] as const,
  },
  emailAccounts: {
    all: ['emailAccounts'] as const,
    detail: (id: string) => ['emailAccounts', id] as const,
  },
  clients: {
    all: ['clients'] as const,
    detail: (id: string) => ['clients', id] as const,
  },
  positions: {
    all: (clientId: string) => ['clients', clientId, 'positions'] as const,
    detail: (clientId: string, id: string) => ['clients', clientId, 'positions', id] as const,
  },
  gigs: {
    all: (clientId: string) => ['clients', clientId, 'gigs'] as const,
    detail: (clientId: string, id: string) => ['clients', clientId, 'gigs', id] as const,
  },
  entries: {
    all: (clientId: string, gigId: string) =>
      ['clients', clientId, 'gigs', gigId, 'entries'] as const,
    detail: (clientId: string, gigId: string, id: string) =>
      ['clients', clientId, 'gigs', gigId, 'entries', id] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    detail: (id: string) => ['invoices', id] as const,
    byClient: (clientId: string) => ['invoices', 'byClient', clientId] as const,
    byGig: (gigId: string) => ['invoices', 'byGig', gigId] as const,
  },
  clientSenders: {
    all: (clientId: string) => ['clients', clientId, 'senders'] as const,
  },
  pendingImports: {
    all: ['pendingImports'] as const,
  },
} as const;
