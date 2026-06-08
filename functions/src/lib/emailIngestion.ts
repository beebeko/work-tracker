/**
 * Email ingestion interface.
 *
 * This abstraction isolates the delivery mechanism (SendGrid webhook, Gmail API,
 * IMAP, etc.) from the extraction pipeline. To swap delivery sources, implement
 * a new EmailIngestionAdapter and swap it in parseEmail.ts.
 */
export interface ParsedInboundEmail {
  /** The raw From header value, e.g. "Scheduler <scheduler@company.com>" */
  from: string;
  subject: string;
  /** Plain-text body (preferred) or HTML body stripped to text */
  text: string;
  /** Unix timestamp (seconds) of when the email was received */
  receivedAt: number;
}

export interface EmailIngestionAdapter {
  /**
   * Parse the raw HTTP request body into a structured email.
   * Throws if the payload is malformed or cannot be parsed.
   */
  parse(body: Record<string, unknown>): ParsedInboundEmail;
}

/**
 * SendGrid Inbound Parse adapter.
 * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */
export class SendGridAdapter implements EmailIngestionAdapter {
  parse(body: Record<string, unknown>): ParsedInboundEmail {
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

/**
 * Resend Inbound adapter.
 * https://resend.com/docs/dashboard/webhooks/inbound-emails
 *
 * Resend posts JSON of the shape:
 *   { type: 'email.received', data: { from, to, subject, text, html, ... } }
 * where `from` may be a string ("Name <addr@x>") or an object ({ name, address }).
 */
export class ResendAdapter implements EmailIngestionAdapter {
  parse(body: Record<string, unknown>): ParsedInboundEmail {
    const data = (body.data ?? body) as Record<string, unknown>;

    const rawFrom = data.from;
    let from = '';
    if (typeof rawFrom === 'string') {
      from = rawFrom;
    } else if (rawFrom && typeof rawFrom === 'object') {
      const f = rawFrom as { name?: string; address?: string; email?: string };
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

/** Extract a bare email address from a From header like "Name <addr@domain.com>". */
export function extractAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}
