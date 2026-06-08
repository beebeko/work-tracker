import OpenAI from 'openai';

/**
 * Module-scope singleton — reused across warm function invocations.
 * The API key is injected at call time via the OPENAI_API_KEY env var,
 * which is populated by Firebase Secret Manager.
 */
let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY secret is not set');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Reset the singleton — used in tests only. */
export function _resetOpenAIClient(): void {
  _client = null;
}
