---
description: 'Use when creating or editing Firestore service functions, data models, TypeScript types, or security rules. Covers Firestore schema conventions, typed CRUD patterns, React Query integration, and security rule structure.'
applyTo: 'src/services/**,src/models/**,src/types/**,firestore.rules'
---

# Data Layer Guidelines

## Type definitions

- All entity types live in `src/types/`. One file per domain entity.
- Use `z` (Zod) for runtime validation of external data (Firestore reads, API responses).
- Every Firestore document has an `ownerUid: string` field for security rule enforcement.
- Timestamps use Firestore `Timestamp`, converted to `Date` at the service boundary — components never handle raw `Timestamp`.

## Firestore service functions

- One file per collection: `src/services/clients.ts`, `src/services/gigs.ts`, etc.
- All functions are typed: explicit parameter types, explicit return types.
- Pattern:
  ```ts
  export async function getClient(id: string): Promise<Client> { ... }
  export async function createClient(data: CreateClientInput): Promise<Client> { ... }
  export async function updateClient(id: string, patch: Partial<UpdateClientInput>): Promise<void> { ... }
  export async function deleteClient(id: string): Promise<void> { ... }
  ```
- Use `Input` suffix for create/update parameter types (excludes `id`, `ownerUid`, `createdAt`, `updatedAt`).

## React Query integration

- Query keys live in `src/services/queryKeys.ts` as a typed constant object.
- Each entity has a query hook in `src/hooks/use<Entity>.ts`:
  ```ts
  export function useClients() {
    return useQuery({ queryKey: queryKeys.clients.all, queryFn: listClients });
  }
  ```
- Mutations use `useMutation` with `onSuccess` cache invalidation.

## Collection structure

```
clients/{clientId}
  ownerUid, name, email, address, notes, overtimeRules
  positions/{positionId}
    name, baseRate, overtimeRulesOverride?
  gigs/{gigId}
    name, startDate, endDate, status, tags, notes
    entries/{entryId}
      type, positionId, date, startTime?, endTime?, mealBreaks[], amount?, tags, notes
invoices/{invoiceId}
  ownerUid, clientId, gigId, lineItems, totalAmount, sentAt, pdfStoragePath
```

## Security rules

- Every new collection needs a rule. Default: deny all.
- Rule pattern: `allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerUid;`
- Validate required fields on create using `request.resource.data`.
