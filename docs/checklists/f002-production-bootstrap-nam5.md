# F-002 Production Bootstrap Checklist (NAM5)

Purpose: concise operator checklist for first production Firebase setup under the F-002 decision lock.

## Preflight

- [ ] Confirm Node 20+ locally (recommended for Firebase CLI parity): `node -v`
- [ ] Confirm Firebase CLI is available: `npx firebase-tools --version`
- [ ] Confirm target project ID is correct for production before console setup.

## Firebase console setup (production)

- [ ] Authentication -> Sign-in method -> enable Anonymous provider.
- [ ] Firestore Database -> Create database -> Production mode (or approved secure mode) -> location: `nam5`.
- [ ] Firestore Rules -> publish rules that scope access to authenticated user UID paths.
- [ ] Hosting -> connect project to web app/hosting site and verify deploy target.

## Location immutability guardrail

- [ ] Verify Firestore location shows `nam5` before final confirmation.
- [ ] Acknowledge that Firestore location is immutable after initialization.
- [ ] If `nam5` is not selected, stop and escalate before creating the database.

## Local emulator verification (non-destructive)

Run this sequence from the repo root:

```bash
npm run firebase:check:prereqs
npm run firebase:verify:emulator:smoke
```

Optional full local stack:

```bash
npm run firebase:emulators:start
npm run dev
```
