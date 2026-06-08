"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEmail = void 0;
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const svix_1 = require("svix");
const admin_1 = require("./lib/admin");
const emailIngestion_1 = require("./lib/emailIngestion");
const openaiClient_1 = require("./lib/openaiClient");
const senderResolver_1 = require("./lib/senderResolver");
const extractJobFromEmail_1 = require("./prompts/extractJobFromEmail");
const OPENAI_API_KEY = (0, params_1.defineSecret)('OPENAI_API_KEY');
const WEBHOOK_SECRET = (0, params_1.defineSecret)('PARSE_WEBHOOK_SECRET');
/** Maximum raw email body stored in Firestore (10 KB). */
const MAX_RAW_BYTES = 10_240;
const adapter = new emailIngestion_1.ResendAdapter();
exports.parseEmail = (0, https_1.onRequest)({
    secrets: [OPENAI_API_KEY, WEBHOOK_SECRET],
    timeoutSeconds: 60,
    memory: '512MiB',
}, async (req, res) => {
    // ── Verify Svix signature (Resend Inbound) ─────────────────────────────
    // Svix signs the raw request body; we must verify against req.rawBody, not
    // the JSON-parsed req.body. Firebase Cloud Functions v2 always provides rawBody
    // for onRequest handlers.
    let verifiedPayload;
    try {
        const wh = new svix_1.Webhook(WEBHOOK_SECRET.value());
        if (!req.rawBody) {
            throw new Error('Missing rawBody: Firebase Cloud Functions should provide it');
        }
        verifiedPayload = wh.verify(req.rawBody.toString('utf8'), {
            'svix-id': String(req.headers['svix-id'] ?? ''),
            'svix-timestamp': String(req.headers['svix-timestamp'] ?? ''),
            'svix-signature': String(req.headers['svix-signature'] ?? ''),
        });
    }
    catch (err) {
        logger.warn('parseEmail: signature verification failed', { err });
        res.status(401).send('Unauthorized');
        return;
    }
    // ── Parse the inbound email ────────────────────────────────────────────
    let email;
    try {
        email = adapter.parse(verifiedPayload);
    }
    catch (err) {
        logger.warn('parseEmail: malformed payload', { err });
        res.status(400).send('Bad Request');
        return;
    }
    const fromAddress = (0, emailIngestion_1.extractAddress)(email.from);
    // ── Resolve sender → client ────────────────────────────────────────────
    const resolved = await (0, senderResolver_1.resolveSenderToClient)(fromAddress);
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
    }
    catch (err) {
        logger.error('parseEmail: OpenAI extraction failed', { err, clientId });
        res.status(500).send('Extraction failed');
        return;
    }
    // ── Persist pending import ─────────────────────────────────────────────
    // Truncate by byte length, not character count, to honour the 10 KB limit precisely.
    const rawEmail = Buffer.from(email.text).slice(0, MAX_RAW_BYTES).toString();
    try {
        await admin_1.db.collection('pendingImports').add({
            ownerUid,
            clientId,
            rawEmail,
            extracted,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger.error('parseEmail: failed to persist import', { err, clientId });
        res.status(500).send('Persistence failed');
        return;
    }
    logger.info('parseEmail: import created', { clientId, confidence: extracted.confidence });
    res.status(200).send('OK');
});
async function extractJobData(emailText) {
    const client = (0, openaiClient_1.getOpenAIClient)();
    const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: extractJobFromEmail_1.SYSTEM_PROMPT },
            { role: 'user', content: emailText },
        ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    return validateExtraction(JSON.parse(raw));
}
function validateExtraction(raw) {
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
    const date = String(raw.date ?? '');
    if (!DATE_RE.test(date)) {
        throw new Error(`Invalid date from OpenAI: "${date}"`);
    }
    const entryType = raw.entryType === 'lump_sum' ? 'lump_sum' : 'shift';
    const confidence = Math.min(1, Math.max(0, Number(raw.confidence ?? 0)));
    const result = { date, entryType, confidence };
    if (entryType === 'shift') {
        const startTime = String(raw.startTime ?? '');
        const endTime = String(raw.endTime ?? '');
        if (startTime && TIME_RE.test(startTime))
            result.startTime = startTime;
        if (endTime && TIME_RE.test(endTime))
            result.endTime = endTime;
    }
    if (entryType === 'lump_sum') {
        const amount = Number(raw.amount);
        if (isFinite(amount) && amount > 0)
            result.amount = amount;
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
