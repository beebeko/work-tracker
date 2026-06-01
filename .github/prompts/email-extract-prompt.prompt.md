---
description: "Generate or refine the OpenAI extraction prompt used to parse freeform job emails. Invoke with a sample email body to generate a tested extraction prompt."
agent: agent
tools: [read, search]
argument-hint: "Paste a sample email body to base the prompt on"
---

Read the `WorkEntry` and `Gig` type definitions from `src/types/` to understand the target data shape.

Given the sample email, generate an OpenAI system + user prompt pair for the extraction Cloud Function that:

1. **System prompt**: Defines the AI's role as a structured data extractor for a freelance work tracking app. Specifies the exact JSON output schema matching `Gig` and `WorkEntry` fields. Includes instructions to:
   - Return `null` for fields that cannot be confidently extracted
   - Include a `confidence` field (0.0–1.0) for the overall extraction
   - Never hallucinate data not present in the email
   - Return raw JSON only, no prose

2. **User prompt template**: The template that wraps the email body for the API call

3. **Test cases**: 3 example email snippets with expected extraction outputs, suitable for unit tests in `functions/src/__tests__/extractJobFromEmail.test.ts`

Output the prompts as TypeScript string constants ready to paste into `functions/src/prompts/extractJobFromEmail.ts`.
