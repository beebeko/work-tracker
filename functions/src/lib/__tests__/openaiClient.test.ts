import { _resetOpenAIClient, getOpenAIClient } from '../openaiClient';

afterEach(() => {
  _resetOpenAIClient();
  delete process.env.OPENAI_API_KEY;
});

describe('getOpenAIClient', () => {
  describe('happy path', () => {
    it('returns an OpenAI client when the API key is set', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const client = getOpenAIClient();
      expect(client).toBeDefined();
    });

    it('returns the same singleton instance on repeated calls', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const a = getOpenAIClient();
      const b = getOpenAIClient();
      expect(a).toBe(b);
    });
  });

  describe('error handling', () => {
    it('throws when OPENAI_API_KEY is not set', () => {
      expect(() => getOpenAIClient()).toThrow('OPENAI_API_KEY secret is not set');
    });
  });

  describe('edge cases', () => {
    it('creates a fresh client after reset', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const a = getOpenAIClient();
      _resetOpenAIClient();
      const b = getOpenAIClient();
      expect(a).not.toBe(b);
    });
  });
});
