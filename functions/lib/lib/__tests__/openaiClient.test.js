"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const openaiClient_1 = require("../openaiClient");
afterEach(() => {
    (0, openaiClient_1._resetOpenAIClient)();
    delete process.env.OPENAI_API_KEY;
});
describe('getOpenAIClient', () => {
    describe('happy path', () => {
        it('returns an OpenAI client when the API key is set', () => {
            process.env.OPENAI_API_KEY = 'sk-test-key';
            const client = (0, openaiClient_1.getOpenAIClient)();
            expect(client).toBeDefined();
        });
        it('returns the same singleton instance on repeated calls', () => {
            process.env.OPENAI_API_KEY = 'sk-test-key';
            const a = (0, openaiClient_1.getOpenAIClient)();
            const b = (0, openaiClient_1.getOpenAIClient)();
            expect(a).toBe(b);
        });
    });
    describe('error handling', () => {
        it('throws when OPENAI_API_KEY is not set', () => {
            expect(() => (0, openaiClient_1.getOpenAIClient)()).toThrow('OPENAI_API_KEY secret is not set');
        });
    });
    describe('edge cases', () => {
        it('creates a fresh client after reset', () => {
            process.env.OPENAI_API_KEY = 'sk-test-key';
            const a = (0, openaiClient_1.getOpenAIClient)();
            (0, openaiClient_1._resetOpenAIClient)();
            const b = (0, openaiClient_1.getOpenAIClient)();
            expect(a).not.toBe(b);
        });
    });
});
