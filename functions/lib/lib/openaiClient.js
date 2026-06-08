"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIClient = getOpenAIClient;
exports._resetOpenAIClient = _resetOpenAIClient;
const openai_1 = __importDefault(require("openai"));
/**
 * Module-scope singleton — reused across warm function invocations.
 * The API key is injected at call time via the OPENAI_API_KEY env var,
 * which is populated by Firebase Secret Manager.
 */
let _client = null;
function getOpenAIClient() {
    if (!_client) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error('OPENAI_API_KEY secret is not set');
        _client = new openai_1.default({ apiKey });
    }
    return _client;
}
/** Reset the singleton — used in tests only. */
function _resetOpenAIClient() {
    _client = null;
}
