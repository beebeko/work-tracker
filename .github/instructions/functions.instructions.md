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

## Resend Inbound (email parsing webhook)

- Inbound emails arrive via a Resend Inbound webhook posted to the `parseEmail` `onRequest` function.
- Resend signs webhooks using **Svix**. Verify every request with `new Webhook(secret).verify(rawBody, headers)` using the `svix` package.
  - Headers required: `svix-id`, `svix-timestamp`, `svix-signature`.
  - You **must** pass `req.rawBody` (not the JSON-parsed `req.body`) to `verify()` — signature is over the raw bytes.
  - On verification failure: respond `401 Unauthorized` and log a warning. Never proceed with unverified payloads.
- The signing secret is stored as `PARSE_WEBHOOK_SECRET` in Firebase Secret Manager (value starts with `whsec_…`).
- Payload shape: `{ type: 'email.received', data: { from, to, subject, text, html, ... } }`. The `from` field may be a string or an object (`{ name?, address?, email? }`). Use `ResendAdapter` in `functions/src/lib/emailIngestion.ts` to normalise it.
- The `SendGridAdapter` is retained for reference / future migration but is **not** wired up. Do not switch back without also reverting the Svix verification path.
- Unknown senders are silently dropped with `200 OK` — never expose whether a sender is tracked.

## OpenAI (email parsing)

- OpenAI API key stored in Firebase Secret Manager.
- Extraction prompt lives in `functions/src/prompts/extractJobFromEmail.ts` — not inlined.
- Always validate and sanitize OpenAI output before returning to the client. Treat it as untrusted.
- Include a `confidence` field in the response so the UI can flag low-confidence extractions.

## Performance

- Initialize Firebase Admin and third-party clients outside the function handler (module scope) to reuse across warm invocations.
- Set appropriate `timeoutSeconds` and `memory` in function config — don't use defaults for heavy operations.
