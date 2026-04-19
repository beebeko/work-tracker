# F-002 Firebase Emulator + Deployment Workflow

## Decision lock: Firestore production location

F-002 is now locked to Firestore location `nam5` (US multi-region).

- Set production Firestore location to `nam5` during first initialization.
- Do not select a different region for this feature branch.
- Firestore location is immutable after initialization.

Use this decision consistently across operator runbooks and production bootstrap steps.

## Runtime note (recommended)

Node 20+ is recommended for Firebase CLI parity.

Optional local setup:

```bash
node -v
# If using nvm:
nvm install 20
nvm use 20
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in your Firebase Web App values.

Required:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Adapter selection:

- `.env.development` sets `VITE_FREELANCE_DATA_ADAPTER=firebase` for local dev by default.
- Override in `.env.local` if you want JSON fallback for troubleshooting.

## Emulator workflow

Recommended local verification sequence:

```bash
npm run firebase:check:prereqs
npm run firebase:verify:emulator:smoke
```

Then run the full local stack:

```bash
npm run firebase:emulators:start
npm run dev
```

1. Start local emulators:

```bash
npm run firebase:emulators:start
```

1. Optional: persist emulator data between runs:

```bash
npm run firebase:emulators:export
```

1. Emulator endpoints configured in `firebase.json`:

- Auth: `localhost:9099`
- Firestore: `localhost:8080`
- Hosting: `localhost:5002`
- Emulator UI: `localhost:4000`

## Deploy commands

Deploy Hosting only:

```bash
npm run firebase:deploy:hosting
```

Build then deploy Hosting:

```bash
npm run firebase:deploy:hosting:build
```

Deploy preview channel:

```bash
npm run firebase:deploy:preview
```

## Firestore production location note

Before first production Firestore initialization in the Firebase console, set location to `nam5`.

`nam5` is the approved F-002 production location.

Firestore location cannot be changed after initialization, so this decision must be treated as permanent.

## Production bootstrap checklist

Use the checklist in `docs/checklists/f002-production-bootstrap-nam5.md` when bootstrapping production.
