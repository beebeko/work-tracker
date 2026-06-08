"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendAdapter = exports.SendGridAdapter = void 0;
exports.extractAddress = extractAddress;
/**
 * SendGrid Inbound Parse adapter.
 * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */
class SendGridAdapter {
    parse(body) {
        const from = String(body.from ?? '');
        const subject = String(body.subject ?? '');
        const text = String(body.text ?? body.html ?? '');
        const receivedAt = Math.floor(Date.now() / 1000);
        if (!from || !text) {
            throw new Error('SendGrid payload missing required fields: from, text');
        }
        return { from, subject, text, receivedAt };
    }
}
exports.SendGridAdapter = SendGridAdapter;
/**
 * Resend Inbound adapter.
 * https://resend.com/docs/dashboard/webhooks/inbound-emails
 *
 * Resend posts JSON of the shape:
 *   { type: 'email.received', data: { from, to, subject, text, html, ... } }
 * where `from` may be a string ("Name <addr@x>") or an object ({ name, address }).
 */
class ResendAdapter {
    parse(body) {
        const data = (body.data ?? body);
        const rawFrom = data.from;
        let from = '';
        if (typeof rawFrom === 'string') {
            from = rawFrom;
        }
        else if (rawFrom && typeof rawFrom === 'object') {
            const f = rawFrom;
            const addr = f.address ?? f.email ?? '';
            from = f.name ? `${f.name} <${addr}>` : addr;
        }
        const subject = String(data.subject ?? '');
        const text = String(data.text ?? data.html ?? '');
        const receivedAt = Math.floor(Date.now() / 1000);
        if (!from || !text) {
            throw new Error('Resend payload missing required fields: from, text');
        }
        return { from, subject, text, receivedAt };
    }
}
exports.ResendAdapter = ResendAdapter;
/** Extract a bare email address from a From header like "Name <addr@domain.com>". */
function extractAddress(from) {
    const match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).toLowerCase().trim();
}
