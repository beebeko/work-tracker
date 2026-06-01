---
description: 'Use when creating or editing test files. Covers required test scenarios, structure conventions, mocking patterns for Firebase and React Query, and coverage requirements.'
applyTo: '**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx'
---

# Testing Guidelines

## Required scenarios for every test suite

1. **Happy path**: Valid inputs → expected outputs. The primary use case works.
2. **Error cases**: Upstream calls throw or return errors. The code handles them gracefully.
3. **Bad input**: Null, undefined, empty string, wrong type, out-of-range values. Validate at boundaries.
4. **Mid-process failure**: For multi-step operations, simulate failure at each step. Verify no partial state is left.
5. **Edge cases specific to the code**: OT boundary hours, empty lists, single items, maximum values, etc.

## Test structure

```ts
describe('functionName', () => {
  describe('happy path', () => { ... });
  describe('error handling', () => { ... });
  describe('bad input', () => { ... });
  describe('edge cases', () => { ... });
});
```

- Test names must read as plain English: `'returns overtime pay when weekly hours exceed threshold'`.
- One assertion concept per test. Multiple `expect` calls are fine if they all verify the same concept.
- No `test.only` or `test.skip` in committed code.

## Mocking

- Mock Firestore using `src/__mocks__/firebase.ts`. Never hit real Firebase in unit tests.
- Mock React Query with `createWrapper()` from `src/test-utils/queryWrapper.tsx`.
- Mock external APIs (Resend, OpenAI) at the module level with `jest.mock`.
- Use `jest.spyOn` for partial mocks. Restore with `afterEach(() => jest.restoreAllMocks())`.

## Coverage

- Global minimum: 80% branches, functions, lines, statements.
- Pay engine (`src/pay/`): 95% minimum — this is financial calculation code.
- Run `npm run test:coverage` before every PR.
