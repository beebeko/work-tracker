---
description: 'Use when creating or editing Firebase Cloud Functions. Covers function structure, error handling, Resend email integration, OpenAI integration, and security patterns.'
applyTo: 'functions/**'
---

# Cloud Functions Guidelines

## Structure

- One function per file under `functions/src/`.
- Export all functions from `functions/src/index.ts`.
- Use `onCall` (HTTPS callable) for functions triggered by the app. Use `onRequest` only for webhooks.
- All callable functions validate `context.auth` first — reject unauthenticated calls immediately.

## Error handling

- Use `HttpsError` with appropriate codes: `unauthenticated`, `invalid-argument`, `not-found`, `internal`.
- Never leak internal error details to the client. Log full errors server-side; return sanitized messages.
- Wrap all async operations in try/catch. Never let a function crash silently.

## Resend (email)

- Resend API key stored in Firebase Secret Manager, accessed via `defineSecret`.
- Use the `resend` npm package. Always send from a verified domain.
- Attachment PDFs are uploaded to Firebase Storage first; the function reads the buffer and attaches it.
- Log send attempts and outcomes (success/failure) without logging email content.

## OpenAI (email parsing)

- OpenAI API key stored in Firebase Secret Manager.
- Extraction prompt lives in `functions/src/prompts/extractJobFromEmail.ts` — not inlined.
- Always validate and sanitize OpenAI output before returning to the client. Treat it as untrusted.
- Include a `confidence` field in the response so the UI can flag low-confidence extractions.

## Performance

- Initialize Firebase Admin and third-party clients outside the function handler (module scope) to reuse across warm invocations.
- Set appropriate `timeoutSeconds` and `memory` in function config — don't use defaults for heavy operations.
