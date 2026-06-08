import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { Webhook } from 'svix';
import { db } from './lib/admin';
import { extractAddress, ResendAdapter } from './lib/emailIngestion';
import { getOpenAIClient } from './lib/openaiClient';
import { resolveSenderToClient } from './lib/senderResolver';
import { SYSTEM_PROMPT } from './prompts/extractJobFromEmail';

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const WEBHOOK_SECRET = defineSecret('PARSE_WEBHOOK_SECRET');

/** Maximum raw email body stored in Firestore (10 KB). */
const MAX_RAW_BYTES = 10_240;

const adapter = new ResendAdapter();

export const parseEmail = onRequest(
  {
    secrets: [OPENAI_API_KEY, WEBHOOK_SECRET],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req, res) => {
    // ── Verify Svix signature (Resend Inbound) ─────────────────────────────
    // Svix signs the raw request body; we must verify against req.rawBody, not
    // the JSON-parsed req.body. Firebase Cloud Functions v2 always provides rawBody
    // for onRequest handlers.
    let verifiedPayload: Record<string, unknown>;
    try {
      const wh = new Webhook(WEBHOOK_SECRET.value());
      if (!req.rawBody) {
        throw new Error('Missing rawBody: Firebase Cloud Functions should provide it');
      }
      verifiedPayload = wh.verify(req.rawBody.toString('utf8'), {
        'svix-id': String(req.headers['svix-id'] ?? ''),
        'svix-timestamp': String(req.headers['svix-timestamp'] ?? ''),
        'svix-signature': String(req.headers['svix-signature'] ?? ''),
      }) as Record<string, unknown>;
    } catch (err) {
      logger.warn('parseEmail: signature verification failed', { err });
      res.status(401).send('Unauthorized');
      return;
    }

    // ── Parse the inbound email ────────────────────────────────────────────
    let email;
    try {
      email = adapter.parse(verifiedPayload);
    } catch (err) {
      logger.warn('parseEmail: malformed payload', { err });
      res.status(400).send('Bad Request');
      return;
    }

    const fromAddress = extractAddress(email.from);

    // ── Resolve sender → client ────────────────────────────────────────────
    const resolved = await resolveSenderToClient(fromAddress);
    if (!resolved) {
      // Not a tracked sender — silently discard.
      logger.info('parseEmail: no client match for sender', { fromAddress });
      res.status(200).send('OK');
      return;
    }

    const { clientId, ownerUid } = resolved;

    // ── Extract job data via OpenAI ────────────────────────────────────────
    let extracted;
    try {
      extracted = await extractJobData(email.text);
    } catch (err) {
      logger.error('parseEmail: OpenAI extraction failed', { err, clientId });
      res.status(500).send('Extraction failed');
      return;
    }

    // ── Persist pending import ─────────────────────────────────────────────
    // Truncate by byte length, not character count, to honour the 10 KB limit precisely.
    const rawEmail = Buffer.from(email.text).slice(0, MAX_RAW_BYTES).toString();

    try {
      await db.collection('pendingImports').add({
        ownerUid,
        clientId,
        rawEmail,
        extracted,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('parseEmail: failed to persist import', { err, clientId });
      res.status(500).send('Persistence failed');
      return;
    }

    logger.info('parseEmail: import created', { clientId, confidence: extracted.confidence });
    res.status(200).send('OK');
  },
);

// ── Internal helpers ─────────────────────────────────────────────────────────

interface ExtractedJobData {
  date: string;
  entryType: 'shift' | 'lump_sum';
  startTime?: string;
  endTime?: string;
  amount?: number;
  positionHint?: string;
  gigHint?: string;
  notes?: string;
  confidence: number;
}

async function extractJobData(emailText: string): Promise<ExtractedJobData> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: emailText },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  return validateExtraction(JSON.parse(raw));
}

function validateExtraction(raw: Record<string, unknown>): ExtractedJobData {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  const date = String(raw.date ?? '');
  if (!DATE_RE.test(date)) {
    throw new Error(`Invalid date from OpenAI: "${date}"`);
  }

  const entryType = raw.entryType === 'lump_sum' ? 'lump_sum' : 'shift';
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence ?? 0)));

  const result: ExtractedJobData = { date, entryType, confidence };

  if (entryType === 'shift') {
    const startTime = String(raw.startTime ?? '');
    const endTime = String(raw.endTime ?? '');
    if (startTime && TIME_RE.test(startTime)) result.startTime = startTime;
    if (endTime && TIME_RE.test(endTime)) result.endTime = endTime;
  }

  if (entryType === 'lump_sum') {
    const amount = Number(raw.amount);
    if (isFinite(amount) && amount > 0) result.amount = amount;
  }

  if (typeof raw.positionHint === 'string' && raw.positionHint) {
    result.positionHint = raw.positionHint.slice(0, 200);
  }
  if (typeof raw.gigHint === 'string' && raw.gigHint) {
    result.gigHint = raw.gigHint.slice(0, 200);
  }
  if (typeof raw.notes === 'string' && raw.notes) {
    result.notes = raw.notes.slice(0, 500);
  }

  return result;
}
